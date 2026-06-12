#!/usr/bin/env node
/**
 * Coordenador Litecoin — alterna lotes P2PKH ↔ P2SH-P2WPKH por puzzle.
 */

import config from './config.js';
import { LitecoinSolver as P2PKHSolver } from './litecoin_p2pkh/config/solver.js';
import { LitecoinSolver as P2SHSolver } from './litecoin_p2sh/config/solver.js';
import { ACTIVE_PUZZLES, RUNTIME_CONFIG as P2PKH_RUNTIME } from './litecoin_p2pkh/config/config.js';
import { RUNTIME_CONFIG as P2SH_RUNTIME } from './litecoin_p2sh/config/config.js';
import { initLimiterDelay } from './litecoin_rate_limiter.js';

const sharedDelay = Number(
  process.env.LTC_DELAY_MS ||
  Math.max(P2PKH_RUNTIME.DELAY_MS, P2SH_RUNTIME.DELAY_MS)
);
initLimiterDelay(sharedDelay);

function resolvePuzzleIds() {
  const fromEnv = Number(process.env.PUZZLE_ID || config.PUZZLE_ID);
  if ([71, 72, 73].includes(fromEnv)) return [fromEnv];
  return ACTIVE_PUZZLES;
}

async function runAlternatingForPuzzle(puzzleId) {
  const p2pkh = new P2PKHSolver(puzzleId);
  const p2sh  = new P2SHSolver(puzzleId);

  const batchInfo =
    `[🔄] Modo alternado P2PKH ↔ P2SH-P2WPKH ` +
    `(batch P2PKH=${P2PKH_RUNTIME.BATCH_SIZE}, P2SH=${P2SH_RUNTIME.BATCH_SIZE})`;
  p2pkh.log(batchInfo);
  p2sh.log(batchInfo);

  let p2pkhDone = false;
  let p2shDone  = false;
  let cycle     = 0;

  while (!p2pkhDone || !p2shDone) {
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
      const p2shPct  = p2shDone ? 100 : p2sh.progressPercent();
      console.log(
        `[LTC P${puzzleId}] ciclo ${cycle} | P2PKH ${p2pkhPct}% | P2SH ${p2shPct}% | ` +
        `verificados P2PKH=${p2pkh.state.totalChecked} P2SH=${p2sh.state.totalChecked}`
      );
    }
  }

  console.log(`✅ Puzzle #${puzzleId}: P2PKH e P2SH-P2WPKH finalizados`);
}

const solvers = [];

function saveAll() {
  solvers.forEach((s) => s._saveState());
}

process.on('SIGINT', () => {
  saveAll();
  console.log('\n✅ Estado Litecoin salvo. Encerrando.');
  process.exit(0);
});

process.on('SIGTERM', () => {
  saveAll();
  process.exit(0);
});

const puzzleIds = resolvePuzzleIds();

console.log('\n╔════════════════════════════════════════════════════════════╗');
console.log('║  🚀 LITECOIN ALTERNADO — P2PKH ↔ P2SH por lote             ║');
console.log(
  `║  Puzzles: ${puzzleIds.join(', ')}  |  Batch: ` +
  `P2PKH=${P2PKH_RUNTIME.BATCH_SIZE} P2SH=${P2SH_RUNTIME.BATCH_SIZE} ║`
);
console.log('╚════════════════════════════════════════════════════════════╝\n');

Promise.all(
  puzzleIds.map(async (id) => {
    const p2pkh = new P2PKHSolver(id);
    const p2sh  = new P2SHSolver(id);
    solvers.push(p2pkh, p2sh);
    await runAlternatingForPuzzle(id);
  })
)
  .then(() => {
    console.log('🏁 Todos os puzzles Litecoin (P2PKH + P2SH-P2WPKH) processados.');
    process.exit(0);
  })
  .catch((err) => {
    console.error('❌ Erro no coordenador Litecoin:', err);
    saveAll();
    process.exit(1);
  });
