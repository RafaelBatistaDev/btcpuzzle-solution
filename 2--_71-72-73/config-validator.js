/**
 * ========================================
 * CONFIG VALIDATOR - Validação Central de .env
 * ========================================
 * 
 * Este módulo valida todas as variáveis do .env antes da execução
 * Detecta URLs inválidas, placeholders não preenchidos e configurações faltantes
 * 
 * Uso:
 *   import { validateConfig, getConfig } from './config-validator.js'
 *   validateConfig() // Valida e lança erro se houver problemas
 *   const config = getConfig() // Retorna todas as variáveis validadas
 * 
 * Execução direta:
 *   node config-validator.js
 *   # ou com Node.js clássico:
 *   node -r dotenv/config config-validator.js
 */

// ========================================
// CARREGAR .env (IMPORTANTE para ES Modules)
// ========================================
import * as fs from 'fs';
import * as path from 'path';

function loadEnvFile() {
  const envPath = path.resolve(process.cwd(), '.env');
  if (!fs.existsSync(envPath)) {
    console.warn('⚠️  Arquivo .env não encontrado em', envPath);
    return;
  }

  const content = fs.readFileSync(envPath, 'utf-8');
  const lines = content.split('\n');

  lines.forEach((line) => {
    // Ignora comentários e linhas vazias
    if (!line || line.startsWith('#')) return;

    const [key, ...valueParts] = line.split('=');
    const trimmedKey = key.trim();
    const value = valueParts.join('=').trim();

    if (trimmedKey && value) {
      // Remove aspas se houver
      const cleanValue = value.replace(/^["']|["']$/g, '');
      process.env[trimmedKey] = cleanValue;
    }
  });
}

// Carrega .env antes de validar
loadEnvFile();

// ========================================
// EXTRAÇÃO E VALIDAÇÃO DE VARIÁVEIS
// ========================================

/**
 * Valida se uma URL é válida (não vazia e não contém placeholders)
 */
function isValidUrl(url, fieldName) {
  if (!url || typeof url !== 'string') {
    return {
      valid: false,
      error: `[ERRO] ${fieldName} está vazia ou undefined`,
    };
  }

  if (
    url.includes('YOUR_API_KEY') ||
    url.includes('your_api_key') ||
    url.includes('YOUR_KEY') ||
    url.includes('your_key') ||
    url.includes('SUBSTITUIR') ||
    url.includes('COLOQUE') ||
    url.includes('CONFIGURE') ||
    url.includes('{}') ||
    url.includes('{{}}') ||
    url === ''
  ) {
    return {
      valid: false,
      error: `[ERRO] ${fieldName} contém placeholder ou é inválida: "${url}"`,
    };
  }

  try {
    new URL(url);
    return { valid: true };
  } catch (e) {
    return {
      valid: false,
      error: `[ERRO] ${fieldName} não é uma URL válida: "${url}" - ${e.message}`,
    };
  }
}

/**
 * Valida se uma chave API é válida (não vazia e não contém placeholders)
 */
function isValidApiKey(key, fieldName) {
  if (!key || typeof key !== 'string') {
    return {
      valid: false,
      error: `[ERRO] ${fieldName} está vazia ou undefined`,
    };
  }

  if (
    key.includes('YOUR_API_KEY') ||
    key.includes('your_api_key') ||
    key.includes('YOUR_KEY') ||
    key.includes('your_key') ||
    key.includes('YourApiKeyToken') ||
    key.includes('SUBSTITUIR') ||
    key.includes('COLOQUE') ||
    key.includes('CONFIGURE') ||
    key.includes('{}') ||
    key.includes('{{}}') ||
    key === ''
  ) {
    return {
      valid: false,
      error: `[ERRO] ${fieldName} contém placeholder ou é inválida: "${key}"`,
    };
  }

  return { valid: true };
}

/**
 * Valida se um número inteiro é válido
 */
function isValidInteger(value, fieldName, min = 0) {
  const num = parseInt(value, 10);
  if (isNaN(num) || num < min) {
    return {
      valid: false,
      error: `[ERRO] ${fieldName} deve ser um número inteiro >= ${min}, recebido: "${value}"`,
    };
  }
  return { valid: true, value: num };
}

/**
 * Valida um endereço (Ethereum/Polygon/BNB: 42 chars com 0x; Bitcoin/Solana: base58)
 */
function isValidAddress(address, fieldName, type = 'ethereum') {
  if (!address || typeof address !== 'string') {
    return {
      valid: false,
      error: `[ERRO] ${fieldName} está vazia ou undefined`,
    };
  }

  if (type === 'ethereum' || type === 'polygon' || type === 'bnb') {
    // Ethereum-compatible: 42 chars, começa com 0x, hex válido
    if (!address.startsWith('0x') || address.length !== 42) {
      return {
        valid: false,
        error: `[ERRO] ${fieldName} deve ser endereço Ethereum válido (42 chars com 0x): "${address}"`,
      };
    }
    if (!/^0x[0-9a-fA-F]{40}$/.test(address)) {
      return {
        valid: false,
        error: `[ERRO] ${fieldName} contém caracteres inválidos (hex esperado): "${address}"`,
      };
    }
  } else if (type === 'bitcoin') {
    // Bitcoin: P2PKH (26-34 chars, começa com 1), P2SH (26-34 chars, começa com 3), P2WPKH (42 chars, começa com bc1)
    const validFormats =
      /^(1[1-9A-HJ-NP-Z]{25,34}|3[1-9A-HJ-NP-Z]{25,34}|bc1[a-z0-9]{39,59})$/.test(
        address
      );
    if (!validFormats) {
      return {
        valid: false,
        error: `[ERRO] ${fieldName} não é um endereço Bitcoin válido: "${address}"`,
      };
    }
  } else if (type === 'solana') {
    // Solana: base58, 44 chars aprox
    if (address.length < 40 || address.length > 50) {
      return {
        valid: false,
        error: `[ERRO] ${fieldName} não parece um endereço Solana válido (44 chars base58 esperado): "${address}"`,
      };
    }
    // Base58 não contém 0, O, I, l
    if (/[0OIl]/.test(address)) {
      return {
        valid: false,
        error: `[ERRO] ${fieldName} contém caracteres inválidos em base58 (0, O, I, l não permitidos): "${address}"`,
      };
    }
  }

  return { valid: true };
}

/**
 * Extrai e valida todas as variáveis do .env
 */
export function validateConfig() {
  const errors = [];

  // ========================================
  // PUZZLE CONFIGURATION
  // ========================================
  const PUZZLE_ID = process.env.PUZZLE_ID;
  if (!['71', '72', '73'].includes(PUZZLE_ID)) {
    errors.push(
      `[ERRO] PUZZLE_ID deve ser 71, 72 ou 73, recebido: "${PUZZLE_ID}"`
    );
  }

  // ========================================
  // RUNTIME SETTINGS
  // ========================================
  const BATCH_SIZE = isValidInteger(process.env.BATCH_SIZE, 'BATCH_SIZE', 1);
  if (!BATCH_SIZE.valid) errors.push(BATCH_SIZE.error);

  const DELAY_MS = isValidInteger(process.env.DELAY_MS, 'DELAY_MS', 0);
  if (!DELAY_MS.valid) errors.push(DELAY_MS.error);

  const MAX_REQ_24H = isValidInteger(process.env.MAX_REQ_24H, 'MAX_REQ_24H', 1);
  if (!MAX_REQ_24H.valid) errors.push(MAX_REQ_24H.error);

  const TIMEOUT_MS = isValidInteger(process.env.TIMEOUT_MS, 'TIMEOUT_MS', 1);
  if (!TIMEOUT_MS.valid) errors.push(TIMEOUT_MS.error);

  const SEARCH_MODE = process.env.SEARCH_MODE;
  if (SEARCH_MODE !== 'sequential') {
    errors.push(`[ERRO] SEARCH_MODE deve ser 'sequential', recebido: "${SEARCH_MODE}"`);
  }

  // ========================================
  // BITCOIN CONFIGURATION
  // ========================================
  if (process.env.ANKR_BTC_BLOCKBOOK_URL) {
    const btcUrl = isValidUrl(
      process.env.ANKR_BTC_BLOCKBOOK_URL,
      'ANKR_BTC_BLOCKBOOK_URL'
    );
    if (!btcUrl.valid) errors.push(btcUrl.error);
  }

  if (process.env.BLOCKBOOK_DELAY_MS) {
    const BLOCKBOOK_DELAY_MS = isValidInteger(
      process.env.BLOCKBOOK_DELAY_MS,
      'BLOCKBOOK_DELAY_MS',
      0
    );
    if (!BLOCKBOOK_DELAY_MS.valid) errors.push(BLOCKBOOK_DELAY_MS.error);
  }

  if (process.env.BLOCKBOOK_TIMEOUT_MS) {
    const BLOCKBOOK_TIMEOUT_MS = isValidInteger(
      process.env.BLOCKBOOK_TIMEOUT_MS,
      'BLOCKBOOK_TIMEOUT_MS',
      1
    );
    if (!BLOCKBOOK_TIMEOUT_MS.valid) errors.push(BLOCKBOOK_TIMEOUT_MS.error);
  }

  // ========================================
  // ETHEREUM CONFIGURATION
  // ========================================
  const ethKey = isValidApiKey(process.env.ETHERSCAN_KEY, 'ETHERSCAN_KEY');
  if (!ethKey.valid) errors.push(ethKey.error);

  const ETH_TARGET_71 = isValidAddress(
    process.env.ETH_TARGET_71,
    'ETH_TARGET_71',
    'ethereum'
  );
  if (!ETH_TARGET_71.valid) errors.push(ETH_TARGET_71.error);

  const ETH_TARGET_72 = isValidAddress(
    process.env.ETH_TARGET_72,
    'ETH_TARGET_72',
    'ethereum'
  );
  if (!ETH_TARGET_72.valid) errors.push(ETH_TARGET_72.error);

  const ETH_TARGET_73 = isValidAddress(
    process.env.ETH_TARGET_73,
    'ETH_TARGET_73',
    'ethereum'
  );
  if (!ETH_TARGET_73.valid) errors.push(ETH_TARGET_73.error);

  const ETH_DELAY_MS = isValidInteger(process.env.ETH_DELAY_MS || '200', 'ETH_DELAY_MS', 0);
  if (!ETH_DELAY_MS.valid) errors.push(ETH_DELAY_MS.error);

  const ETH_INITIAL_DELAY_MS = isValidInteger(process.env.ETH_INITIAL_DELAY_MS || '0', 'ETH_INITIAL_DELAY_MS', 0);
  if (!ETH_INITIAL_DELAY_MS.valid) errors.push(ETH_INITIAL_DELAY_MS.error);

  const ETH_MAX_REQ_24H = isValidInteger(process.env.ETH_MAX_REQ_24H || '100000', 'ETH_MAX_REQ_24H', 1);
  if (!ETH_MAX_REQ_24H.valid) errors.push(ETH_MAX_REQ_24H.error);

  // ========================================
  // SOLANA CONFIGURATION
  // ========================================
  const solUrl = isValidUrl(process.env.SOL_RPC_ENDPOINT, 'SOL_RPC_ENDPOINT');
  if (!solUrl.valid) errors.push(solUrl.error);

  const SOL_DELAY_MS = isValidInteger(process.env.SOL_DELAY_MS, 'SOL_DELAY_MS', 0);
  if (!SOL_DELAY_MS.valid) errors.push(SOL_DELAY_MS.error);

  const SOL_TIMEOUT_MS = isValidInteger(
    process.env.SOL_TIMEOUT_MS,
    'SOL_TIMEOUT_MS',
    1
  );
  if (!SOL_TIMEOUT_MS.valid) errors.push(SOL_TIMEOUT_MS.error);

  const SOL_TARGET_71 = isValidAddress(
    process.env.SOL_TARGET_71,
    'SOL_TARGET_71',
    'solana'
  );
  if (!SOL_TARGET_71.valid) errors.push(SOL_TARGET_71.error);

  const SOL_TARGET_72 = isValidAddress(
    process.env.SOL_TARGET_72,
    'SOL_TARGET_72',
    'solana'
  );
  if (!SOL_TARGET_72.valid) errors.push(SOL_TARGET_72.error);

  const SOL_TARGET_73 = isValidAddress(
    process.env.SOL_TARGET_73,
    'SOL_TARGET_73',
    'solana'
  );
  if (!SOL_TARGET_73.valid) errors.push(SOL_TARGET_73.error);

  // ========================================
  // POLYGON CONFIGURATION
  // ========================================
  const polyUrl = isValidUrl(
    process.env.POLYGON_RPC_ENDPOINT,
    'POLYGON_RPC_ENDPOINT'
  );
  if (!polyUrl.valid) errors.push(polyUrl.error);

  const POLYGON_TARGET_71 = isValidAddress(
    process.env.POLYGON_TARGET_71,
    'POLYGON_TARGET_71',
    'polygon'
  );
  if (!POLYGON_TARGET_71.valid) errors.push(POLYGON_TARGET_71.error);

  const POLYGON_TARGET_72 = isValidAddress(
    process.env.POLYGON_TARGET_72,
    'POLYGON_TARGET_72',
    'polygon'
  );
  if (!POLYGON_TARGET_72.valid) errors.push(POLYGON_TARGET_72.error);

  const POLYGON_TARGET_73 = isValidAddress(
    process.env.POLYGON_TARGET_73,
    'POLYGON_TARGET_73',
    'polygon'
  );
  if (!POLYGON_TARGET_73.valid) errors.push(POLYGON_TARGET_73.error);

  // ========================================
  // BNB CONFIGURATION
  // ========================================
  const bnbUrl = isValidUrl(process.env.BNB_RPC_ENDPOINT, 'BNB_RPC_ENDPOINT');
  if (!bnbUrl.valid) errors.push(bnbUrl.error);

  if (process.env.BSCSCAN_KEY && process.env.BSCSCAN_KEY !== 'YourApiKeyToken') {
    const bnbKey = isValidApiKey(process.env.BSCSCAN_KEY, 'BSCSCAN_KEY');
    if (!bnbKey.valid) errors.push(bnbKey.error);
  }

  const BNB_TARGET_71 = isValidAddress(
    process.env.BNB_TARGET_71,
    'BNB_TARGET_71',
    'bnb'
  );
  if (!BNB_TARGET_71.valid) errors.push(BNB_TARGET_71.error);

  const BNB_TARGET_72 = isValidAddress(
    process.env.BNB_TARGET_72,
    'BNB_TARGET_72',
    'bnb'
  );
  if (!BNB_TARGET_72.valid) errors.push(BNB_TARGET_72.error);

  const BNB_TARGET_73 = isValidAddress(
    process.env.BNB_TARGET_73,
    'BNB_TARGET_73',
    'bnb'
  );
  if (!BNB_TARGET_73.valid) errors.push(BNB_TARGET_73.error);

  const BNB_DELAY_MS = isValidInteger(process.env.BNB_DELAY_MS || '200', 'BNB_DELAY_MS', 0);
  if (!BNB_DELAY_MS.valid) errors.push(BNB_DELAY_MS.error);

  const BNB_INITIAL_DELAY_MS = isValidInteger(process.env.BNB_INITIAL_DELAY_MS || '100', 'BNB_INITIAL_DELAY_MS', 0);
  if (!BNB_INITIAL_DELAY_MS.valid) errors.push(BNB_INITIAL_DELAY_MS.error);

  const BNB_MAX_REQ_24H = isValidInteger(process.env.BNB_MAX_REQ_24H || '100000', 'BNB_MAX_REQ_24H', 1);
  if (!BNB_MAX_REQ_24H.valid) errors.push(BNB_MAX_REQ_24H.error);

  // ========================================
  // RELATÓRIO FINAL
  // ========================================
  if (errors.length > 0) {
    console.error('\n❌ ERRO DE CONFIGURAÇÃO DETECTADO\n');
    errors.forEach((err) => console.error(err));
    console.error(
      '\n⚠️  Verifique seu arquivo .env e corrija os erros acima.\n'
    );
    process.exit(1);
  }

  console.log('✅ Configuração validada com sucesso!\n');
}

/**
 * Retorna objeto com todas as configurações validadas
 */
export function getConfig() {
  return {
    // Puzzle
    PUZZLE_ID: process.env.PUZZLE_ID,

    // Runtime
    BATCH_SIZE: parseInt(process.env.BATCH_SIZE, 10),
    DELAY_MS: parseInt(process.env.DELAY_MS, 10),
    MAX_REQ_24H: parseInt(process.env.MAX_REQ_24H, 10),
    TIMEOUT_MS: parseInt(process.env.TIMEOUT_MS, 10),
    SEARCH_MODE: process.env.SEARCH_MODE,

    // Bitcoin
    ANKR_BTC_BLOCKBOOK_URL: process.env.ANKR_BTC_BLOCKBOOK_URL,
    BLOCKBOOK_DELAY_MS: parseInt(process.env.BLOCKBOOK_DELAY_MS || '0', 10),
    BLOCKBOOK_TIMEOUT_MS: parseInt(process.env.BLOCKBOOK_TIMEOUT_MS || '10000', 10),

    // Ethereum
    RPC_ENDPOINT: process.env.RPC_ENDPOINT,
    ETHERSCAN_KEY: process.env.ETHERSCAN_KEY,
    ETH_TARGET_71: process.env.ETH_TARGET_71,
    ETH_TARGET_72: process.env.ETH_TARGET_72,
    ETH_TARGET_73: process.env.ETH_TARGET_73,
    ETH_DELAY_MS: parseInt(process.env.ETH_DELAY_MS || '200', 10),
    ETH_INITIAL_DELAY_MS: parseInt(process.env.ETH_INITIAL_DELAY_MS || '0', 10),
    ETH_MAX_REQ_24H: parseInt(process.env.ETH_MAX_REQ_24H || '100000', 10),

    // Solana
    SOL_RPC_ENDPOINT: process.env.SOL_RPC_ENDPOINT,
    SOL_DELAY_MS: parseInt(process.env.SOL_DELAY_MS, 10),
    SOL_TIMEOUT_MS: parseInt(process.env.SOL_TIMEOUT_MS, 10),
    SOL_TARGET_71: process.env.SOL_TARGET_71,
    SOL_TARGET_72: process.env.SOL_TARGET_72,
    SOL_TARGET_73: process.env.SOL_TARGET_73,

    // Polygon
    POLYGON_RPC_ENDPOINT: process.env.POLYGON_RPC_ENDPOINT,
    POLYGON_API_KEY: process.env.POLYGON_API_KEY,
    POLYGON_TARGET_71: process.env.POLYGON_TARGET_71,
    POLYGON_TARGET_72: process.env.POLYGON_TARGET_72,
    POLYGON_TARGET_73: process.env.POLYGON_TARGET_73,
    POLYGON_DELAY_MS: parseInt(process.env.POLYGON_DELAY_MS, 10),
    POLYGON_TIMEOUT_MS: parseInt(process.env.POLYGON_TIMEOUT_MS, 10),

    // BNB
    BNB_RPC_ENDPOINT: process.env.BNB_RPC_ENDPOINT,
    BSCSCAN_KEY: process.env.BSCSCAN_KEY,
    BNB_TARGET_71: process.env.BNB_TARGET_71,
    BNB_TARGET_72: process.env.BNB_TARGET_72,
    BNB_TARGET_73: process.env.BNB_TARGET_73,
    BNB_DELAY_MS: parseInt(process.env.BNB_DELAY_MS || '200', 10),
    BNB_INITIAL_DELAY_MS: parseInt(process.env.BNB_INITIAL_DELAY_MS || '100', 10),
    BNB_MAX_REQ_24H: parseInt(process.env.BNB_MAX_REQ_24H || '100000', 10),
    BNB_TIMEOUT_MS: parseInt(process.env.BNB_TIMEOUT_MS, 10),
  };
}

/**
 * Executa validação ao importar o módulo (se executado diretamente)
 */
if (import.meta.url === `file://${process.argv[1]}`) {
  console.log('🔍 Validando configuração do .env...\n');
  validateConfig();
  console.log('📋 Configuração carregada:');
  console.log(JSON.stringify(getConfig(), null, 2));
}
