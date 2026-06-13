/**
 * Padrão compartilhado entre todos os solvers:
 * - falha de RPC/API não grava sem_saldo
 * - recua checkpoint e aguarda retry
 * - log resumido por lote
 */

export function getEvmResult(results, item, toChecksum = (addr) => addr) {
  return results[item.addr] || results[toChecksum(item.addr)];
}

export function findBatchRpcFailures(batch, results, options = {}) {
  const hasResult = options.hasResult
    || ((item) => Boolean(results[options.keyFn ? options.keyFn(item) : item.addr]));

  return batch.filter((item) => !hasResult(item));
}

export function rewindBatchCheckpoint(solver, batch) {
  const raw = batch[0].privHex;
  const firstPriv = BigInt(raw.startsWith('0x') ? raw : `0x${raw}`);
  const rewind = firstPriv > solver.rangeMin ? firstPriv - 1n : solver.rangeMin;
  solver.state.lastPrivkey = '0x' + rewind.toString(16);
  solver.state.totalChecked = Math.max(0, solver.state.totalChecked - batch.length);
  solver._saveState();
}

export async function handleBatchRpcFailure(solver, batch, results, options = {}) {
  const failed = findBatchRpcFailures(batch, results, options);
  if (failed.length === 0) return false;

  rewindBatchCheckpoint(solver, batch);
  const retryMs = options.retryMs ?? 15000;
  solver.log(
    `⚠️ ${failed.length}/${batch.length} endereços sem resposta RPC — `
    + `checkpoint recuado para ${solver.state.lastPrivkey}, retry em ${retryMs}ms`
  );
  await new Promise((resolve) => setTimeout(resolve, retryMs));
  return true;
}

export function logBatchItemErrors(logFn, label, itemErrors, total, firstError) {
  if (itemErrors > 0) {
    logFn(`⚠️ [${label}] ${itemErrors}/${total} itens falharam: ${firstError || 'erro RPC'}`);
  }
}

export function summarizeMissingResults(logFn, label, results, addresses) {
  const missing = addresses.filter((addr) => !results[addr]);
  if (missing.length > 0) {
    logFn(`⚠️ [${label}] ${missing.length}/${addresses.length} endereços sem resposta após consulta`);
  }
  return missing.length;
}

export function rpcHost(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return 'rpc';
  }
}

export function buildRpcEndpoints(primary, fallback, fallback2) {
  return [...new Set([primary, fallback, fallback2].filter(
    (url) => url && typeof url === 'string' && !url.includes('YOUR_')
  ))];
}

