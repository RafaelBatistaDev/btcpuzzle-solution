/**
 * Configuração Ethereum Puzzles 71, 72, 73
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
    name: 'ETH_PUZZLE_71',
    target: envConfig.ETH_TARGET_71 || process.env.ETH_TARGET_71 || '0x00000000219ab540356cBB839Cbe05303d7705Fa',
    rangeMin: '0x0000000000000000000000000000000000000000000000400000000000000000',
    rangeMax: '0x00000000000000000000000000000000000000000000007fffffffffffffffff',
    initialPrivkey: '0x0000000000000000000000000000000000000000000000400000000000000000',
  },
  72: {
    name: 'ETH_PUZZLE_72',
    target: envConfig.ETH_TARGET_72 || process.env.ETH_TARGET_72 || '0xBE0eB53F46cd790Cd13851d5EFf43D12404d33E8',
    rangeMin: '0x0000000000000000000000000000000000000000000000800000000000000000',
    rangeMax: '0x0000000000000000000000000000000000000000000000ffffffffffffffffff',
    initialPrivkey: '0x0000000000000000000000000000000000000000000000800000000000000000',
  },
  73: {
    name: 'ETH_PUZZLE_73',
    target: envConfig.ETH_TARGET_73 || process.env.ETH_TARGET_73 || '0x40B38765696e3d5d8d9d834D8AaD4bB6e418E489',
    rangeMin: '0x0000000000000000000000000000000000000000000001000000000000000000',
    rangeMax: '0x00000000000000000000000000000000000000000001ffffffffffffffffff',
    initialPrivkey: '0x0000000000000000000000000000000000000000000001000000000000000000',
  },
};

// Detecta qual API está configurada
const rpcEndpoint = process.env.ETH_RPC_ENDPOINT
  || envConfig.ETH_RPC_ENDPOINT
  || 'https://api.etherscan.io/v2/api';

const isEtherscan = rpcEndpoint.includes('etherscan.io');
const isAlchemy   = rpcEndpoint.includes('alchemy.com');
// dRPC ou qualquer outro: nem Etherscan nem Alchemy

export const RUNTIME_CONFIG = {
  RPC_ENDPOINT:  rpcEndpoint,
  ETHERSCAN_KEY: envConfig.ETHERSCAN_KEY || process.env.ETHERSCAN_KEY || 'YourApiKeyToken',
  SEARCH_MODE:   'sequential',

  // ETH_BATCH_SIZE isolado — não conflita com BATCH_SIZE das outras chains
  BATCH_SIZE: Number(
    process.env.ETH_BATCH_SIZE || envConfig.ETH_BATCH_SIZE ||
    process.env.BATCH_SIZE     || envConfig.BATCH_SIZE     || 20
  ),

  // Etherscan: 200ms | Alchemy/dRPC: 50ms
  DELAY_MS: Number(
    process.env.ETH_DELAY_MS || envConfig.ETH_DELAY_MS ||
    process.env.DELAY_MS     || envConfig.DELAY_MS     ||
    (isEtherscan ? 200 : 50)
  ),

  INITIAL_DELAY_MS: Number(
    process.env.ETH_INITIAL_DELAY_MS || envConfig.ETH_INITIAL_DELAY_MS || 0
  ),

  // Etherscan: 100k/dia | Alchemy/dRPC: 500k/dia
  MAX_REQ_24H: Number(
    process.env.ETH_MAX_REQ_24H || envConfig.ETH_MAX_REQ_24H ||
    process.env.MAX_REQ_24H     || envConfig.MAX_REQ_24H     ||
    (isEtherscan ? 100000 : 500000)
  ),

  TIMEOUT_MS: Number(
    process.env.ETH_TIMEOUT_MS || envConfig.ETH_TIMEOUT_MS ||
    process.env.TIMEOUT_MS     || envConfig.TIMEOUT_MS     || 10000
  ),
  RPC_RETRY_MS: Number(
    process.env.ETH_RPC_RETRY_MS || envConfig.ETH_RPC_RETRY_MS ||
    process.env.RPC_RETRY_MS     || envConfig.RPC_RETRY_MS     || 15000
  ),
};

// Todos os 3 puzzles sempre ativos
export const ACTIVE_PUZZLES = Object.values(PUZZLE_CONFIG);