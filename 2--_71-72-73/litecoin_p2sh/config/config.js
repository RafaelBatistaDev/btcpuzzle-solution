/**
 * Configuração Litecoin Puzzles 71, 72, 73 — P2SH-P2WPKH (BIP49)
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
    name: 'LTC_PUZZLE_71',
    target: envConfig.LTC_P2SH_TARGET_71 || process.env.LTC_P2SH_TARGET_71 || 'MTUnxx2JHXqEiyzNNKyYives98aJqvmBBf',
    rangeMin:      '0x0000000000000000000000000000000000000000000000400000000000000000',
    rangeMax:      '0x00000000000000000000000000000000000000000000007fffffffffffffffff',
    initialPrivkey:'0x0000000000000000000000000000000000000000000000400000000000000000',
  },
  72: {
    name: 'LTC_PUZZLE_72',
    target: envConfig.LTC_P2SH_TARGET_72 || process.env.LTC_P2SH_TARGET_72 || 'MMfYYqDjxwjKZtPgEFn93bmLDcspjHYQve',
    rangeMin:      '0x0000000000000000000000000000000000000000000000800000000000000000',
    rangeMax:      '0x0000000000000000000000000000000000000000000000ffffffffffffffffff',
    initialPrivkey:'0x0000000000000000000000000000000000000000000000800000000000000000',
  },
  73: {
    name: 'LTC_PUZZLE_73',
    target: envConfig.LTC_P2SH_TARGET_73 || process.env.LTC_P2SH_TARGET_73 || 'MMDkJh4qpqGiNyMFaiV2hiezNdc7N1Kxp2',
    rangeMin:      '0x0000000000000000000000000000000000000000000001000000000000000000',
    rangeMax:      '0x0000000000000000000000000000000000000000000001ffffffffffffffffff',
    initialPrivkey:'0x0000000000000000000000000000000000000000000001000000000000000000',
  },
};

const baseUrl =
  process.env.LTC_BLOCKCHAIN_INFO_BASE_URL ||
  envConfig.LTC_BLOCKCHAIN_INFO_BASE_URL   ||
  'https://litecoinspace.org';

export const RUNTIME_CONFIG = {
  BLOCKCHAIN_INFO_BASE_URL: baseUrl,
  SEARCH_MODE: 'sequential',
  BATCH_SIZE: Number(
    process.env.LTC_P2SH_BATCH_SIZE || envConfig.LTC_P2SH_BATCH_SIZE ||
    process.env.BATCH_SIZE          || envConfig.BATCH_SIZE          ||
    20
  ),
  DELAY_MS: Number(
    process.env.LTC_P2SH_DELAY_MS || envConfig.LTC_P2SH_DELAY_MS ||
    process.env.LTC_DELAY_MS      || envConfig.LTC_DELAY_MS      ||
    process.env.DELAY_MS          || envConfig.DELAY_MS          ||
    2000
  ),
  INITIAL_DELAY_MS: Number(
    process.env.LTC_P2SH_INITIAL_DELAY_MS || envConfig.LTC_P2SH_INITIAL_DELAY_MS ||
    process.env.LTC_INITIAL_DELAY_MS    || envConfig.LTC_INITIAL_DELAY_MS    ||
    0
  ),
  MAX_REQ_24H: Number(
    process.env.LTC_P2SH_MAX_REQ_24H || envConfig.LTC_P2SH_MAX_REQ_24H ||
    process.env.LTC_MAX_REQ_24H    || envConfig.LTC_MAX_REQ_24H    ||
    process.env.MAX_REQ_24H        || envConfig.MAX_REQ_24H        ||
    30000
  ),
  TIMEOUT_MS: Number(
    process.env.LTC_P2SH_TIMEOUT_MS || envConfig.LTC_P2SH_TIMEOUT_MS ||
    process.env.LTC_TIMEOUT_MS      || envConfig.LTC_TIMEOUT_MS      ||
    process.env.TIMEOUT_MS          || envConfig.TIMEOUT_MS          ||
    3000
  ),
  RPC_RETRY_MS: Number(
    process.env.LTC_P2SH_RPC_RETRY_MS || envConfig.LTC_P2SH_RPC_RETRY_MS ||
    process.env.LTC_RPC_RETRY_MS      || envConfig.LTC_RPC_RETRY_MS      ||
    process.env.RPC_RETRY_MS          || envConfig.RPC_RETRY_MS          || 15000
  ),
};

export const ACTIVE_PUZZLES = Object.keys(PUZZLE_CONFIG).map(Number);
