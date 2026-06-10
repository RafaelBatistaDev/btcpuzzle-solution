#!/usr/bin/env node

// ✅ Carregar e validar todas as configurações do .env (centralizado)
import config from '../config.js';

/**
 * PROJETO: ETH PUZZLE - Solver Simplificado
 * PERFORMANCE: Alta
 * AMBIENTE: Node.js v18+ (ESM nativo)
 *
 * Funcionalidades:
 * - Importa solver modular de ethereum/config/solver.js
 * - Suporta múltiplos puzzles (71, 72, 73)
 * - Gera endereços ETH sequencialmente (ou aleatório via SEARCH_MODE)
 * - Segue CryptoEngine.privkeyToAddress() de ethereum/config/utils.js
 * - Consulta saldo via Ankr RPC
 * - Trata rate limiting automático
 * - Salva achados em relatorio_final/saldos_encontrados.jsonl
 */

import { EthereumSolver } from './config/solver.js';
import { RUNTIME_CONFIG } from './config/config.js';

console.log('\n╔════════════════════════════════════════════════════════════╗');
console.log('║  🚀 ETHEREUM PUZZLE SOLVER - Iniciando                     ║');
console.log('╚════════════════════════════════════════════════════════════╝\n');

const puzzleId = Number(config.PUZZLE_ID || RUNTIME_CONFIG.PUZZLE_ID);
const searchMode = RUNTIME_CONFIG.SEARCH_MODE || 'sequential';

if (![71, 72, 73].includes(puzzleId)) {
  console.error('❌ Puzzle inválido! Deve ser 71, 72 ou 73');
  console.error(`   Configurado: ${puzzleId}`);
  process.exit(1);
}

console.log(`📋 Configuração:`);
console.log(`  ├─ Puzzle: ETH_PUZZLE_${puzzleId}`);
console.log(`  ├─ Modo: ${searchMode}`);
console.log(`  ├─ Batch Size: ${RUNTIME_CONFIG.BATCH_SIZE}`);
console.log(`  └─ Delay: ${RUNTIME_CONFIG.DELAY_MS}ms\n`);

const solver = new EthereumSolver(puzzleId);

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n\n⏸️  Salvando estado...');
  solver._saveState();
  console.log('✅ Estado salvo com sucesso');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n\n⏸️  Terminando gracefully...');
  solver._saveState();
  process.exit(0);
});

// Inicia busca sequencial via EthereumSolver
solver.search().catch(err => {
  console.error('❌ Erro fatal:', err);
  solver._saveState();
  process.exit(1);
});
