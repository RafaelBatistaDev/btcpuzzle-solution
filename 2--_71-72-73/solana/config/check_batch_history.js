#!/usr/bin/env node

/**
 * Solana Batch History Checker
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

function checkSolanaBatchHistory() {
  const reportsDir = path.join(__dirname, '..', '..', 'reports');
  
  if (!fs.existsSync(reportsDir)) {
    fs.mkdirSync(reportsDir, { recursive: true });
  }
  
  const puzzles = ['PUZZLE_71', 'PUZZLE_72', 'PUZZLE_73'];
  const timestamp = formatDate(new Date());
  const reportFile = path.join(reportsDir, `solana_report_${timestamp}.txt`);
  
  const allResults = {};
  const reportLines = [];
  
  reportLines.push('='.repeat(80));
  reportLines.push('SOLANA BATCH HISTORY REPORT');
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
      
      if (foundRecords.length > 0) {
        reportLines.push('');
        foundRecords.forEach(rec => {
          const recLine = `  Line ${rec.line}: ${rec.addr} | Balance: ${rec.balance} | PrivHex: ${rec.privHex}`;
          console.log(recLine);
          reportLines.push(recLine);
        });
      }
      
      reportLines.push('');
    } catch (err) {
      const errMsg = `❌ Erro ao processar ${puzzle}: ${err.message}`;
      console.error(errMsg);
      reportLines.push(errMsg);
      reportLines.push('');
    }
  }
  
  // Salva relatório em arquivo
  fs.writeFileSync(reportFile, reportLines.join('\n'), 'utf-8');
  console.log(`\n✅ Relatório salvo em: ${reportFile}`);
  
  return allResults;
}

// Executa
checkSolanaBatchHistory();
