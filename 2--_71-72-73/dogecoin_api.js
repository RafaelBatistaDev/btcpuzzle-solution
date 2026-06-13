/**
 * Cliente Dogecoin — Alchemy Blockbook, AtomicWallet, Blockcypher.
 */
import axios from 'axios';

export const DOGE_DEFAULT_API_URL = 'https://dogecoin.atomicwallet.io/api/v2/address';
export const DOGE_ATOMICWALLET_V1_URL = 'https://dogecoin.atomicwallet.io/api/v1/address';
export const DOGE_BLOCKCYPHER_URL = 'https://api.blockcypher.com/v1/doge/main/addrs';

const USER_AGENT = 'Puzzle-Solver/1.0';
const DEFAULT_CONCURRENCY = 5;
const CHUNK_PAUSE_MS = 300;

export function detectDogecoinProvider(baseUrl) {
  const url = (baseUrl || '').toLowerCase();
  if (url.includes('alchemy.com')) return 'alchemy';
  if (url.includes('atomicwallet.io')) return 'atomicwallet';
  if (url.includes('blockcypher.com')) return 'blockcypher';
  return 'unknown';
}

export function isCloudflareBlocked(response) {
  if (!response) return false;
  if (response.status === 403) return true;
  const body = response.data;
  if (typeof body === 'string' && body.includes('Just a moment')) return true;
  return false;
}

export function isRateLimited(response) {
  if (!response) return false;
  if (response.status === 429 || response.status === 430) return true;
  const body = response.data;
  if (body && typeof body === 'object' && !Array.isArray(body) && body.error) {
    const err = String(body.error).toLowerCase();
    return err.includes('limit') || err.includes('limits reached');
  }
  if (Array.isArray(body)) {
    return body.some((item) => item?.error && String(item.error).toLowerCase().includes('limit'));
  }
  return false;
}

function parseCoinBalance(value) {
  if (value === null || value === undefined || value === '') return 0n;
  const str = String(value).trim();
  if (str.includes('.')) {
    const [whole, frac = ''] = str.split('.');
    const padded = (frac + '00000000').slice(0, 8);
    return BigInt(whole || '0') * 100000000n + BigInt(padded);
  }
  return BigInt(str);
}

function entryFromBlockbook(addr, data, provider) {
  if (!data || data.error) return null;
  const balance = parseCoinBalance(data.balance ?? 0)
    + parseCoinBalance(data.unconfirmedBalance ?? 0);
  return {
    balance,
    address: addr,
    nTx: data.txs ?? data.txApperances ?? data.txAppearances ?? (balance > 0n ? 1 : 0),
    totalReceived: parseCoinBalance(data.totalReceived ?? 0),
    totalSent: parseCoinBalance(data.totalSent ?? 0),
    provider,
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

function blockbookAddressUrl(baseUrl, addr) {
  const root = (baseUrl || DOGE_DEFAULT_API_URL).replace(/\/$/, '');
  if (root.includes('alchemy.com')) {
    return `${root}/api/v2/address/${addr}?details=basic`;
  }
  if (root.includes('/v2/')) {
    return `${root}/${addr}?details=basic`;
  }
  return `${root}/${addr}`;
}

function buildProviderChain(baseUrl) {
  const primary = detectDogecoinProvider(baseUrl);
  const chain = [];

  const add = (name, url) => {
    if (!chain.some((p) => p.name === name)) {
      chain.push({ name, baseUrl: url });
    }
  };

  if (primary !== 'unknown') add(primary, baseUrl);
  add('atomicwallet', DOGE_DEFAULT_API_URL);
  add('blockcypher', DOGE_BLOCKCYPHER_URL);

  return chain;
}

async function httpGet(url, timeoutMs, headers = {}) {
  return axios.get(url, {
    headers: { 'User-Agent': USER_AGENT, Accept: 'application/json', ...headers },
    timeout: timeoutMs,
    validateStatus: () => true,
  });
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

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
        return { blocked: false, results, rateLimited: true };
      }
      if (isCloudflareBlocked(resp)) {
        return { blocked: true, results, rateLimited: false };
      }
      if (resp.status === 404) {
        results[addr] = {
          balance: 0n, address: addr, nTx: 0,
          totalReceived: 0, totalSent: 0, provider: providerName,
        };
        continue;
      }
      if (resp.status !== 200) continue;
      if (resp.entry) results[addr] = resp.entry;
    }

    if (offset + concurrency < addresses.length) {
      await sleep(CHUNK_PAUSE_MS);
    }
  }
  return { blocked: false, results, rateLimited: false };
}