export function isTransientRpcMessage(message = '') {
  const msg = message.toLowerCase();
  return msg.includes('timeout')
    || msg.includes('does not exist')
    || msg.includes('not available')
    || msg.includes('rate limit')
    || msg.includes('too many')
    || msg.includes('429');
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const RPC_HEADERS = {
  'Content-Type': 'application/json',
  Accept: 'application/json',
  'User-Agent': 'Puzzle-Solver-Client/1.0',
  Connection: 'keep-alive',
};

/** Shape normalizado para LLM/consumidores: { [address]: { balance } } */
export function normalizeBalanceMap(raw = {}) {
  const out = {};
  for (const [addr, info] of Object.entries(raw)) {
    if (!info) continue;
    const balance = info.balance ?? info.balanceWei ?? 0n;
    out[addr] = { balance: typeof balance === 'bigint' ? balance : BigInt(balance || 0) };
  }
  return out;
}

export function parseRetryAfterMs(headers = {}) {
  const raw = headers['retry-after'] || headers['Retry-After'];
  if (!raw) return null;
  const sec = parseInt(String(raw), 10);
  if (!Number.isNaN(sec)) return sec * 1000;
  const date = Date.parse(String(raw));
  if (!Number.isNaN(date)) return Math.max(0, date - Date.now());
  return null;
}

/**
 * Dispatcher EVM — eth_getBalance JSON-RPC batch com rotação de endpoints.
 * Retorna { results, provider, endpointIndex } onde results[addr] = { balance, address, ...extras }
 */
export async function dispatchEvmBalances(axios, addresses, endpoints, options = {}) {
  const {
    timeoutMs = 10000,
    retryMs = 15000,
    toChecksum = (addr) => addr,
    startIndex = 0,
    onRotate,
  } = options;

  if (!addresses?.length) return { results: {}, provider: 'rpc', endpointIndex: startIndex };

  const urls = (endpoints || []).filter(Boolean);
  if (urls.length === 0) return { results: {}, provider: 'rpc', endpointIndex: startIndex };

  let endpointIndex = startIndex % urls.length;
  const url = urls[endpointIndex];
  const provider = rpcHost(url);
  const results = {};

  const payload = addresses.map((addr, index) => ({
    jsonrpc: '2.0',
    method: 'eth_getBalance',
    params: [addr.toLowerCase(), 'latest'],
    id: index + 1,
  }));

  try {
    const resp = await axios.post(url, payload, {
      headers: RPC_HEADERS,
      timeout: timeoutMs,
      validateStatus: () => true,
    });

    if (resp.status === 429 || isTransientRpcMessage(JSON.stringify(resp.data || ''))) {
      if (urls.length > 1) {
        endpointIndex = (endpointIndex + 1) % urls.length;
        onRotate?.(endpointIndex, rpcHost(urls[endpointIndex]));
        await sleep(retryMs);
        return dispatchEvmBalances(axios, addresses, urls, { ...options, startIndex: endpointIndex });
      }
      return { results, provider, endpointIndex, transient: true };
    }

    if (resp.status === 200 && Array.isArray(resp.data)) {
      resp.data.forEach((item, idx) => {
        const addr = addresses[idx];
        if (item?.result) {
          const checksumAddr = toChecksum(addr);
          results[checksumAddr] = {
            balance: BigInt(item.result),
            address: checksumAddr,
          };
        }
      });
    } else if (resp.status === 200 && resp.data?.result && addresses.length === 1) {
      const checksumAddr = toChecksum(addresses[0]);
      results[checksumAddr] = {
        balance: BigInt(resp.data.result),
        address: checksumAddr,
      };
    } else if (urls.length > 1) {
      endpointIndex = (endpointIndex + 1) % urls.length;
      onRotate?.(endpointIndex, rpcHost(urls[endpointIndex]));
      await sleep(retryMs);
      return dispatchEvmBalances(axios, addresses, urls, { ...options, startIndex: endpointIndex });
    }
  } catch {
    if (urls.length > 1) {
      endpointIndex = (endpointIndex + 1) % urls.length;
      onRotate?.(endpointIndex, rpcHost(urls[endpointIndex]));
      await sleep(retryMs);
      return dispatchEvmBalances(axios, addresses, urls, { ...options, startIndex: endpointIndex });
    }
  }

  return { results, provider, endpointIndex };
}

/**
 * Dispatcher Solana — getBalance JSON-RPC batch com backoff 429 (Retry-After).
 */
export async function dispatchSolanaBalances(axios, addresses, rpcUrl, options = {}) {
  const {
    timeoutMs = 3000,
    retryMs = 15000,
    maxRetries = 3,
    delayMs = 1100,
  } = options;

  const results = {};
  if (!addresses?.length || !rpcUrl) return { results, provider: rpcHost(rpcUrl) };

  let sawRateLimit = false;

  const payload = addresses.map((addr, index) => ({
    jsonrpc: '2.0',
    method: 'getBalance',
    params: [addr],
    id: index + 1,
  }));

  try {
    const resp = await axios.post(rpcUrl, payload, {
      headers: RPC_HEADERS,
      timeout: timeoutMs,
      validateStatus: () => true,
    });

    if (resp.status === 429 || (Array.isArray(resp.data) && resp.data.every((item) => item?.error?.code === 429))) {
      sawRateLimit = true;
    } else if (resp.status === 200 && Array.isArray(resp.data)) {
      resp.data.forEach((item, idx) => {
        const addr = addresses[idx];
        if (item?.result?.value !== undefined) {
          const lamports = BigInt(item.result.value || 0);
          results[addr] = {
            balance: lamports,
            address: addr,
            decimals: 9,
            uiAmount: Number(lamports) / 1e9,
          };
        } else if (item?.error?.code === 429) {
          sawRateLimit = true;
        }
      });
      if (Object.keys(results).length === addresses.length) {
        return { results, provider: rpcHost(rpcUrl) };
      }
    } else if (resp.status === 200 && resp.data?.result?.value !== undefined && addresses.length === 1) {
      const addr = addresses[0];
      const lamports = BigInt(resp.data.result.value || 0);
      results[addr] = {
        balance: lamports,
        address: addr,
        decimals: 9,
        uiAmount: Number(lamports) / 1e9,
      };
      return { results, provider: rpcHost(rpcUrl) };
    }
  } catch {
    // fallback sequencial abaixo
  }

  const missing = addresses.filter((a) => !results[a]);
  if (missing.length === 0) {
    return { results, provider: rpcHost(rpcUrl) };
  }

  if (sawRateLimit) {
    await sleep(Math.min(retryMs, 3000));
  }

  for (const addr of missing) {
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const resp = await axios.post(rpcUrl, {
          jsonrpc: '2.0',
          method: 'getBalance',
          params: [addr],
          id: 1,
        }, {
          headers: RPC_HEADERS,
          timeout: timeoutMs,
          validateStatus: () => true,
        });

        if (resp.status === 429 || resp.data?.error?.code === 429) {
          sawRateLimit = true;
          if (attempt < maxRetries) {
            const waitMs = parseRetryAfterMs(resp.headers) ?? Math.min(retryMs, 3000);
            await sleep(waitMs);
            continue;
          }
          break;
        }

        if (resp.data?.result?.value !== undefined) {
          const lamports = BigInt(resp.data.result.value || 0);
          results[addr] = {
            balance: lamports,
            address: addr,
            decimals: 9,
            uiAmount: Number(lamports) / 1e9,
          };
          break;
        }
      } catch {
        if (attempt < maxRetries) {
          await sleep(Math.min(retryMs, 2000));
        }
      }
    }
    await sleep(delayMs);
  }

  const rateLimited = sawRateLimit && Object.keys(results).length === 0;
  return { results, provider: rpcHost(rpcUrl), ...(rateLimited ? { rateLimited: true } : {}) };
}

