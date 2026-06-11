#!/usr/bin/env node

/**
 * TESTE: Verificar se cada solver está consultando a rede correta
 * 
 * Este script testa se:
 * - Ethereum solver consulta RPC_ENDPOINT (Ethereum)
 * - Polygon solver consulta POLYGON_RPC_ENDPOINT (Polygon)
 * - BNB solver consulta BNB_RPC_ENDPOINT (BNB Chain)
 * - Solana solver consulta SOL_RPC_ENDPOINT (Solana)
 * - Bitcoin solver consulta BLOCKCHAIN_INFO_BASE_URL (Mempool / Blockchain.info)
 */

import { RUNTIME_CONFIG as ETH_CONFIG } from './ethereum/config/config.js';
import { RUNTIME_CONFIG as POLYGON_CONFIG } from './polygon/config/config.js';
import { RUNTIME_CONFIG as BNB_CONFIG } from './bnb/config/config.js';
import { RUNTIME_CONFIG as SOLANA_CONFIG } from './solana/config/config.js';
import { RUNTIME_CONFIG as BTC_P2PKH_CONFIG } from './bitcoin_P2PKH/config/config.js';
import { RUNTIME_CONFIG as BTC_P2WPKH_CONFIG } from './bitcoin_P2WPKH/config/config.js';
import { RUNTIME_CONFIG as BTC_P2SH_CONFIG } from './bitcoin_P2SH-P2WPKH/config/config.js';

console.log('\n🧪 TESTE: Cada Solver Consulta a Rede Correta\n');
console.log('═'.repeat(70));

// Teste 1: Ethereum
console.log('\n✅ ETHEREUM Solver:');
console.log(`   API Endpoint: ${ETH_CONFIG.RPC_ENDPOINT}`);
console.log(`   Contém "etherscan"? ${ETH_CONFIG.RPC_ENDPOINT.includes('etherscan') ? '✅ SIM' : '❌ NÃO'}`);
console.log(`   Etherscan API Key: ${ETH_CONFIG.ETHERSCAN_KEY ? '✔️ Configurada' : '❌ NÃO Configurada'}`);

// Teste 2: Polygon
console.log('\n✅ POLYGON Solver:');
console.log(`   RPC Endpoint: ${POLYGON_CONFIG.RPC_ENDPOINT}`);
console.log(`   Contém "polygon"? ${POLYGON_CONFIG.RPC_ENDPOINT.includes('polygon') ? '✅ SIM' : '❌ NÃO'}`);
console.log(`   API Key: ${POLYGON_CONFIG.ETHERSCAN_KEY}`);
console.log(`   API contém "polygon"? ${POLYGON_CONFIG.ETHERSCAN_KEY.includes('polygon') ? '✅ SIM' : '❌ NÃO'}`);

// Teste 3: BNB
console.log('\n✅ BNB Solver:');
console.log(`   RPC Endpoint: ${BNB_CONFIG.RPC_ENDPOINT}`);
console.log(`   Contém "bsc" ou "bnb"? ${(BNB_CONFIG.RPC_ENDPOINT.includes('bsc') || BNB_CONFIG.RPC_ENDPOINT.includes('bnb')) ? '✅ SIM' : '❌ NÃO'}`);
console.log(`   API Key: ${BNB_CONFIG.ETHERSCAN_KEY}`);
console.log(`   API contém "bsc"? ${BNB_CONFIG.ETHERSCAN_KEY.includes('bsc') ? '✅ SIM' : '❌ NÃO'}`);

// Teste 4: Solana
console.log('\n✅ SOLANA Solver:');
console.log(`   RPC Endpoint: ${SOLANA_CONFIG.RPC_ENDPOINT}`);
console.log(`   Contém "solana"? ${SOLANA_CONFIG.RPC_ENDPOINT.includes('solana') ? '✅ SIM' : '❌ NÃO'}`);
console.log(`   Target: ${SOLANA_CONFIG.RPC_ENDPOINT.includes('ankr') ? '🔗 Ankr' : '🔗 Outro'}`);

