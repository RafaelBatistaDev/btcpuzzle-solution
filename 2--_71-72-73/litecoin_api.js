/**
 * Cliente Litecoin unificado — Litecoinspace (paralelo), AtomicWallet, Blockcypher (batch), Chain.so.
 */
import axios from 'axios';

export const LTC_DEFAULT_API_URL = 'https://litecoinspace.org';
export const LTC_BLOCKCYPHER_URL = 'https://api.blockcypher.com/v1/ltc/main/addrs';
export const LTC_ATOMICWALLET_URL = 'https://litecoin.atomicwallet.io/api/v1/address';

const USER_AGENT = 'Puzzle-Solver/1.0';
const DEFAULT_CONCURRENCY = 5;
const CHUNK_PAUSE_MS = 400;

export function detectLitecoinProvider(baseUrl) {
  const url = (baseUrl || '').toLowerCase();
  if (url.includes('litecoinspace.org')) return 'litecoinspace';
  if (url.includes('blockcypher.com')) return 'blockcypher';
  if (url.includes('atomicwallet.io')) return 'atomicwallet';
  if (url.includes('chain.so')) return 'chainso';
  return 'unknown';
}

export function isRateLimited(response) {
  if (!response) return false;
  if (response.status === 429) return true;
  const body = response.data;
  if (body && typeof body === 'object' && !Array.isArray(body) && body.error) {
    return String(body.error).toLowerCase().includes('limit');
  }
  if (Array.isArray(body)) {
    return body.some((item) => item?.error && String(item.error).includes('429'));
  }
  return false;
}

function entryFromLitecoinspace(addr, data) {
  if (!data || typeof data !== 'object') return null;
  const cs = data.chain_stats || {};
  const mp = data.mempool_stats || {};
  const balance = BigInt(
    (cs.funded_txo_sum || 0) - (cs.spent_txo_sum || 0)
    + (mp.funded_txo_sum || 0) - (mp.spent_txo_sum || 0)
  );
  return {
    balance,
    address: addr,
    nTx: (cs.tx_count || 0) + (mp.tx_count || 0),
    totalReceived: cs.funded_txo_sum || 0,
    totalSent: cs.spent_txo_sum || 0,
    provider: 'litecoinspace',
  };
}

function entryFromBlockcypher(addr, data) {
  if (!data || data.error) return null;
  return {
    balance: BigInt(data.final_balance ?? data.balance ?? 0),
    address: addr,
    nTx: data.final_n_tx ?? data.n_tx ?? 0,
    totalReceived: data.total_received ?? 0,
    totalSent: data.total_sent ?? 0,
    provider: 'blockcypher',
  };
}

function entryFromAtomicwallet(addr, data) {
  if (!data || data.error) return null;
  const balance = BigInt(data.balance ?? 0) + BigInt(data.unconfirmedBalance ?? 0);
  return {
    balance,
    address: addr,
    nTx: data.txApperances ?? data.txAppearances ?? (balance > 0n ? 1 : 0),
    totalReceived: Number(data.totalReceived ?? 0),
    totalSent: Number(data.totalSent ?? 0),
    provider: 'atomicwallet',
  };
}

function entryFromChainSo(addr, data) {
  if (!data || data.status === 'fail') return null;
  const payload = data.data ?? data;
  const balance = BigInt(
    payload.confirmed_balance ?? payload.balance ?? payload.confirmed ?? 0
  ) + BigInt(payload.unconfirmed_balance ?? payload.unconfirmed ?? 0);
  return {
    balance,
    address: addr,
    nTx: payload.txs_total ?? payload.txs_received ?? 0,
    totalReceived: payload.confirmed_received ?? 0,
    totalSent: 0,
    provider: 'chainso',
  };
}