/**
 * Dispatcher Blockchain.info — bulk ?active=addr1|addr2|...
 * Retorna results[addr] = { balance, address, nTx, totalReceived, totalSent, provider }
 */
export async function dispatchBlockchainInfoBalances(axios, addresses, baseUrl, options = {}) {
  const {
    timeoutMs = 3000,
    chunkSize = 100,
    scheduleFn = (fn) => fn(),
    providerLabel = 'blockchain.info',
  } = options;

  const results = {};
  if (!addresses?.length) return { results, provider: providerLabel };

  const root = (baseUrl || 'https://blockchain.info').replace(/\/$/, '');

  for (let offset = 0; offset < addresses.length; offset += chunkSize) {
    const chunk = addresses.slice(offset, offset + chunkSize);
    const active = chunk.join('|');

    const resp = await scheduleFn(() => axios.get(`${root}/balance`, {
      params: { active },
      headers: { 'User-Agent': 'ClawRafaelIA-Test/1.0', Connection: 'keep-alive' },
      timeout: timeoutMs,
      validateStatus: () => true,
    }));

    if (resp.status === 429) {
      return { results, provider: providerLabel, rateLimited: true };
    }

    if (resp.status === 200 && resp.data && typeof resp.data === 'object') {
      chunk.forEach((addr) => {
        const entry = resp.data[addr];
        if (entry) {
          results[addr] = {
            balance: BigInt(entry.final_balance || 0),
            address: addr,
            nTx: entry.n_tx || 0,
            totalReceived: entry.total_received || 0,
            totalSent: entry.total_sent || 0,
            provider: providerLabel,
          };
        }
      });
    }
  }

  return { results, provider: providerLabel };
}

