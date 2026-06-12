/**
 * Configuração Bitcoin Puzzles 71, 72, 73 — P2SH-P2WPKH (BIP49)
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

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

export const PUZZLE_CONFIG = {
  71: {
    name: 'BTC_PUZZLE_71',
    target: envConfig.BTC_P2SH_TARGET_71 || process.env.BTC_P2SH_TARGET_71 || '3...',
    // 2^70 .. 2^71-1
    rangeMin:      '0x0000000000000000000000000000000000000000000000400000000000000000',
    rangeMax:      '0x00000000000000000000000000000000000000000000007fffffffffffffffff',
    initialPrivkey:'0x0000000000000000000000000000000000000000000000400000000000000000',
  },
  72: {
    name: 'BTC_PUZZLE_72',
    target: envConfig.BTC_P2SH_TARGET_72 || process.env.BTC_P2SH_TARGET_72 || '3...',
    // 2^71 .. 2^72-1
    rangeMin:      '0x0000000000000000000000000000000000000000000000800000000000000000',
    rangeMax:      '0x0000000000000000000000000000000000000000000000ffffffffffffffffff',
    initialPrivkey:'0x0000000000000000000000000000000000000000000000800000000000000000',
  },
  73: {
    name: 'BTC_PUZZLE_73',
    target: envConfig.BTC_P2SH_TARGET_73 || process.env.BTC_P2SH_TARGET_73 || '3...',
    // 2^72 .. 2^73-1
    rangeMin:      '0x0000000000000000000000000000000000000000000001000000000000000000',
    rangeMax:      '0x0000000000000000000000000000000000000000000001ffffffffffffffffff',
    initialPrivkey:'0x0000000000000000000000000000000000000000000001000000000000000000',
  },
};

// Detecta qual API está configurada
const baseUrl =
  process.env.BLOCKCHAIN_INFO_BASE_URL ||
  envConfig.BLOCKCHAIN_INFO_BASE_URL   ||
  'https://blockchain.info';

const isAlchemy = baseUrl.includes('alchemy.com');

export const RUNTIME_CONFIG = {
  BLOCKCHAIN_INFO_BASE_URL: baseUrl,
  SEARCH_MODE: 'sequential',
  BATCH_SIZE: Number(
    process.env.BTC_P2SH_BATCH_SIZE || envConfig.BTC_P2SH_BATCH_SIZE ||
    process.env.BTC_BATCH_SIZE        || envConfig.BTC_BATCH_SIZE        ||
    process.env.BATCH_SIZE            || envConfig.BATCH_SIZE            ||
    20
  ),
  DELAY_MS: Number(
    process.env.BTC_P2SH_DELAY_MS     || envConfig.BTC_P2SH_DELAY_MS     ||
    process.env.BTC_DELAY_MS          || envConfig.BTC_DELAY_MS          ||
    process.env.BTC_PUBLIC_API_DELAY_MS || envConfig.BTC_PUBLIC_API_DELAY_MS ||
    process.env.DELAY_MS              || envConfig.DELAY_MS              ||
    (isAlchemy ? 100 : 2000)
  ),
  INITIAL_DELAY_MS: Number(
    process.env.BTC_P2SH_INITIAL_DELAY_MS || envConfig.BTC_P2SH_INITIAL_DELAY_MS ||
    process.env.BTC_INITIAL_DELAY_MS    || envConfig.BTC_INITIAL_DELAY_MS    ||
    0
  ),
  MAX_REQ_24H: Number(
    process.env.BTC_P2SH_MAX_REQ_24H || envConfig.BTC_P2SH_MAX_REQ_24H ||
    process.env.BTC_MAX_REQ_24H        || envConfig.BTC_MAX_REQ_24H        ||
    process.env.MAX_REQ_24H            || envConfig.MAX_REQ_24H            ||
    (isAlchemy ? 500000 : 30000)
  ),
  TIMEOUT_MS: Number(
    process.env.BTC_P2SH_TIMEOUT_MS || envConfig.BTC_P2SH_TIMEOUT_MS ||
    process.env.BTC_TIMEOUT_MS        || envConfig.BTC_TIMEOUT_MS        ||
    process.env.TIMEOUT_MS            || envConfig.TIMEOUT_MS            ||
    (isAlchemy ? 10000 : 3000)
  ),
  RPC_RETRY_MS: Number(
    process.env.BTC_P2SH_RPC_RETRY_MS || envConfig.BTC_P2SH_RPC_RETRY_MS ||
    process.env.BTC_RPC_RETRY_MS      || envConfig.BTC_RPC_RETRY_MS      ||
    process.env.RPC_RETRY_MS        || envConfig.RPC_RETRY_MS        || 15000
  ),
};

// Todos os 3 puzzles sempre ativos
export const ACTIVE_PUZZLES = Object.keys(PUZZLE_CONFIG).map(Number);
