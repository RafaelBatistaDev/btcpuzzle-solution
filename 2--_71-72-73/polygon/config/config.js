/**
 * Configuração Polygon Puzzles 71, 72, 73
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
        env[key.trim()] = valueParts.join('=').trim();
      }
    });
  }
  
  return env;
}

const envConfig = loadEnv();

export const PUZZLE_CONFIG = {
  71: {
    name: 'POLYGON_PUZZLE_71',
    target: envConfig.POLYGON_TARGET_71 || process.env.POLYGON_TARGET_71 || '0x00000000219ab540356cBB839Cbe05303d7705Fa',
    rangeMin: '0x0000000000000000000000000000000000000000000000400000000000000000',
    rangeMax: '0x00000000000000000000000000000000000000000000007fffffffffffffffff',
    initialPrivkey: '0x0000000000000000000000000000000000000000000000400000000000000000',
  },
  72: {
    name: 'POLYGON_PUZZLE_72',
    target: envConfig.POLYGON_TARGET_72 || process.env.POLYGON_TARGET_72 || '0xBE0eB53F46cd790Cd13851d5EFf43D12404d33E8',
    rangeMin: '0x0000000000000000000000000000000000000000000000800000000000000000',
    rangeMax: '0x0000000000000000000000000000000000000000000000ffffffffffffffffff',
    initialPrivkey: '0x0000000000000000000000000000000000000000000000800000000000000000',
  },
  73: {
    name: 'POLYGON_PUZZLE_73',
    target: envConfig.POLYGON_TARGET_73 || process.env.POLYGON_TARGET_73 || '0x40B38765696e3d5d8d9d834D8AaD4bB6e418E489',
    rangeMin: '0x0000000000000000000000000000000000000000000001000000000000000000',
    rangeMax: '0x00000000000000000000000000000000000000000001ffffffffffffffffff',
    initialPrivkey: '0x0000000000000000000000000000000000000000000001000000000000000000',
  },
};

export const RUNTIME_CONFIG = {
  // POLYGON_BATCH_SIZE isolado — não conflita com BATCH_SIZE das outras chains
  BATCH_SIZE: Number(process.env.POLYGON_BATCH_SIZE || envConfig.POLYGON_BATCH_SIZE || process.env.BATCH_SIZE || envConfig.BATCH_SIZE || 20),
  DELAY_MS: Number(process.env.POLYGON_DELAY_MS || envConfig.POLYGON_DELAY_MS || process.env.DELAY_MS || envConfig.DELAY_MS || 300),
  INITIAL_DELAY_MS: Number(process.env.POLYGON_INITIAL_DELAY_MS || envConfig.POLYGON_INITIAL_DELAY_MS || 100),
  MAX_REQ_24H: Number(process.env.POLYGON_MAX_REQ_24H || envConfig.POLYGON_MAX_REQ_24H || process.env.MAX_REQ_24H || envConfig.MAX_REQ_24H || 10000),
  RPC_ENDPOINT: envConfig.POLYGON_RPC_ENDPOINT || process.env.POLYGON_RPC_ENDPOINT || 'https://rpc.ankr.com/polygon/YOUR_API_KEY',
  ETHERSCAN_KEY: envConfig.POLYGON_API_KEY || process.env.POLYGON_API_KEY || 'YOUR_API_KEY',
  TIMEOUT_MS: Number(process.env.POLYGON_TIMEOUT_MS || envConfig.POLYGON_TIMEOUT_MS || process.env.TIMEOUT_MS || envConfig.TIMEOUT_MS || 5000),
  SEARCH_MODE: 'sequential',
};

// Puzzles 71, 72, 73 sempre ativos — independente de qualquer configuração
export const ACTIVE_PUZZLES = Object.values(PUZZLE_CONFIG);