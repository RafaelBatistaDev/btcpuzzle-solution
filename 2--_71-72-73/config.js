/**
 * ========================================
 * CONFIG CENTRALIZADO - Carregamento e Validação de .env
 * ========================================
 * 
 * Este arquivo centraliza TODAS as configurações e as valida automaticamente
 * Pode ser importado em qualquer solver ou script JS
 * 
 * Uso:
 *   import config from './config.js';
 *   
 *   // Agora acesse direto:
 *   const rpcUrl = config.RPC_ENDPOINT;
 *   const target = config.ETH_TARGET_72;
 *   const batchSize = config.BATCH_SIZE;
 *   
 *   // Todas as variáveis já estão validadas e parseadas
 */

import * as fs from 'fs';
import * as path from 'path';

// ========================================
// CARREGAR .env (Nativo para ES Modules)
// ========================================
function loadEnvFile() {
  const envPath = path.resolve(process.cwd(), '.env');
  if (!fs.existsSync(envPath)) {
    throw new Error(`❌ Arquivo .env não encontrado em: ${envPath}`);
  }

  const content = fs.readFileSync(envPath, 'utf-8');
  const lines = content.split('\n');

  lines.forEach((line) => {
    if (!line || line.startsWith('#')) return;
    const [key, ...valueParts] = line.split('=');
    const trimmedKey = key.trim();
    const value = valueParts.join('=').trim();

    if (trimmedKey && value) {
      const cleanValue = value.replace(/^["']|["']$/g, '');
      if (process.env[trimmedKey] === undefined) {
        process.env[trimmedKey] = cleanValue;
      }
    }
  });
}

// ========================================
// FUNÇÃO DE VALIDAÇÃO
// ========================================
function isValidUrl(url, fieldName) {
  if (!url || typeof url !== 'string') {
    throw new Error(`❌ ${fieldName} está vazia ou undefined`);
  }

  const placeholders = ['YOUR_API_KEY', 'your_api_key', 'YOUR_KEY', 'SUBSTITUIR', 'COLOQUE', 'CONFIGURE', '{}', '{{}}'];
  if (placeholders.some(p => url.includes(p)) || url === '') {
    throw new Error(`❌ ${fieldName} contém placeholder ou é inválida: "${url}"`);
  }

  try {
    new URL(url);
  } catch (e) {
    throw new Error(`❌ ${fieldName} não é uma URL válida: "${url}"`);
  }
}

function isValidApiKey(key, fieldName) {
  if (!key || typeof key !== 'string') {
    throw new Error(`❌ ${fieldName} está vazia ou undefined`);
  }

  const placeholders = ['YOUR_API_KEY', 'your_api_key', 'YOUR_KEY', 'YourApiKeyToken', 'SUBSTITUIR', 'COLOQUE', 'CONFIGURE', '{}', '{{}}'];
  if (placeholders.some(p => key.includes(p)) || key === '') {
    throw new Error(`❌ ${fieldName} contém placeholder ou é inválida: "${key}"`);
  }
}

function isValidInteger(value, fieldName, min = 0) {
  const num = parseInt(value, 10);
  if (isNaN(num) || num < min) {
    throw new Error(`❌ ${fieldName} deve ser número inteiro >= ${min}, recebido: "${value}"`);
  }
  return num;
}

function isValidAddress(address, fieldName, type = 'ethereum') {
  if (!address || typeof address !== 'string') {
    throw new Error(`❌ ${fieldName} está vazia ou undefined`);
  }

  if (type === 'ethereum' || type === 'polygon' || type === 'bnb') {
    if (!address.startsWith('0x') || address.length !== 42) {
      throw new Error(`❌ ${fieldName} deve ser endereço Ethereum válido (42 chars com 0x): "${address}"`);
    }
    if (!/^0x[0-9a-fA-F]{40}$/.test(address)) {
      throw new Error(`❌ ${fieldName} contém caracteres inválidos: "${address}"`);
    }
  } else if (type === 'solana') {
    if (address.length < 40 || address.length > 50) {
      throw new Error(`❌ ${fieldName} não parece um endereço Solana válido: "${address}"`);
    }
    if (/[0OIl]/.test(address)) {
      throw new Error(`❌ ${fieldName} contém caracteres inválidos em base58: "${address}"`);
    }
  }
}

// ========================================
// CARREGAR E VALIDAR CONFIGURAÇÃO
// ========================================
function initializeConfig() {
  try {
    loadEnvFile();

    // Validar puzzle ID
    const PUZZLE_ID = process.env.PUZZLE_ID;
    if (!['71', '72', '73'].includes(PUZZLE_ID)) {
      throw new Error(`❌ PUZZLE_ID deve ser 71, 72 ou 73, recebido: "${PUZZLE_ID}"`);
    }

    // Validar runtime settings
    const BATCH_SIZE = isValidInteger(process.env.BATCH_SIZE, 'BATCH_SIZE', 1);
    const DELAY_MS = isValidInteger(process.env.DELAY_MS, 'DELAY_MS', 0);
    const MAX_REQ_24H = isValidInteger(process.env.MAX_REQ_24H, 'MAX_REQ_24H', 1);
    const TIMEOUT_MS = isValidInteger(process.env.TIMEOUT_MS, 'TIMEOUT_MS', 1);
    const SEARCH_MODE = process.env.SEARCH_MODE;
    if (SEARCH_MODE !== 'sequential') {
      throw new Error(`❌ SEARCH_MODE deve ser 'sequential', recebido: "${SEARCH_MODE}"`);
    }

    // Validar Bitcoin (opcional)
    if (process.env.BLOCKCHAIN_INFO_BASE_URL) {
      isValidUrl(process.env.BLOCKCHAIN_INFO_BASE_URL, 'BLOCKCHAIN_INFO_BASE_URL');
    }

    const BTC_DELAY_MS = isValidInteger(process.env.BTC_DELAY_MS || '460', 'BTC_DELAY_MS', 0);

    const BTC_P2PKH_BATCH_SIZE = isValidInteger(process.env.BTC_P2PKH_BATCH_SIZE || process.env.BTC_BATCH_SIZE || '20', 'BTC_P2PKH_BATCH_SIZE', 1);
    const BTC_P2PKH_DELAY_MS = isValidInteger(process.env.BTC_P2PKH_DELAY_MS || process.env.BTC_DELAY_MS || '460', 'BTC_P2PKH_DELAY_MS', 0);
    const BTC_P2PKH_INITIAL_DELAY_MS = isValidInteger(process.env.BTC_P2PKH_INITIAL_DELAY_MS || process.env.BTC_INITIAL_DELAY_MS || '0', 'BTC_P2PKH_INITIAL_DELAY_MS', 0);
    const BTC_P2PKH_MAX_REQ_24H = isValidInteger(process.env.BTC_P2PKH_MAX_REQ_24H || process.env.BTC_MAX_REQ_24H || '90000', 'BTC_P2PKH_MAX_REQ_24H', 1);
    const BTC_P2PKH_TIMEOUT_MS = isValidInteger(process.env.BTC_P2PKH_TIMEOUT_MS || process.env.BTC_TIMEOUT_MS || '3000', 'BTC_P2PKH_TIMEOUT_MS', 1);

    const BTC_P2WPKH_BATCH_SIZE = isValidInteger(process.env.BTC_P2WPKH_BATCH_SIZE || process.env.BTC_BATCH_SIZE || '20', 'BTC_P2WPKH_BATCH_SIZE', 1);
    const BTC_P2WPKH_DELAY_MS = isValidInteger(process.env.BTC_P2WPKH_DELAY_MS || process.env.BTC_DELAY_MS || '460', 'BTC_P2WPKH_DELAY_MS', 0);
    const BTC_P2WPKH_INITIAL_DELAY_MS = isValidInteger(process.env.BTC_P2WPKH_INITIAL_DELAY_MS || process.env.BTC_INITIAL_DELAY_MS || '0', 'BTC_P2WPKH_INITIAL_DELAY_MS', 0);
    const BTC_P2WPKH_MAX_REQ_24H = isValidInteger(process.env.BTC_P2WPKH_MAX_REQ_24H || process.env.BTC_MAX_REQ_24H || '90000', 'BTC_P2WPKH_MAX_REQ_24H', 1);
    const BTC_P2WPKH_TIMEOUT_MS = isValidInteger(process.env.BTC_P2WPKH_TIMEOUT_MS || process.env.BTC_TIMEOUT_MS || '3000', 'BTC_P2WPKH_TIMEOUT_MS', 1);

    const BTC_P2SH_BATCH_SIZE = isValidInteger(process.env.BTC_P2SH_BATCH_SIZE || process.env.BTC_BATCH_SIZE || '20', 'BTC_P2SH_BATCH_SIZE', 1);
    const BTC_P2SH_DELAY_MS = isValidInteger(process.env.BTC_P2SH_DELAY_MS || process.env.BTC_DELAY_MS || '460', 'BTC_P2SH_DELAY_MS', 0);
    const BTC_P2SH_INITIAL_DELAY_MS = isValidInteger(process.env.BTC_P2SH_INITIAL_DELAY_MS || process.env.BTC_INITIAL_DELAY_MS || '0', 'BTC_P2SH_INITIAL_DELAY_MS', 0);
    const BTC_P2SH_MAX_REQ_24H = isValidInteger(process.env.BTC_P2SH_MAX_REQ_24H || process.env.BTC_MAX_REQ_24H || '90000', 'BTC_P2SH_MAX_REQ_24H', 1);
    const BTC_P2SH_TIMEOUT_MS = isValidInteger(process.env.BTC_P2SH_TIMEOUT_MS || process.env.BTC_TIMEOUT_MS || '3000', 'BTC_P2SH_TIMEOUT_MS', 1);

    // Validar Ethereum
    isValidApiKey(process.env.ETHERSCAN_KEY, 'ETHERSCAN_KEY');
    isValidAddress(process.env.ETH_TARGET_71, 'ETH_TARGET_71', 'ethereum');
    isValidAddress(process.env.ETH_TARGET_72, 'ETH_TARGET_72', 'ethereum');
    isValidAddress(process.env.ETH_TARGET_73, 'ETH_TARGET_73', 'ethereum');
    const ETH_BATCH_SIZE = isValidInteger(process.env.ETH_BATCH_SIZE || '20', 'ETH_BATCH_SIZE', 1);
    const ETH_DELAY_MS = isValidInteger(process.env.ETH_DELAY_MS || '80', 'ETH_DELAY_MS', 0);
    const ETH_INITIAL_DELAY_MS = isValidInteger(process.env.ETH_INITIAL_DELAY_MS || '0', 'ETH_INITIAL_DELAY_MS', 0);
    const ETH_MAX_REQ_24H = isValidInteger(process.env.ETH_MAX_REQ_24H || '500000', 'ETH_MAX_REQ_24H', 1);
    const ETH_TIMEOUT_MS = isValidInteger(process.env.ETH_TIMEOUT_MS || '10000', 'ETH_TIMEOUT_MS', 1);

    // Validar Solana
    isValidUrl(process.env.SOL_RPC_ENDPOINT, 'SOL_RPC_ENDPOINT');
    isValidAddress(process.env.SOL_TARGET_71, 'SOL_TARGET_71', 'solana');
    isValidAddress(process.env.SOL_TARGET_72, 'SOL_TARGET_72', 'solana');
    isValidAddress(process.env.SOL_TARGET_73, 'SOL_TARGET_73', 'solana');
    const SOL_BATCH_SIZE = isValidInteger(process.env.SOL_BATCH_SIZE || '20', 'SOL_BATCH_SIZE', 1);
    const SOL_DELAY_MS = isValidInteger(process.env.SOL_DELAY_MS || '110', 'SOL_DELAY_MS', 0);
    const SOL_INITIAL_DELAY_MS = isValidInteger(process.env.SOL_INITIAL_DELAY_MS || '0', 'SOL_INITIAL_DELAY_MS', 0);
    const SOL_MAX_REQ_24H = isValidInteger(process.env.SOL_MAX_REQ_24H || '33000', 'SOL_MAX_REQ_24H', 1);
    const SOL_TIMEOUT_MS = isValidInteger(process.env.SOL_TIMEOUT_MS || '3000', 'SOL_TIMEOUT_MS', 1);

    // Validar Polygon
    isValidUrl(process.env.POLYGON_RPC_ENDPOINT, 'POLYGON_RPC_ENDPOINT');
    // ✅ VALIDAR POLYGON_API_KEY (obrigatória para queries avançadas)
    isValidUrl(process.env.POLYGON_API_KEY, 'POLYGON_API_KEY');
    isValidAddress(process.env.POLYGON_TARGET_71, 'POLYGON_TARGET_71', 'polygon');
    isValidAddress(process.env.POLYGON_TARGET_72, 'POLYGON_TARGET_72', 'polygon');
    isValidAddress(process.env.POLYGON_TARGET_73, 'POLYGON_TARGET_73', 'polygon');
    const POLYGON_BATCH_SIZE = isValidInteger(process.env.POLYGON_BATCH_SIZE || '20', 'POLYGON_BATCH_SIZE', 1);
    const POLYGON_DELAY_MS = isValidInteger(process.env.POLYGON_DELAY_MS || '300', 'POLYGON_DELAY_MS', 0);
    const POLYGON_INITIAL_DELAY_MS = isValidInteger(process.env.POLYGON_INITIAL_DELAY_MS || '100', 'POLYGON_INITIAL_DELAY_MS', 0);
    const POLYGON_MAX_REQ_24H = isValidInteger(process.env.POLYGON_MAX_REQ_24H || '10000', 'POLYGON_MAX_REQ_24H', 1);
    const POLYGON_TIMEOUT_MS = isValidInteger(process.env.POLYGON_TIMEOUT_MS || '5000', 'POLYGON_TIMEOUT_MS', 1);

    // Validar BNB
    isValidUrl(process.env.BNB_RPC_ENDPOINT, 'BNB_RPC_ENDPOINT');
    if (process.env.BSCSCAN_KEY && process.env.BSCSCAN_KEY !== 'YourApiKeyToken') {
      isValidApiKey(process.env.BSCSCAN_KEY, 'BSCSCAN_KEY');
    }
    isValidAddress(process.env.BNB_TARGET_71, 'BNB_TARGET_71', 'bnb');
    isValidAddress(process.env.BNB_TARGET_72, 'BNB_TARGET_72', 'bnb');
    isValidAddress(process.env.BNB_TARGET_73, 'BNB_TARGET_73', 'bnb');
    const BNB_BATCH_SIZE = isValidInteger(process.env.BNB_BATCH_SIZE || '20', 'BNB_BATCH_SIZE', 1);
    const BNB_DELAY_MS = isValidInteger(process.env.BNB_DELAY_MS || '50', 'BNB_DELAY_MS', 0);
    const BNB_INITIAL_DELAY_MS = isValidInteger(process.env.BNB_INITIAL_DELAY_MS || '100', 'BNB_INITIAL_DELAY_MS', 0);
    const BNB_MAX_REQ_24H = isValidInteger(process.env.BNB_MAX_REQ_24H || '500000', 'BNB_MAX_REQ_24H', 1);
    const BNB_TIMEOUT_MS = isValidInteger(process.env.BNB_TIMEOUT_MS || '10000', 'BNB_TIMEOUT_MS', 1);

    console.log('✅ Configuração carregada e validada com sucesso!\n');

    // Retornar objeto com TODAS as variáveis parseadas e tipadas
    return {
      // Puzzle
      PUZZLE_ID,
      
      // Runtime
      BATCH_SIZE,
      DELAY_MS,
      MAX_REQ_24H,
      TIMEOUT_MS,
      SEARCH_MODE,
      
      // Bitcoin — API compartilhada
      BLOCKCHAIN_INFO_BASE_URL: process.env.BLOCKCHAIN_INFO_BASE_URL,
      BTC_DELAY_MS,

      // Bitcoin P2PKH
      BTC_P2PKH_BATCH_SIZE,
      BTC_P2PKH_DELAY_MS,
      BTC_P2PKH_INITIAL_DELAY_MS,
      BTC_P2PKH_MAX_REQ_24H,
      BTC_P2PKH_TIMEOUT_MS,
      BTC_P2PKH_TARGET_71: process.env.BTC_P2PKH_TARGET_71,
      BTC_P2PKH_TARGET_72: process.env.BTC_P2PKH_TARGET_72,
      BTC_P2PKH_TARGET_73: process.env.BTC_P2PKH_TARGET_73,

      // Bitcoin P2WPKH
      BTC_P2WPKH_BATCH_SIZE,
      BTC_P2WPKH_DELAY_MS,
      BTC_P2WPKH_INITIAL_DELAY_MS,
      BTC_P2WPKH_MAX_REQ_24H,
      BTC_P2WPKH_TIMEOUT_MS,
      BTC_P2WPKH_TARGET_71: process.env.BTC_P2WPKH_TARGET_71,
      BTC_P2WPKH_TARGET_72: process.env.BTC_P2WPKH_TARGET_72,
      BTC_P2WPKH_TARGET_73: process.env.BTC_P2WPKH_TARGET_73,

      // Bitcoin P2SH-P2WPKH
      BTC_P2SH_BATCH_SIZE,
      BTC_P2SH_DELAY_MS,
      BTC_P2SH_INITIAL_DELAY_MS,
      BTC_P2SH_MAX_REQ_24H,
      BTC_P2SH_TIMEOUT_MS,
      BTC_P2SH_TARGET_71: process.env.BTC_P2SH_TARGET_71,
      BTC_P2SH_TARGET_72: process.env.BTC_P2SH_TARGET_72,
      BTC_P2SH_TARGET_73: process.env.BTC_P2SH_TARGET_73,
      
      // Ethereum
      RPC_ENDPOINT: 'https://api.etherscan.io/v2/api',
      ETHERSCAN_KEY: process.env.ETHERSCAN_KEY,
      ETH_TARGET_71: process.env.ETH_TARGET_71,
      ETH_TARGET_72: process.env.ETH_TARGET_72,
      ETH_TARGET_73: process.env.ETH_TARGET_73,
      ETH_BATCH_SIZE,
      ETH_DELAY_MS,
      ETH_INITIAL_DELAY_MS,
      ETH_MAX_REQ_24H,
      ETH_TIMEOUT_MS,
      
      // Solana
      SOL_RPC_ENDPOINT: process.env.SOL_RPC_ENDPOINT,
      SOL_BATCH_SIZE,
      SOL_DELAY_MS,
      SOL_INITIAL_DELAY_MS,
      SOL_MAX_REQ_24H,
      SOL_TIMEOUT_MS,
      SOL_TARGET_71: process.env.SOL_TARGET_71,
      SOL_TARGET_72: process.env.SOL_TARGET_72,
      SOL_TARGET_73: process.env.SOL_TARGET_73,
      
      // Polygon
      POLYGON_RPC_ENDPOINT: process.env.POLYGON_RPC_ENDPOINT,
      POLYGON_API_KEY: process.env.POLYGON_API_KEY,
      POLYGON_TARGET_71: process.env.POLYGON_TARGET_71,
      POLYGON_TARGET_72: process.env.POLYGON_TARGET_72,
      POLYGON_TARGET_73: process.env.POLYGON_TARGET_73,
      POLYGON_BATCH_SIZE,
      POLYGON_DELAY_MS,
      POLYGON_INITIAL_DELAY_MS,
      POLYGON_MAX_REQ_24H,
      POLYGON_TIMEOUT_MS,
      
      // BNB
      BNB_RPC_ENDPOINT: process.env.BNB_RPC_ENDPOINT,
      BSCSCAN_KEY: process.env.BSCSCAN_KEY,
      BNB_TARGET_71: process.env.BNB_TARGET_71,
      BNB_TARGET_72: process.env.BNB_TARGET_72,
      BNB_TARGET_73: process.env.BNB_TARGET_73,
      BNB_BATCH_SIZE,
      BNB_DELAY_MS,
      BNB_INITIAL_DELAY_MS,
      BNB_MAX_REQ_24H,
      BNB_TIMEOUT_MS,
    };
  } catch (error) {
    console.error('\n❌ ERRO AO CARREGAR CONFIGURAÇÃO:\n');
    console.error(error.message);
    console.error('\n⚠️  Verifique seu arquivo .env e corrija os erros acima.\n');
    process.exit(1);
  }
}

// Inicializar e exportar configuração
const config = initializeConfig();
export default config;