export function isEtherscanUrl(url = '') {
  return String(url).toLowerCase().includes('etherscan.io');
}

/**
 * Dispatcher Etherscan — balancemulti (até 20 endereços por chunk).
 * Retorna shape normalizado { [checksumAddr]: { balance, address } }.
 */
export async function dispatchEtherscanBalances(axios, addresses, apiUrl, apiKey, options = {}) {
  const { timeoutMs = 10000, retryMs = 5000, toChecksum = (a) => a } = options;
  const results = {};

  if (!addresses?.length || !apiUrl || !apiKey) {
    return { results, provider: 'etherscan' };
  }

  for (let offset = 0; offset < addresses.length; offset += 20) {
    const chunk = addresses.slice(offset, offset + 20);
    const addressesStr = chunk.map((a) => a.toLowerCase()).join(',');

    const resp = await axios.get(apiUrl, {
      params: {
        chainid: 1,
        module: 'account',
        action: 'balancemulti',
        address: addressesStr,
        tag: 'latest',
        apikey: apiKey,
      },
      headers: { 'User-Agent': 'Puzzle-Solver-Client/1.0', Connection: 'keep-alive' },
      timeout: timeoutMs,
      validateStatus: () => true,
    });

    if (
      resp.status === 429
      || (resp.data?.result && typeof resp.data.result === 'string' && resp.data.result.includes('rate limit'))
    ) {
      await sleep(retryMs);
      offset -= 20;
      continue;
    }

    if (resp.status === 200 && resp.data?.status === '1' && Array.isArray(resp.data.result)) {
      resp.data.result.forEach((item) => {
        const checksumAddr = toChecksum(item.account);
        results[checksumAddr] = {
          balance: BigInt(item.balance || '0'),
          address: checksumAddr,
        };
      });
    }
  }

  return { results, provider: 'etherscan' };
}

/**
 * Guard Ethereum — roteia etherscan.io → balancemulti, senão eth_getBalance batch.
 */
export async function dispatchEthereumBalances(axios, addresses, rpcUrl, options = {}) {
  const {
    etherscanKey,
    fallback,
    timeoutMs = 10000,
    retryMs = 15000,
    toChecksum = (a) => a,
  } = options;

  if (isEtherscanUrl(rpcUrl)) {
    return dispatchEtherscanBalances(axios, addresses, rpcUrl, etherscanKey, {
      timeoutMs,
      retryMs,
      toChecksum,
    });
  }

  const endpoints = buildRpcEndpoints(rpcUrl, fallback);
  return dispatchEvmBalances(axios, addresses, endpoints, {
    timeoutMs,
    retryMs,
    toChecksum,
  });
}

/** Mapeamento de env keys para preflight cross-puzzle (71+72+73). */
export const PUZZLE_TARGET_KEYS = {
  bitcoin: [
    { label: 'BTC_P2PKH', prefix: 'BTC_P2PKH' },
    { label: 'BTC_P2WPKH', prefix: 'BTC_P2WPKH' },
    { label: 'BTC_P2SH', prefix: 'BTC_P2SH' },
  ],
  evm: [
    {
      label: 'ETH',
      prefix: 'ETH',
      rpc: 'ETH_RPC_ENDPOINT',
      fallback: 'ETH_RPC_FALLBACK',
      apiKey: 'ETHERSCAN_KEY',
    },
    { label: 'SOL', prefix: 'SOL', rpc: 'SOL_RPC_ENDPOINT' },
    {
      label: 'POLYGON',
      prefix: 'POLYGON',
      rpc: 'POLYGON_RPC_ENDPOINT',
      fallback: 'POLYGON_RPC_FALLBACK',
    },
    {
      label: 'BNB',
      prefix: 'BNB',
      rpc: 'BNB_RPC_ENDPOINT',
      fallback: 'BNB_RPC_FALLBACK',
    },
  ],
};

const PUZZLE_IDS = [71, 72, 73];

function envTarget(env, prefix, puzzleId) {
  return env[`${prefix}_TARGET_${puzzleId}`] || '';
}

