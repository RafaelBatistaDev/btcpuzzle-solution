#!/usr/bin/env node

/**
 * BNB Batch History Checker
 * Verifica batch_history.jsonl em PUZZLE_71, PUZZLE_72, PUZZLE_73
 * Salva relatório em reports/
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function formatDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  return `${year}${month}${day}_${hours}${minutes}${seconds}`;
}

function checkBnbBatchHistory() {
  const reportsDir = path.join(__dirname, '..', '..', 'reports');
  
  // Criar diretório reports se não existir
  if (!fs.existsSync(reportsDir)) {
    fs.mkdirSync(reportsDir, { recursive: true });
  }
  
  const puzzles = ['PUZZLE_71', 'PUZZLE_72', 'PUZZLE_73'];
  const timestamp = formatDate(new Date());
  const reportFile = path.join(reportsDir, `bnb_report_${timestamp}.txt`);
  
  const allResults = {};
  const reportLines = [];
  
  reportLines.push('='.repeat(80));
  reportLines.push('BNB BATCH HISTORY REPORT');
  reportLines.push(`Generated: ${new Date().toISOString()}`);
  reportLines.push('='.repeat(80));
  reportLines.push('');
  
  for (const puzzle of puzzles) {
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
    let totalLines = 0;
    
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const lines = content.trim().split('\n');
      
      for (let lineNum = 0; lineNum < lines.length; lineNum++) {
        totalLines = lineNum + 1;
        const line = lines[lineNum];
        
        if (!line.trim()) continue;
        
        try {
          const data = JSON.parse(line);
          const balance = parseFloat(data.balance || 0);
          
          if (balance !== 0) {
            foundRecords.push({
              line: totalLines,
              addr: data.addr,
              privHex: data.privHex,
              balance: balance,
              tokens: data.tokens
            });
          }
        } catch (e) {
          reportLines.push(`  ⚠️  Erro na linha ${totalLines}: ${e.message}`);
        }
      }
      
      allResults[puzzle] = {
        total_lines: totalLines,
        found: foundRecords.length,
        records: foundRecords
      };
      
      const summary = `Total: ${totalLines} linhas | Encontrados: ${foundRecords.length}`;
      console.log(summary);
      reportLines.push(summary);
      reportLines.push('');
      
      if (foundRecords.length > 0) {
        reportLines.push('RECORDS COM SALDO ≠ 0:');
        reportLines.push(`${'Linha'.padEnd(8)} ${'Endereço'.padEnd(45)} ${'Saldo (BNB)'.padEnd(15)}`);
        reportLines.push('-'.repeat(80));
        
        for (const record of foundRecords) {
          const lineStr = `${String(record.line).padEnd(8)} ${record.addr.padEnd(45)} ${String(record.balance).padEnd(15)}`;
          reportLines.push(lineStr);
          if (record.privHex) {
            reportLines.push(`  └─ Privkey (Hex): ${record.privHex}`);
          }
          if (record.tokens && record.tokens.length > 0) {
            reportLines.push(`  └─ Tokens: ${record.tokens.length} encontrados`);
          }
        }
        reportLines.push('');
      }
    } catch (e) {
      const error = `❌ Erro ao processar: ${e.message}`;
      console.log(error);
      reportLines.push(error);
      reportLines.push('');
    }
  }
  
  // Resumo final
  reportLines.push('='.repeat(80));
  reportLines.push('RESUMO GERAL');
  reportLines.push('='.repeat(80));
  
  let totalEncontrados = 0;
  for (const puzzle of puzzles) {
    if (puzzle in allResults) {
      const result = allResults[puzzle];
      const status = result.found === 0 ? '✓' : '⚠️';
      const summaryLine = `${status} ${puzzle}: ${result.found} com saldo | ${result.total_lines} total`;
      console.log(summaryLine);
      reportLines.push(summaryLine);
      totalEncontrados += result.found;
    }
  }
  
  const finalLine = `\nTotal Geral: ${totalEncontrados} endereços com saldo`;
  console.log(finalLine);
  reportLines.push(finalLine);
  
  // Salvar relatório
  fs.writeFileSync(reportFile, reportLines.join('\n'));
  
  console.log(`\n📄 Relatório salvo: reports/bnb_report_${timestamp}.txt`);
  
  return allResults;
}

// Executar se for chamado diretamente
if (import.meta.url === `file://${process.argv[1]}`) {
  checkBnbBatchHistory();
}

export { checkBnbBatchHistory };