function buildProviderChain(baseUrl, chainSoApiKey) {
  const primary = detectLitecoinProvider(baseUrl);
  const chain = [];

  if (primary !== 'unknown') chain.push({ name: primary, baseUrl });
  for (const fallback of [
    { name: 'litecoinspace', baseUrl: LTC_DEFAULT_API_URL },
    { name: 'atomicwallet', baseUrl: LTC_ATOMICWALLET_URL },
    { name: 'blockcypher', baseUrl: LTC_BLOCKCYPHER_URL },
  ]) {
    if (!chain.some((p) => p.name === fallback.name)) chain.push(fallback);
  }
  if (chainSoApiKey && !chain.some((p) => p.name === 'chainso')) {
    chain.push({ name: 'chainso', baseUrl: 'https://chain.so/api/v3', apiKey: chainSoApiKey });
  }
  return chain;
}

async function httpGet(url, timeoutMs, headers = {}) {
  return axios.get(url, {
    headers: { 'User-Agent': USER_AGENT, Accept: 'application/json', ...headers },
    timeout: timeoutMs,
    validateStatus: () => true,
  });
}

function litecoinspaceUrl(baseUrl, addr) {
  const root = baseUrl.replace(/\/$/, '').replace(/\/api$/i, '');
  return `${root}/api/address/${addr}`;
}

async function fetchParallelSingle(
  providerName,
  addresses,
  timeoutMs,
  fetchOne,
  concurrency = DEFAULT_CONCURRENCY,
) {
  const results = {};
  for (let offset = 0; offset < addresses.length; offset += concurrency) {
    const chunk = addresses.slice(offset, offset + concurrency);
    const settled = await Promise.allSettled(chunk.map(async (addr) => {
      try {
        const resp = await fetchOne(addr);
        return { addr, resp };
      } catch {
        return { addr, resp: null };
      }
    }));

    for (const outcome of settled) {
      if (outcome.status !== 'fulfilled') continue;
      const { addr, resp } = outcome.value;
      if (!resp) continue;
      if (resp.status === 429) {
        return { results, rateLimited: true };
      }
      if (resp.status === 404) {
        results[addr] = {
          balance: 0n, address: addr, nTx: 0,
          totalReceived: 0, totalSent: 0, provider: providerName,
        };
        continue;
      }
      if (resp.status !== 200) continue;
      const entry = resp.entry;
      if (entry) {
        results[addr] = entry;
      }
    }

    if (offset + concurrency < addresses.length) {
      await sleep(CHUNK_PAUSE_MS);
    }
  }
  return { results, rateLimited: false };
}

async function fetchLitecoinspace(provider, addresses, timeoutMs) {
  return fetchParallelSingle('litecoinspace', addresses, timeoutMs, async (addr) => {
    const resp = await httpGet(litecoinspaceUrl(provider.baseUrl, addr), timeoutMs);
    return {
      status: resp.status,
      entry: entryFromLitecoinspace(addr, resp.data),
    };
  });
}

async function fetchAtomicwallet(_provider, addresses, timeoutMs) {
  return fetchParallelSingle('atomicwallet', addresses, timeoutMs, async (addr) => {
    const resp = await httpGet(`${LTC_ATOMICWALLET_URL}/${addr}`, timeoutMs);
    return {
      status: resp.status,
      entry: entryFromAtomicwallet(addr, resp.data),
    };
  });
}

async function fetchBlockcypher(provider, addresses, timeoutMs) {
  const root = provider.baseUrl.replace(/\/$/, '');
  const joined = addresses.join(';');
  let resp;
  try {
    resp = await httpGet(`${root}/${joined}/balance`, timeoutMs);
  } catch {
    return { results: {}, rateLimited: false };
  }

  if (isRateLimited(resp)) {
    return { results: {}, rateLimited: true };
  }

  const results = {};
  if (Array.isArray(resp.data)) {
    addresses.forEach((addr, idx) => {
      const entry = entryFromBlockcypher(addr, resp.data[idx]);
      if (entry) results[addr] = entry;
    });
    return { results, rateLimited: false };
  }

  if (addresses.length === 1 && resp.status === 200) {
    const entry = entryFromBlockcypher(addresses[0], resp.data);
    if (entry) results[addresses[0]] = entry;
    return { results, rateLimited: false };
  }

  if (resp.status === 404 && addresses.length === 1) {
    results[addresses[0]] = {
      balance: 0n, address: addresses[0], nTx: 0,
      totalReceived: 0, totalSent: 0, provider: 'blockcypher',
    };
  }

  return { results, rateLimited: false };
}