function toChecksumEth(addr) {
  return typeof addr === 'string' ? addr.toLowerCase() : addr;
}

/**
 * Preflight batch — todos targets 71+72+73 por chain do grupo.
 * bitcoin: 1 req (9 endereços) | evm: 4 req (ETH+SOL+POLYGON+BNB × 3 targets)
 */
export async function preflightChainTargets(group, env = process.env) {
  const axios = (await import('axios')).default;
  const specs = PUZZLE_TARGET_KEYS[group];
  if (!specs) {
    return { ok: false, requests: 0, error: `grupo desconhecido: ${group}` };
  }

  const timeoutMs = Number(env.TIMEOUT_MS || 10000);
  let requests = 0;
  let failures = 0;
  const chains = [];

  if (group === 'bitcoin') {
    const baseUrl = env.BLOCKCHAIN_INFO_BASE_URL || 'https://blockchain.info';
    const addresses = [];
    for (const spec of specs) {
      for (const pid of PUZZLE_IDS) {
        const addr = envTarget(env, spec.prefix, pid);
        if (addr) addresses.push(addr);
      }
    }
    if (addresses.length === 0) {
      return { ok: false, requests: 0, error: 'nenhum target BTC configurado' };
    }

    const { results, rateLimited } = await dispatchBlockchainInfoBalances(axios, addresses, baseUrl, {
      timeoutMs: Number(env.BTC_TIMEOUT_MS || env.TIMEOUT_MS || 3000),
    });
    requests = 1;
    const hit = Object.keys(results).length;
    if (rateLimited || hit === 0) failures += 1;
    chains.push({ chain: 'BTC', ok: !rateLimited && hit > 0, addresses: addresses.length, hit });
  }

  if (group === 'evm') {
    for (const spec of specs) {
      const addresses = PUZZLE_IDS.map((pid) => envTarget(env, spec.prefix, pid)).filter(Boolean);
      if (addresses.length === 0) {
        failures += 1;
        chains.push({ chain: spec.label, ok: false, error: 'targets ausentes' });
        continue;
      }

      const rpc = env[spec.rpc] || '';
      if (!rpc) {
        failures += 1;
        chains.push({ chain: spec.label, ok: false, error: 'RPC ausente' });
        continue;
      }

      requests += 1;
      let hit = 0;
      let chainOk = false;

      if (spec.label === 'SOL') {
        const { results, rateLimited } = await dispatchSolanaBalances(axios, addresses, rpc, {
          timeoutMs: Number(env.SOL_TIMEOUT_MS || timeoutMs),
          retryMs: Number(env.SOL_RPC_RETRY_MS || 15000),
          delayMs: Number(env.SOL_DELAY_MS || 1100),
        });
        hit = Object.keys(results).length;
        chainOk = !rateLimited && hit > 0;
      } else {
        const { results, transient } = await dispatchEthereumBalances(axios, addresses, rpc, {
          etherscanKey: env[spec.apiKey || 'ETHERSCAN_KEY'],
          fallback: spec.fallback ? env[spec.fallback] : undefined,
          timeoutMs: Number(env[`${spec.prefix}_TIMEOUT_MS`] || timeoutMs),
          retryMs: Number(env[`${spec.prefix}_RPC_RETRY_MS`] || 15000),
          toChecksum: toChecksumEth,
        });
        hit = Object.keys(results).length;
        chainOk = !transient && hit > 0;
      }

      if (!chainOk) failures += 1;
      chains.push({ chain: spec.label, ok: chainOk, addresses: addresses.length, hit });
    }
  }

  return {
    ok: failures === 0,
    requests,
    failures,
    chains,
  };
}

const isCli = process.argv[1]?.endsWith('solver_batch_guard.js');
if (isCli && process.argv[2] === 'preflight') {
  const group = process.argv[3] || 'evm';
  preflightChainTargets(group)
    .then((report) => {
      console.log(JSON.stringify(report, null, 2));
      process.exit(report.ok ? 0 : 1);
    })
    .catch((err) => {
      console.error(err.message);
      process.exit(1);
    });
}
