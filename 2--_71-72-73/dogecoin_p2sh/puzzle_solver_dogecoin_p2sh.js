#!/usr/bin/env node
import config from '../config.js';
/**
 * PROJETO: DOGECOIN P2SH-P2WPKH (BIP49) - Puzzle Solver
 */

import { DogecoinSolver } from './config/solver.js';
import { RUNTIME_CONFIG } from './config/config.js';

console.log('\n╔════════════════════════════════════════════════════════════╗');
console.log('║  🚀 DOGECOIN P2SH PUZZLE SOLVER - Iniciando                ║');
console.log('╚════════════════════════════════════════════════════════════╝\n');

const puzzleId = Number(config.PUZZLE_ID || RUNTIME_CONFIG.PUZZLE_ID);

if (![71, 72, 73].includes(puzzleId)) {
  console.error('❌ Puzzle inválido! Deve ser 71, 72 ou 73');
  console.error(`   Configurado: ${puzzleId}`);
  process.exit(1);
}

const solver = new DogecoinSolver(puzzleId);

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

solver.search().catch(err => {
  console.error('❌ Erro fatal:', err);
  solver._saveState();
  process.exit(1);
});
