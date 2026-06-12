#!/usr/bin/env node
/**
 * Coordenador Bitcoin — alterna lotes P2PKH ↔ P2WPKH ↔ P2SH-P2WPKH (ex.: 20 + 20 + 20).
 * Substitui a sequência "P2PKH até terminar → P2WPKH" nos scripts .sh.
 */

import config from './config.js';
import { BitcoinSolver as P2PKHSolver } from './bitcoin_P2PKH/config/solver.js';
import { BitcoinSolver as P2WPKHSolver } from './bitcoin_P2WPKH/config/solver.js';
import { BitcoinSolver as P2SHSolver } from './bitcoin_P2SH-P2WPKH/config/solver.js';
import { ACTIVE_PUZZLES, RUNTIME_CONFIG as P2PKH_RUNTIME } from './bitcoin_P2PKH/config/config.js';
import { RUNTIME_CONFIG as P2WPKH_RUNTIME } from './bitcoin_P2WPKH/config/config.js';
import { RUNTIME_CONFIG as P2SH_RUNTIME } from './bitcoin_P2SH-P2WPKH/config/config.js';
import { initLimiterDelay } from './bitcoin_rate_limiter.js';

const sharedDelay = Number(
  process.env.BTC_DELAY_MS ||
  Math.max(P2PKH_RUNTIME.DELAY_MS, P2WPKH_RUNTIME.DELAY_MS, P2SH_RUNTIME.DELAY_MS)
);
initLimiterDelay(sharedDelay);

function resolvePuzzleIds() {
  const fromEnv = Number(process.env.PUZZLE_ID || config.PUZZLE_ID);
  if ([71, 72, 73].includes(fromEnv)) return [fromEnv];
  return ACTIVE_PUZZLES;
}

async function runAlternatingForPuzzle(puzzleId) {
  const p2pkh = new P2PKHSolver(puzzleId);
  const p2wpkh = new P2WPKHSolver(puzzleId);
  const p2sh = new P2SHSolver(puzzleId);

  const batchInfo =
    `[🔄] Modo alternado P2PKH ↔ P2WPKH ↔ P2SH-P2WPKH ` +
    `(batch P2PKH=${P2PKH_RUNTIME.BATCH_SIZE}, P2WPKH=${P2WPKH_RUNTIME.BATCH_SIZE}, P2SH=${P2SH_RUNTIME.BATCH_SIZE})`;
  p2pkh.log(batchInfo);
  p2wpkh.log(batchInfo);
  p2sh.log(batchInfo);

  let p2pkhDone = false;
  let p2wpkhDone = false;
  let p2shDone = false;
  let cycle = 0;

  while (!p2pkhDone || !p2wpkhDone || !p2shDone) {
    if (!p2pkhDone) {
      await p2pkh.fillBatch();
      if (p2pkh.batch.length === 0) {
        p2pkhDone = true;
        p2pkh.log('🏁 P2PKH: range completo');
        p2pkh._saveState();
      } else {
        p2pkh.log(`📦 P2PKH lote ${p2pkh.batch.length} endereço(s)`);
        await p2pkh.processBatch();
        p2pkh._saveState();
      }
    }

    if (!p2wpkhDone) {
      await p2wpkh.fillBatch();
      if (p2wpkh.batch.length === 0) {
        p2wpkhDone = true;
        p2wpkh.log('🏁 P2WPKH: range completo');
        p2wpkh._saveState();
      } else {
        p2wpkh.log(`📦 P2WPKH lote ${p2wpkh.batch.length} endereço(s)`);
        await p2wpkh.processBatch();
        p2wpkh._saveState();
      }
    }

    if (!p2shDone) {
      await p2sh.fillBatch();
      if (p2sh.batch.length === 0) {
        p2shDone = true;
        p2sh.log('🏁 P2SH-P2WPKH: range completo');
        p2sh._saveState();
      } else {
        p2sh.log(`📦 P2SH-P2WPKH lote ${p2sh.batch.length} endereço(s)`);
        await p2sh.processBatch();
        p2sh._saveState();
      }
    }

    cycle++;
    if (cycle % 10 === 0) {
      const p2pkhPct = p2pkhDone ? 100 : p2pkh.progressPercent();
      const p2wpkhPct = p2wpkhDone ? 100 : p2wpkh.progressPercent();
      const p2shPct = p2shDone ? 100 : p2sh.progressPercent();
      console.log(
        `[BTC P${puzzleId}] ciclo ${cycle} | P2PKH ${p2pkhPct}% | P2WPKH ${p2wpkhPct}% | P2SH ${p2shPct}% | ` +
        `verificados P2PKH=${p2pkh.state.totalChecked} P2WPKH=${p2wpkh.state.totalChecked} P2SH=${p2sh.state.totalChecked}`
      );
    }
  }

  console.log(`✅ Puzzle #${puzzleId}: P2PKH, P2WPKH e P2SH-P2WPKH finalizados`);
}

const solvers = [];

function saveAll() {
  solvers.forEach((s) => s._saveState());
}

process.on('SIGINT', () => {
  saveAll();
  console.log('\n✅ Estado Bitcoin salvo. Encerrando.');
  process.exit(0);
});

process.on('SIGTERM', () => {
  saveAll();
  process.exit(0);
});

const puzzleIds = resolvePuzzleIds();

console.log('\n╔════════════════════════════════════════════════════════════╗');
console.log('║  🚀 BITCOIN ALTERNADO — P2PKH ↔ P2WPKH ↔ P2SH por lote    ║');
console.log(
  `║  Puzzles: ${puzzleIds.join(', ')}  |  Batch: ` +
  `P2PKH=${P2PKH_RUNTIME.BATCH_SIZE} P2WPKH=${P2WPKH_RUNTIME.BATCH_SIZE} P2SH=${P2SH_RUNTIME.BATCH_SIZE} ║`
);
console.log('╚════════════════════════════════════════════════════════════╝\n');

Promise.all(
  puzzleIds.map(async (id) => {
    const p2pkh = new P2PKHSolver(id);
    const p2wpkh = new P2WPKHSolver(id);
    const p2sh = new P2SHSolver(id);
    solvers.push(p2pkh, p2wpkh, p2sh);
    await runAlternatingForPuzzle(id);
  })
)
  .then(() => {
    console.log('🏁 Todos os puzzles Bitcoin (P2PKH + P2WPKH + P2SH-P2WPKH) processados.');
    process.exit(0);
  })
  .catch((err) => {
    console.error('❌ Erro no coordenador Bitcoin:', err);
    saveAll();
    process.exit(1);
  });
