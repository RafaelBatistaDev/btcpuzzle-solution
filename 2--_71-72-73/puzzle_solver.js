#!/usr/bin/env node
// ✅ Carregar e validar todas as configurações do .env (centralizado)
import config from './config.js';
/**
 * PROJETO: BTC PUZZLE - Solver Simplificado
 * PERFORMANCE: Alta
 * AMBIENTE: Node.js v18+ (ESM nativo)
 * 
 * Funcionalidades:
 * - Importa solver modular de bitcoin/
 * - Suporta múltiplos puzzles (71, 72, 73)
 * - Gera 5 formatos BIP por chave privada
 * - Consulta saldo via Blockbook/Ankr
 * - Trata rate limiting (429) com retry automático
 * - Salva achados em relatorio_final/saldos_encontrados.jsonl
 */

import { BitcoinSolver } from './bitcoin/config/solver.js';
import { RUNTIME_CONFIG } from './bitcoin/config/config.js';

console.log('\n╔════════════════════════════════════════════════════════════╗');
console.log('║  🚀 BITCOIN PUZZLE SOLVER - Iniciando                      ║');
console.log('╚════════════════════════════════════════════════════════════╝\n');

const puzzleId = Number(config.PUZZLE_ID || RUNTIME_CONFIG.PUZZLE_ID);

if (![71, 72, 73].includes(puzzleId)) {
  console.error('❌ Puzzle inválido! Deve ser 71, 72 ou 73');
  console.error(`   Configurado: ${puzzleId}`);
  process.exit(1);
}

const solver = new BitcoinSolver(puzzleId);

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

// Inicia busca
solver.search().catch(err => {
  console.error('❌ Erro fatal:', err);
  solver._saveState();
  process.exit(1);
});
