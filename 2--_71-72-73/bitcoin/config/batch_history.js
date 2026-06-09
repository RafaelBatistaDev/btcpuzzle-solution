#!/usr/bin/env node

/**
 * Bitcoin Batch History Checker
 * Lê batch_history.jsonl em PUZZLE_71, PUZZLE_72, PUZZLE_73
 * Salva relatório em reports/
 */

import fs   from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function formatDate(date) {
  const pad = (n) => String(n).padStart(2, '0');
  return (
    `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}` +
    `_${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`
  );
}

function checkBitcoinBatchHistory() {
  const reportsDir = path.join(__dirname, '..', '..', 'reports');

  if (!fs.existsSync(reportsDir)) {
    fs.mkdirSync(reportsDir, { recursive: true });
  }

  const puzzles     = ['PUZZLE_71', 'PUZZLE_72', 'PUZZLE_73'];
  const timestamp   = formatDate(new Date());
  const reportFile  = path.join(reportsDir, `bitcoin_report_${timestamp}.txt`);

  const allResults  = {};
  const reportLines = [];

  reportLines.push('='.repeat(80));
  reportLines.push('BITCOIN BATCH HISTORY REPORT');
  reportLines.push(`Generated: ${new Date().toISOString()}`);
  reportLines.push('='.repeat(80));
  reportLines.push('');

  for (const puzzle of puzzles) {
    // ✅ CORREÇÃO: nome correto do arquivo gerado pelo solver.js
    const filePath = path.join(__dirname, '..', puzzle, 'batch_history.jsonl');

    if (!fs.existsSync(filePath)) {
      const msg = `⚠️  Arquivo não encontrado: ${filePath}`;
      console.log(msg);
      reportLines.push(msg);
      reportLines.push('');
      continue;
    }

    const header = `\n📊 ${puzzle}/batch_history.jsonl`;
    console.log(header);
    reportLines.push(header);
    reportLines.push('-'.repeat(80));

    const foundRecords = [];
    let totalLines     = 0;

    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const lines   = content.trim().split('\n');

      for (let lineNum = 0; lineNum < lines.length; lineNum++) {
        totalLines = lineNum + 1;
        const line = lines[lineNum];
        if (!line.trim()) continue;

        try {
          const data    = JSON.parse(line);
          // ✅ CORREÇÃO: usa 'finalBalance' (campo real do solver) em vez de 'totalBalance'
          const balance = parseInt(data.finalBalance || 0, 10);

          if (balance !== 0 || (data.nTx || 0) > 0) {
            foundRecords.push({
              line:    totalLines,
              // ✅ CORREÇÃO: usa 'address' (campo real do solver) em vez de formats.BIP44C.address
              addr:    data.address || data.formats?.BIP44C?.address || '',
              privHex: data.privHex,
              balance,
              nTx:     data.nTx || 0,
              wif:     data.wif,
              status:  data.status || 'sem_saldo',
            });
          }
        } catch (e) {
          reportLines.push(`  ⚠️  Erro na linha ${totalLines}: ${e.message}`);
        }
      }

      allResults[puzzle] = {
        total_lines: totalLines,
        found:       foundRecords.length,
        records:     foundRecords,
      };

      const summary = `Total: ${totalLines} linhas | Com saldo ou histórico: ${foundRecords.length}`;
      console.log(summary);
      reportLines.push(summary);
      reportLines.push('');

      if (foundRecords.length > 0) {
        reportLines.push('RECORDS COM SALDO ≠ 0 ou TX HISTÓRICO:');
        reportLines.push(
          `${'Linha'.padEnd(8)} ${'Status'.padEnd(18)} ${'Endereço'.padEnd(35)} ${'Saldo (Sat)'.padEnd(18)} ${'nTx'.padEnd(6)}`
        );
        reportLines.push('-'.repeat(90));

        for (const record of foundRecords) {
          const lineStr =
            `${String(record.line).padEnd(8)} ` +
            `${(record.status || '').padEnd(18)} ` +
            `${record.addr.padEnd(35)} ` +
            `${String(record.balance).padEnd(18)} ` +
            `${String(record.nTx).padEnd(6)}`;

          reportLines.push(lineStr);
          reportLines.push(`  └─ WIF: ${record.wif}`);
          if (record.privHex) {
            reportLines.push(`  └─ Privkey (Hex): ${record.privHex}`);
          }
        }
        reportLines.push('');
      }

    } catch (e) {
      const error = `❌ Erro ao processar ${puzzle}: ${e.message}`;
      console.log(error);
      reportLines.push(error);
      reportLines.push('');
    }
  }

  reportLines.push('='.repeat(80));
  reportLines.push('RESUMO GERAL');
  reportLines.push('='.repeat(80));

  let totalEncontrados = 0;
  for (const puzzle of puzzles) {
    if (puzzle in allResults) {
      const result      = allResults[puzzle];
      const status      = result.found === 0 ? '✓' : '⚠️';
      const summaryLine = `${status} ${puzzle}: ${result.found} com saldo/histórico | ${result.total_lines} total`;
      console.log(summaryLine);
      reportLines.push(summaryLine);
      totalEncontrados += result.found;
    }
  }

  const finalLine = `\nTotal Geral: ${totalEncontrados} endereços com saldo ou histórico`;
  console.log(finalLine);
  reportLines.push(finalLine);

  fs.writeFileSync(reportFile, reportLines.join('\n'));
  console.log(`\n📄 Relatório salvo: reports/bitcoin_report_${timestamp}.txt`);

  return allResults;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  checkBitcoinBatchHistory();
}

export { checkBitcoinBatchHistory };