async function fetchChainSo(provider, addresses, timeoutMs) {
  const headers = provider.apiKey ? { 'API-KEY': provider.apiKey } : {};
  return fetchParallelSingle('chainso', addresses, timeoutMs, async (addr) => {
    const resp = await httpGet(
      `${provider.baseUrl.replace(/\/$/, '')}/balance/LTC/${addr}`,
      timeoutMs,
      headers,
    );
    return {
      status: resp.status,
      entry: entryFromChainSo(addr, resp.data),
    };
  }, 3);
}

async function fetchWithProvider(provider, addresses, timeoutMs) {
  switch (provider.name) {
    case 'litecoinspace':
      return fetchLitecoinspace(provider, addresses, timeoutMs);
    case 'atomicwallet':
      return fetchAtomicwallet(provider, addresses, timeoutMs);
    case 'blockcypher':
      return fetchBlockcypher(provider, addresses, timeoutMs);
    case 'chainso':
      return fetchChainSo(provider, addresses, timeoutMs);
    default:
      return { results: {}, rateLimited: false };
  }
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export async function queryLitecoinBalances({
  baseUrl,
  addresses,
  timeoutMs = 3000,
  chainSoApiKey = null,
  onLog = () => {},
  schedule = (fn) => fn(),
  maxRetries = 3,
}) {
  if (!addresses.length) return {};

  const providers = buildProviderChain(baseUrl, chainSoApiKey);
  const final = {};
  let pending = [...addresses];

  for (const provider of providers) {
    if (!pending.length) break;

    onLog(`📡 [${provider.name}] Consultando ${pending.length} endereço(s) em paralelo...`);

    let outcome = null;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      outcome = await schedule(() => fetchWithProvider(provider, pending, timeoutMs));

      if (outcome.rateLimited) {
        const waitMs = Math.min(10000 * attempt, 60000);
        onLog(`⚠️ [${provider.name}] Rate limit (tentativa ${attempt}/${maxRetries}). Aguardando ${waitMs / 1000}s...`);
        await sleep(waitMs);
        continue;
      }
      break;
    }

    if (!outcome || outcome.rateLimited) {
      onLog(`⚠️ [${provider.name}] Indisponível — tentando próximo provedor...`);
      continue;
    }

    Object.assign(final, outcome.results);
    pending = addresses.filter((addr) => !final[addr]);
  }

  const unresolved = addresses.filter((addr) => !final[addr]);
  if (unresolved.length > 0) {
    onLog(`⚠️ [Litecoin] ${unresolved.length}/${addresses.length} endereços sem resposta após todos os provedores`);
  }

  return final;
}

export async function fetchLitecoinAddressBalance(
  baseUrl,
  addr,
  timeoutMs = 3000,
  chainSoApiKey = null,
  schedule = (fn) => fn(),
) {
  const results = await queryLitecoinBalances({
    baseUrl,
    addresses: [addr],
    timeoutMs,
    chainSoApiKey,
    schedule,
  });
  const info = results[addr];
  if (!info || info.provider === 'unknown') return null;
  return info.balance;
}

export async function probeLitecoinApi(
  baseUrl,
  probeAddr = 'LR3gVmNE5FSdxVr9p4JJXv9wxxPKzNGfez',
  timeoutMs = 5000,
) {
  try {
    const results = await queryLitecoinBalances({
      baseUrl,
      addresses: [probeAddr],
      timeoutMs,
      maxRetries: 1,
    });
    const info = results[probeAddr];
    return Boolean(info && info.provider !== 'unknown');
  } catch {
    return false;
  }
}