async function fetchBlockcypher(provider, addresses, timeoutMs, schedule) {
  const root = provider.baseUrl.replace(/\/$/, '');
  const joined = addresses.join(';');
  let resp;
  try {
    resp = await schedule(() => httpGet(`${root}/${joined}/balance`, timeoutMs));
  } catch {
    return { blocked: false, results: {}, rateLimited: false };
  }

  if (isCloudflareBlocked(resp)) {
    return { blocked: true, results: {}, rateLimited: false };
  }
  if (isRateLimited(resp)) {
    return { blocked: false, results: {}, rateLimited: true };
  }

  const results = {};
  if (Array.isArray(resp.data)) {
    addresses.forEach((addr, idx) => {
      const entry = entryFromBlockcypher(addr, resp.data[idx]);
      if (entry) results[addr] = entry;
    });
    return { blocked: false, results, rateLimited: false };
  }

  if (addresses.length === 1 && resp.status === 200) {
    const entry = entryFromBlockcypher(addresses[0], resp.data);
    if (entry) results[addresses[0]] = entry;
    return { blocked: false, results, rateLimited: false };
  }

  if (resp.status === 404 && addresses.length === 1) {
    results[addresses[0]] = {
      balance: 0n, address: addresses[0], nTx: 0,
      totalReceived: 0, totalSent: 0, provider: 'blockcypher',
    };
    return { blocked: false, results, rateLimited: false };
  }

  return { blocked: false, results, rateLimited: false, httpStatus: resp.status };
}

async function fetchBlockbook(provider, addresses, timeoutMs, schedule) {
  const root = provider.baseUrl;
  return schedule(() => fetchParallelSingle(provider.name, addresses, timeoutMs, async (addr) => {
    const resp = await httpGet(blockbookAddressUrl(root, addr), timeoutMs);
    return {
      status: resp.status,
      entry: entryFromBlockbook(addr, resp.data, provider.name),
    };
  }));
}

async function fetchWithProvider(provider, addresses, timeoutMs, schedule) {
  switch (provider.name) {
    case 'blockcypher':
      return fetchBlockcypher(provider, addresses, timeoutMs, schedule);
    case 'alchemy':
    case 'atomicwallet':
      return fetchBlockbook(provider, addresses, timeoutMs, schedule);
    default:
      return { blocked: false, results: {}, rateLimited: false, httpStatus: 'unknown_provider' };
  }
}

export async function queryDogecoinBalances({
  baseUrl,
  addresses,
  timeoutMs = 3000,
  onLog = () => {},
  schedule = (fn) => fn(),
  maxRetries = 3,
}) {
  if (!addresses.length) return {};

  const providers = buildProviderChain(baseUrl);
  const final = {};
  let pending = [...addresses];

  for (const provider of providers) {
    if (!pending.length) break;

    onLog(`📡 [${provider.name}] Consultando ${pending.length} endereço(s)...`);
    let blocked = false;

    while (pending.length && !blocked) {
      const chunkSize = provider.name === 'blockcypher'
        ? Math.min(pending.length, 20)
        : pending.length;
      const chunk = pending.slice(0, chunkSize);
      let outcome = null;

      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        outcome = await fetchWithProvider(provider, chunk, timeoutMs, schedule);

        if (outcome.blocked) {
          onLog(`⚠️ [${provider.name}] Bloqueado — tentando próximo provedor...`);
          blocked = true;
          break;
        }

        if (outcome.rateLimited) {
          const waitMs = Math.min(10000 * attempt, 60000);
          onLog(`⚠️ [${provider.name}] Rate limit (tentativa ${attempt}/${maxRetries}). Aguardando ${waitMs / 1000}s...`);
          await sleep(waitMs);
          continue;
        }

        break;
      }

      if (blocked) break;

      if (!outcome || outcome.rateLimited) {
        onLog(`⚠️ [${provider.name}] Indisponível — tentando próximo provedor...`);
        break;
      }

      if (!Object.keys(outcome.results).length) {
        onLog(`⚠️ [${provider.name}] Sem resposta — tentando próximo provedor...`);
        break;
      }

      Object.assign(final, outcome.results);
      pending = pending.filter((addr) => !final[addr]);

      if (provider.name !== 'blockcypher') break;
    }

    pending = addresses.filter((addr) => !final[addr]);
  }

  const unresolved = addresses.filter((addr) => !final[addr]);
  if (unresolved.length > 0) {
    onLog(`⚠️ [Dogecoin] ${unresolved.length}/${addresses.length} endereços sem resposta após todos os provedores`);
  }

  return final;
}

export async function fetchDogecoinAddressBalance(baseUrl, addr, timeoutMs = 3000, schedule = (fn) => fn()) {
  const results = await queryDogecoinBalances({
    baseUrl,
    addresses: [addr],
    timeoutMs,
    schedule,
  });
  const info = results[addr];
  if (!info || info.provider === 'unknown') return null;
  return info.balance;
}

export async function probeDogecoinApi(baseUrl, probeAddr = 'D6X5ogrzSKT3S4bhYHoWGuNATqBX9oCUYL', timeoutMs = 5000) {
  try {
    const results = await queryDogecoinBalances({
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
