/**
 * Cliente Dogecoin unificado — AtomicWallet, Blockcypher (batch), Chain.so.
 */
import axios from 'axios';

export const DOGE_DEFAULT_API_URL = 'https://dogecoin.atomicwallet.io/api/v1/address';
export const DOGE_BLOCKCYPHER_URL = 'https://api.blockcypher.com/v1/doge/main/addrs';

const USER_AGENT = 'Puzzle-Solver/1.0';

export function detectDogecoinProvider(baseUrl) {
  const url = (baseUrl || '').toLowerCase();
  if (url.includes('blockcypher.com')) return 'blockcypher';
  if (url.includes('chain.so')) return 'chainso';
  if (url.includes('atomicwallet.io')) return 'atomicwallet';
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
    nTx: balance > 0n ? 1 : 0,
    totalReceived: 0,
    totalSent: 0,
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
  const primary = detectDogecoinProvider(baseUrl);
  const chain = [];

  if (primary !== 'unknown') chain.push({ name: primary, baseUrl });
  for (const fallback of [
    { name: 'atomicwallet', baseUrl: DOGE_DEFAULT_API_URL },
    { name: 'blockcypher', baseUrl: DOGE_BLOCKCYPHER_URL },
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

async function fetchAtomicwallet(_provider, addresses, timeoutMs, schedule) {
  const results = {};
  for (const addr of addresses) {
    let resp;
    try {
      resp = await schedule(() => httpGet(`${DOGE_DEFAULT_API_URL}/${addr}`, timeoutMs));
    } catch {
      continue;
    }
    if (resp.status === 404) {
      results[addr] = {
        balance: 0n, address: addr, nTx: 0,
        totalReceived: 0, totalSent: 0, provider: 'atomicwallet',
      };
      continue;
    }
    if (resp.status !== 200) continue;
    const entry = entryFromAtomicwallet(addr, resp.data);
    if (entry) results[addr] = entry;
  }
  return { blocked: false, results, rateLimited: false };
}

async function fetchChainSo(provider, addresses, timeoutMs, schedule) {
  const results = {};
  const headers = provider.apiKey ? { 'API-KEY': provider.apiKey } : {};

  for (const addr of addresses) {
    let resp;
    try {
      resp = await schedule(() => httpGet(
        `${provider.baseUrl.replace(/\/$/, '')}/balance/DOGE/${addr}`,
        timeoutMs,
        headers,
      ));
    } catch {
      continue;
    }
    if (resp.status === 401 || resp.status === 429) {
      return { blocked: false, results: {}, rateLimited: resp.status === 429 };
    }
    if (resp.status !== 200) continue;
    const entry = entryFromChainSo(addr, resp.data);
    if (entry) results[addr] = entry;
  }

  return { blocked: false, results, rateLimited: false };
}

async function fetchWithProvider(provider, addresses, timeoutMs, schedule) {
  switch (provider.name) {
    case 'blockcypher':
      return fetchBlockcypher(provider, addresses, timeoutMs, schedule);
    case 'atomicwallet':
      return fetchAtomicwallet(provider, addresses, timeoutMs, schedule);
    case 'chainso':
      return fetchChainSo(provider, addresses, timeoutMs, schedule);
    default:
      return { blocked: false, results: {}, rateLimited: false, httpStatus: 'unknown_provider' };
  }
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export async function queryDogecoinBalances({
  baseUrl,
  addresses,
  timeoutMs = 3000,
  chainSoApiKey = null,
  onLog = () => {},
  schedule = (fn) => fn(),
  maxRetries = 4,
}) {
  if (!addresses.length) return {};

  const providers = buildProviderChain(baseUrl, chainSoApiKey);
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
          onLog(`⚠️ [${provider.name}] Bloqueado por Cloudflare — tentando próximo provedor...`);
          blocked = true;
          break;
        }

        if (outcome.rateLimited) {
          const waitMs = Math.min(15000 * attempt, 90000);
          onLog(`⚠️ [${provider.name}] Rate limit (tentativa ${attempt}/${maxRetries}). Aguardando ${waitMs / 1000}s...`);
          await sleep(waitMs);
          continue;
        }

        break;
      }

      if (blocked) break;

      if (!outcome || outcome.rateLimited) {
        onLog(`⚠️ [${provider.name}] Indisponível após ${maxRetries} tentativas — tentando próximo provedor...`);
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

export async function fetchDogecoinAddressBalance(baseUrl, addr, timeoutMs = 3000, chainSoApiKey = null, schedule = (fn) => fn()) {
  const results = await queryDogecoinBalances({
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
