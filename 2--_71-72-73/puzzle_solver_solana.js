#!/usr/bin/env node

// --- MONKEYPATCH: bigint-buffer para Solana (DEVE SER PRIMEIRA LINHA) ---
import './monkeypatch-bigint-buffer.js';

// ✅ Carregar e validar todas as configurações do .env (centralizado)
import config from './config.js';

/**
 * PROJETO: SOLANA PUZZLE - Solver Simplificado
 * PERFORMANCE: Alta
 * AMBIENTE: Node.js v18+ (ESM nativo)
 * 
 * Funcionalidades:
 * - Importa solver modular de solana/config/solver.js
 * - Suporta múltiplos puzzles (71, 72, 73)
 * - Gera endereços SOL sequencialmente (ed25519 + base58)
 * - Segue CryptoEngine.privkeyToAddress() de solana/config/utils.js
 * - Consulta saldo via RPC Solana
 * - Trata rate limiting automático
 * - Salva achados em relatorio_final/solana_addresses_with_balance.jsonl
 */

import { SolanaSolver } from './solana/config/solver.js';
import { RUNTIME_CONFIG } from './solana/config/config.js';

console.log('\n╔════════════════════════════════════════════════════════════╗');
console.log('║  🚀 SOLANA PUZZLE SOLVER - Iniciando                       ║');
console.log('╚════════════════════════════════════════════════════════════╝\n');

const puzzleId = Number(config.PUZZLE_ID || RUNTIME_CONFIG.PUZZLE_ID);
const searchMode = RUNTIME_CONFIG.SEARCH_MODE || 'sequential';

if (![71, 72, 73].includes(puzzleId)) {
  console.error('❌ Puzzle inválido! Deve ser 71, 72 ou 73');
  console.error(`   Configurado: ${puzzleId}`);
  process.exit(1);
}

console.log(`📋 Configuração:`);
console.log(`  ├─ Puzzle: SOL_PUZZLE_${puzzleId}`);
console.log(`  ├─ Modo: ${searchMode}`);
console.log(`  ├─ Batch Size: ${RUNTIME_CONFIG.BATCH_SIZE}`);
console.log(`  └─ Delay: ${RUNTIME_CONFIG.DELAY_MS}ms\n`);

const solver = new SolanaSolver(puzzleId);

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

// Inicia busca sequencial via SolanaSolver
solver.search().catch(err => {
  console.error('❌ Erro fatal:', err);
  solver._saveState();
  process.exit(1);
});
