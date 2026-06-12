/**
 * Configuração Solana Puzzles 71, 72, 73
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Carrega .env se existir
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
    name: 'SOL_PUZZLE_71',
    target: envConfig.SOL_TARGET_71 || process.env.SOL_TARGET_71 || '4ZJhPQAgUseCsWhKvJLTmmRRUV74fdoTpQLNfKoekbPY',
    rangeMin: '0x0000000000000000000000000000000000000000000000400000000000000000',
    rangeMax: '0x00000000000000000000000000000000000000000000007fffffffffffffffff',
    initialPrivkey: '0x0000000000000000000000000000000000000000000000400000000000000000',
  },
  72: {
    name: 'SOL_PUZZLE_72',
    target: envConfig.SOL_TARGET_72 || process.env.SOL_TARGET_72 || '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM',
    rangeMin: '0x0000000000000000000000000000000000000000000000800000000000000000',
    rangeMax: '0x0000000000000000000000000000000000000000000000ffffffffffffffffff',
    initialPrivkey: '0x0000000000000000000000000000000000000000000000800000000000000000',
  },
  73: {
    name: 'SOL_PUZZLE_73',
    target: envConfig.SOL_TARGET_73 || process.env.SOL_TARGET_73 || '7mhcgF1DVsj5iv4CxZDgp51H6MBBwqamsH1KnqXhSRc5',
    rangeMin: '0x0000000000000000000000000000000000000000000001000000000000000000',
    rangeMax: '0x00000000000000000000000000000000000000000001ffffffffffffffffff',
    initialPrivkey: '0x0000000000000000000000000000000000000000000001000000000000000000',
  },
};

export const RUNTIME_CONFIG = {
  PUZZLE_ID: Number(process.env.SOL_PUZZLE_ID || envConfig.SOL_PUZZLE_ID || process.env.PUZZLE_ID || envConfig.PUZZLE_ID || 72),
  BATCH_SIZE: Number(process.env.SOL_BATCH_SIZE || envConfig.SOL_BATCH_SIZE || process.env.BATCH_SIZE || envConfig.BATCH_SIZE || 1),
  DELAY_MS: Number(process.env.SOL_DELAY_MS || envConfig.SOL_DELAY_MS || process.env.DELAY_MS || envConfig.DELAY_MS || 110),
  BATCH_DELAY_MS: Number(process.env.SOL_BATCH_DELAY_MS || envConfig.SOL_BATCH_DELAY_MS || 110),
  INITIAL_DELAY_MS: Number(process.env.SOL_INITIAL_DELAY_MS || envConfig.SOL_INITIAL_DELAY_MS || 100),
  MAX_REQ_24H: Number(process.env.SOL_MAX_REQ_24H || envConfig.SOL_MAX_REQ_24H || process.env.MAX_REQ_24H || envConfig.MAX_REQ_24H || 30000),
  RPC_ENDPOINT: envConfig.SOL_RPC_ENDPOINT || process.env.SOL_RPC_ENDPOINT || 'https://mainnet.helius-rpc.com/?api-key=YOUR_HELIUS_API_KEY',
  TIMEOUT_MS: Number(process.env.SOL_TIMEOUT_MS || envConfig.SOL_TIMEOUT_MS || process.env.TIMEOUT_MS || envConfig.TIMEOUT_MS || 3000),
  RPC_RETRY_MS: Number(process.env.SOL_RPC_RETRY_MS || envConfig.SOL_RPC_RETRY_MS || process.env.RPC_RETRY_MS || envConfig.RPC_RETRY_MS || 15000),
  SEARCH_MODE: envConfig.SOL_SEARCH_MODE || process.env.SOL_SEARCH_MODE || envConfig.SEARCH_MODE || process.env.SEARCH_MODE || 'sequential',
};

// Puzzles 71, 72, 73 sempre ativos — sem dependência de PUZZLE_ID
export const ACTIVE_PUZZLES = Object.values(PUZZLE_CONFIG);

