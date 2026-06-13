/**
 * Configuração Dogecoin Puzzles 71, 72, 73 — P2PKH (BIP44)
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { DOGE_P2PKH_REGEX } from './utils.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function loadEnv() {
  const envPath = path.join(__dirname, '..', '..', '.env');
  const env = {};

  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, 'utf-8');
    content.split('\n').forEach(line => {
      const [key, ...valueParts] = line.split('=');
      if (key && !key.startsWith('#')) {
        const val = valueParts.join('=').trim();
        env[key.trim()] = val.replace(/^["']|["']$/g, '');
      }
    });
  }

  return env;
}

const envConfig = loadEnv();

function resolveTarget(key) {
  const addr = envConfig[key] || process.env[key] || '';
  if (addr && !DOGE_P2PKH_REGEX.test(addr)) {
    throw new Error(`❌ ${key} deve ser endereço Dogecoin P2PKH (começa com D): "${addr}"`);
  }
  return addr;
}

export const PUZZLE_CONFIG = {
  71: {
    name: 'DOGE_PUZZLE_71',
    target: resolveTarget('DOGE_P2PKH_TARGET_71'),
    rangeMin:      '0x0000000000000000000000000000000000000000000000400000000000000000',
    rangeMax:      '0x00000000000000000000000000000000000000000000007fffffffffffffffff',
    initialPrivkey:'0x0000000000000000000000000000000000000000000000400000000000000000',
  },
  72: {
    name: 'DOGE_PUZZLE_72',
    target: resolveTarget('DOGE_P2PKH_TARGET_72'),
    rangeMin:      '0x0000000000000000000000000000000000000000000000800000000000000000',
    rangeMax:      '0x0000000000000000000000000000000000000000000000ffffffffffffffffff',
    initialPrivkey:'0x0000000000000000000000000000000000000000000000800000000000000000',
  },
  73: {
    name: 'DOGE_PUZZLE_73',
    target: resolveTarget('DOGE_P2PKH_TARGET_73'),
    rangeMin:      '0x0000000000000000000000000000000000000000000001000000000000000000',
    rangeMax:      '0x0000000000000000000000000000000000000000000001ffffffffffffffffff',
    initialPrivkey:'0x0000000000000000000000000000000000000000000001000000000000000000',
  },
};

const baseUrl =
  process.env.DOGE_BLOCKCHAIN_INFO_BASE_URL ||
  envConfig.DOGE_BLOCKCHAIN_INFO_BASE_URL   ||
  'https://dogecoin.atomicwallet.io/api/v2/address';

export const RUNTIME_CONFIG = {
  BLOCKCHAIN_INFO_BASE_URL: baseUrl,
  SEARCH_MODE: 'sequential',
  BATCH_SIZE: Number(
    process.env.DOGE_P2PKH_BATCH_SIZE || envConfig.DOGE_P2PKH_BATCH_SIZE ||
    process.env.BATCH_SIZE            || envConfig.BATCH_SIZE            ||
    20
  ),
  DELAY_MS: Number(
    process.env.DOGE_P2PKH_DELAY_MS || envConfig.DOGE_P2PKH_DELAY_MS ||
    process.env.DOGE_DELAY_MS       || envConfig.DOGE_DELAY_MS       ||
    process.env.DELAY_MS            || envConfig.DELAY_MS            ||
    2000
  ),
  INITIAL_DELAY_MS: Number(
    process.env.DOGE_P2PKH_INITIAL_DELAY_MS || envConfig.DOGE_P2PKH_INITIAL_DELAY_MS ||
    process.env.DOGE_INITIAL_DELAY_MS       || envConfig.DOGE_INITIAL_DELAY_MS       ||
    0
  ),
  MAX_REQ_24H: Number(
    process.env.DOGE_P2PKH_MAX_REQ_24H || envConfig.DOGE_P2PKH_MAX_REQ_24H ||
    process.env.DOGE_MAX_REQ_24H       || envConfig.DOGE_MAX_REQ_24H       ||
    process.env.MAX_REQ_24H            || envConfig.MAX_REQ_24H            ||
    30000
  ),
  TIMEOUT_MS: Number(
    process.env.DOGE_P2PKH_TIMEOUT_MS || envConfig.DOGE_P2PKH_TIMEOUT_MS ||
    process.env.DOGE_TIMEOUT_MS       || envConfig.DOGE_TIMEOUT_MS       ||
    process.env.TIMEOUT_MS            || envConfig.TIMEOUT_MS            ||
    3000
  ),
  RPC_RETRY_MS: Number(
    process.env.DOGE_P2PKH_RPC_RETRY_MS || envConfig.DOGE_P2PKH_RPC_RETRY_MS ||
    process.env.DOGE_RPC_RETRY_MS       || envConfig.DOGE_RPC_RETRY_MS       ||
    process.env.RPC_RETRY_MS            || envConfig.RPC_RETRY_MS            || 15000
  ),
};

export const ACTIVE_PUZZLES = Object.keys(PUZZLE_CONFIG).map(Number);
