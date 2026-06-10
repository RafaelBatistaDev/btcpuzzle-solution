/**
 * Solana Balance Checker - Apenas consulta saldo
 * Não interfere com o solver
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import axios from 'axios';
import { CryptoEngine } from './utils.js';
import { PUZZLE_CONFIG, RUNTIME_CONFIG } from './config.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

class SolanaBalanceChecker {
  constructor(puzzleId) {
    this.puzzleId = puzzleId;
    this.config = PUZZLE_CONFIG[puzzleId];
    this.reportDir = path.join(__dirname, '..', '..', 'reports');
    this.candidateDir = path.join(__dirname, '..', '..', 'candidates', `puzzle_${puzzleId}`);
    
    if (!fs.existsSync(this.reportDir)) {
      fs.mkdirSync(this.reportDir, { recursive: true });
    }
  }

  log(msg) {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] ${msg}`);
  }

  /**
   * Lê candidates do cache (se existirem)
   */
  getCandidates() {
    const candidates = [];
    
    if (fs.existsSync(this.candidateDir)) {
      try {
        const files = fs.readdirSync(this.candidateDir);
        files.forEach(file => {
          if (file.endsWith('.txt') || file.endsWith('.json')) {
            const content = fs.readFileSync(path.join(this.candidateDir, file), 'utf-8');
            if (content.trim()) {
              candidates.push(...content.trim().split('\n').filter(a => a.length > 30));
            }
          }
        });
      } catch (e) {
        this.log(`⚠️  Erro ao ler candidates: ${e.message}`);
      }
    }

    if (candidates.length === 0) {
      candidates.push(this.config.target);
    }

    return [...new Set(candidates)];
  }

  /**
   * Consulta saldo via RPC Solana
   */
  async checkBalances(addresses) {
    const results = [];
    const rpcUrl = RUNTIME_CONFIG.RPC_ENDPOINT;

    this.log(`📡 Usando RPC: ${rpcUrl}`);
    this.log(`📋 Método: getBalance (saldo nativo SOL)`);

    for (let i = 0; i < addresses.length; i++) {
      const addr = addresses[i];
      this.log(`📡 Verificando ${i + 1}/${addresses.length}: ${addr.substring(0, 10)}...`);

      try {
        const payload = {
          jsonrpc: '2.0',
          method: 'getBalance',
          params: [addr],
          id: 1
        };

        const resp = await axios.post(rpcUrl, payload, {
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'User-Agent': 'Puzzle-Solver-Client/1.0',
            'Connection': 'keep-alive'
          },
          timeout: RUNTIME_CONFIG.TIMEOUT_MS,
        });

        if (resp.data.result && resp.data.result.value !== undefined) {
          const balanceLamports = BigInt(resp.data.result.value || 0);
          const balanceSol = Number(balanceLamports) / 1e9;

          results.push({
            address: addr,
            balanceLamports: balanceLamports.toString(),
            balanceSol: balanceSol.toFixed(9),
            timestamp: new Date().toISOString(),
          });

          if (balanceLamports > 0n) {
            const alert = '\x07'.repeat(5);
            this.log(`${alert}\n${'='.repeat(80)}\n🚨 SOLANA SALDO ENCONTRADO! 🚨\nEndereço: ${addr}\nSaldo: ${balanceSol.toFixed(9)} SOL\n${'='.repeat(80)}\n`);
          }
        } else if (resp.data.error) {
          this.log(`⚠️  Erro RPC para ${addr}: [${resp.data.error.code}] ${resp.data.error.message}`);
        }
      } catch (err) {
        if (err.response?.status === 429 || err.message?.includes('rate')) {
          this.log(`⚠️  [RATE LIMIT] ${err.message}`);
          await new Promise(r => setTimeout(r, RUNTIME_CONFIG.RETRY_DELAY_MS));
        } else {
          this.log(`⚠️  Erro ao consultar ${addr}: ${err.message}`);
        }
      }

      if (i < addresses.length - 1) {
        await new Promise(r => setTimeout(r, RUNTIME_CONFIG.BATCH_DELAY_MS));
      }
    }

    return results;
  }

  /**
   * Salva relatório
   */
  saveReport(results) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '');
    const filename = `balance_check_${this.puzzleId}_${timestamp}.jsonl`;
    const filepath = path.join(this.reportDir, filename);

    results.forEach(r => {
      fs.appendFileSync(filepath, JSON.stringify(r) + '\n');
    });

    this.log(`✅ Relatório salvo: ${filename}`);
    
    const withBalance = results.filter(r => Number(r.balanceLamports) > 0);
    if (withBalance.length > 0) {
      this.log(`💰 Endereços com saldo: ${withBalance.length}`);
      
      const foundFile = path.join(__dirname, '..', '..', 'relatorio_final', 'solana_addresses_with_balance.jsonl');
      const foundDir = path.dirname(foundFile);
      if (!fs.existsSync(foundDir)) fs.mkdirSync(foundDir, { recursive: true });
      
      withBalance.forEach(r => {
        const record = {
          coin: 'solana',
          puzzle: this.puzzleId,
          address: r.address,
          balance: r.balanceLamports,
          formatted_balance: `${r.balanceSol} SOL (${r.balanceLamports} Lamports)`,
          timestamp_verified: r.timestamp
        };
        fs.appendFileSync(foundFile, JSON.stringify(record) + '\n');
        this.log(`  → ${r.address}: ${r.balanceSol} SOL`);
      });
    } else {
      this.log(`  Nenhum endereço com saldo encontrado.`);
    }
  }

  /**
   * Executa verificação
   */
  async run() {
    this.log(`🔍 Solana P${this.puzzleId} - Balance Checker`);
    const candidates = this.getCandidates();
    this.log(`📋 Total de endereços a verificar: ${candidates.length}`);

    const results = await this.checkBalances(candidates);
    this.saveReport(results);
  }
}

// Executa
const puzzleId = Number(process.env.PUZZLE_ID || 71);
const checker = new SolanaBalanceChecker(puzzleId);
checker.run().catch(err => {
  console.error('❌ Erro:', err);
  process.exit(1);
});