// Teste 5: Bitcoin P2PKH
console.log('\n✅ BITCOIN P2PKH Solver:');
console.log(`   API URL: ${BTC_P2PKH_CONFIG.BLOCKCHAIN_INFO_BASE_URL}`);
const btcProvider = (url) => {
  if (url.includes('mempool.space')) return 'mempool';
  if (url.includes('blockchain')) return 'blockchain.info';
  return 'desconhecido';
};
console.log(`   Provedor: ${btcProvider(BTC_P2PKH_CONFIG.BLOCKCHAIN_INFO_BASE_URL)}`);
console.log(`   Suportado (mempool/blockchain)? ${['mempool', 'blockchain.info'].includes(btcProvider(BTC_P2PKH_CONFIG.BLOCKCHAIN_INFO_BASE_URL)) ? '✅ SIM' : '❌ NÃO'}`);

// Teste 6: Bitcoin P2WPKH
console.log('\n✅ BITCOIN P2WPKH Solver:');
console.log(`   API URL: ${BTC_P2WPKH_CONFIG.BLOCKCHAIN_INFO_BASE_URL}`);
console.log(`   Provedor: ${btcProvider(BTC_P2WPKH_CONFIG.BLOCKCHAIN_INFO_BASE_URL)}`);
console.log(`   Suportado (mempool/blockchain)? ${['mempool', 'blockchain.info'].includes(btcProvider(BTC_P2WPKH_CONFIG.BLOCKCHAIN_INFO_BASE_URL)) ? '✅ SIM' : '❌ NÃO'}`);

// Teste 7: Bitcoin P2SH-P2WPKH
console.log('\n✅ BITCOIN P2SH-P2WPKH Solver:');
console.log(`   API URL: ${BTC_P2SH_CONFIG.BLOCKCHAIN_INFO_BASE_URL}`);
console.log(`   Provedor: ${btcProvider(BTC_P2SH_CONFIG.BLOCKCHAIN_INFO_BASE_URL)}`);
console.log(`   Suportado (mempool/blockchain)? ${['mempool', 'blockchain.info'].includes(btcProvider(BTC_P2SH_CONFIG.BLOCKCHAIN_INFO_BASE_URL)) ? '✅ SIM' : '❌ NÃO'}`);

console.log('\n' + '═'.repeat(70));

// Validação Final
console.log('\n📊 RESUMO FINAL:');

const checks = [
  {
    name: 'Ethereum',
    pass: ETH_CONFIG.RPC_ENDPOINT.includes('etherscan') && ETH_CONFIG.ETHERSCAN_KEY && ETH_CONFIG.ETHERSCAN_KEY !== 'YourApiKeyToken',
  },
  {
    name: 'Polygon',
    pass: POLYGON_CONFIG.RPC_ENDPOINT.includes('polygon') && POLYGON_CONFIG.ETHERSCAN_KEY.includes('polygon'),
  },
  {
    name: 'BNB',
    pass: (BNB_CONFIG.RPC_ENDPOINT.includes('bsc') || BNB_CONFIG.RPC_ENDPOINT.includes('bnb')) && BNB_CONFIG.ETHERSCAN_KEY.includes('bsc'),
  },
  {
    name: 'Solana',
    pass: SOLANA_CONFIG.RPC_ENDPOINT.includes('solana') && SOLANA_CONFIG.RPC_ENDPOINT.includes('ankr'),
  },
  {
    name: 'Bitcoin P2PKH',
    pass: ['mempool', 'blockchain.info'].includes(btcProvider(BTC_P2PKH_CONFIG.BLOCKCHAIN_INFO_BASE_URL)),
  },
  {
    name: 'Bitcoin P2WPKH',
    pass: ['mempool', 'blockchain.info'].includes(btcProvider(BTC_P2WPKH_CONFIG.BLOCKCHAIN_INFO_BASE_URL)),
  },
  {
    name: 'Bitcoin P2SH-P2WPKH',
    pass: ['mempool', 'blockchain.info'].includes(btcProvider(BTC_P2SH_CONFIG.BLOCKCHAIN_INFO_BASE_URL)),
  },
];

let allPassed = true;
checks.forEach(check => {
  const status = check.pass ? '✅' : '❌';
  console.log(`${status} ${check.name}: ${check.pass ? 'CORRETO' : 'ERRO'}`);
  if (!check.pass) allPassed = false;
});

console.log('\n' + '═'.repeat(70));

if (allPassed) {
  console.log('\n🎉 SUCESSO! Todos os solvers estão consultando a rede correta!\n');
  process.exit(0);
} else {
  console.log('\n❌ ERRO! Alguns solvers não estão consultando a rede correta!\n');
  process.exit(1);
}
