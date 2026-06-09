/**
 * BNB Balance Checker - Apenas consulta saldo
 * Não interfere com o solver
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import axios from 'axios';
import { CryptoEngine } from './utils.js';
import { PUZZLE_CONFIG, RUNTIME_CONFIG } from './config.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

class BnbBalanceChecker {
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
    
    // Se houver pasta de candidates, lê os endereços
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

    // Se não houver candidates, verifica o target
    if (candidates.length === 0) {
      candidates.push(this.config.target);
    }

    return [...new Set(candidates)]; // Remove duplicatas
  }

  /**
   * Consulta saldo via RPC pública (Ankr) - SEM chave de API necessária
   */
  async checkBalances(addresses) {
    const results = [];
    const batchSize = 10; // Limite para JSON-RPC batch
    const rpcUrl = RUNTIME_CONFIG.RPC_ENDPOINT;

    this.log(`📡 Usando RPC: ${rpcUrl} (Ankr Token API)`);

    for (let i = 0; i < addresses.length; i++) {
      const addr = addresses[i];
      this.log(`📡 Verificando ${i + 1}/${addresses.length}: ${addr.substring(0, 10)}...`);

      try {
        // Usa Ankr Token API - ankr_getAccountBalance
        const payload = {
          jsonrpc: '2.0',
          method: 'ankr_getAccountBalance',
          params: {
            blockchain: ['bsc'],
            walletAddress: addr.toLowerCase(),
            onlyWhitelisted: true,
            nativeFirst: true
          },
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

        if (resp.data.result && resp.data.result.assets) {
          const assets = resp.data.result.assets;
          const bnbBalance = assets.find(a => a.tokenSymbol === 'BNB');
          
          if (bnbBalance) {
            const balanceWei = BigInt(bnbBalance.balanceRawInteger || '0');
            const balanceBnb = Number(balanceWei) / 1e18;
            const checksumAddr = CryptoEngine.toChecksumAddress(addr);

            results.push({
              address: checksumAddr,
              balanceWei: bnbBalance.balanceRawInteger,
              balanceBnb: balanceBnb.toFixed(8),
              timestamp: new Date().toISOString(),
            });

            if (balanceWei > 0n) {
              const alert = '\x07'.repeat(5);
              this.log(`${alert}\n${'='.repeat(80)}\n🚨 BNB SALDO ENCONTRADO! 🚨\nEndereço: ${checksumAddr}\nSaldo: ${balanceBnb.toFixed(8)} BNB\n${'='.repeat(80)}\n`);
            }
          }
        } else if (resp.data.error) {
          this.log(`⚠️  Erro Ankr para ${addr}: [${resp.data.error.code}] ${resp.data.error.message}`);
        }
      } catch (err) {
        this.log(`⚠️  Erro ao consultar ${addr}: ${err.message}`);
      }

      // Delay entre requisições
      if (i < addresses.length - 1) {
        await new Promise(r => setTimeout(r, 500));
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
    
    // Resumo e salva achados em arquivo consolidado
    const withBalance = results.filter(r => Number(r.balanceWei) > 0);
    if (withBalance.length > 0) {
      this.log(`💰 Endereços com saldo: ${withBalance.length}`);
      
      // Salva em arquivo consolidado de achados
      const foundFile = path.join(__dirname, '..', 'relatorio_final', 'saldos_encontrados.jsonl');
      const foundDir = path.dirname(foundFile);
      if (!fs.existsSync(foundDir)) fs.mkdirSync(foundDir, { recursive: true });
      
      withBalance.forEach(r => {
        const record = {
          coin: 'bnb',
          puzzle: this.puzzleId,
          address: r.address,
          balance: r.balanceWei,
          formatted_balance: `${r.balanceEth} BNB (${r.balanceWei} Wei)`,
          timestamp_verified: r.timestamp
        };
        fs.appendFileSync(foundFile, JSON.stringify(record) + '\n');
        this.log(`  → ${r.address}: ${r.balanceEth} BNB`);
      });
    } else {
      this.log(`  Nenhum endereço com saldo encontrado.`);
    }
  }

  /**
   * Executa verificação
   */
  async run() {
    this.log(`🔍 BNB P${this.puzzleId} - Balance Checker`);
    const candidates = this.getCandidates();
    this.log(`📋 Total de endereços a verificar: ${candidates.length}`);

    const results = await this.checkBalances(candidates);
    this.saveReport(results);
  }
}

// Executa
const puzzleId = Number(process.env.PUZZLE_ID || 71);
const checker = new BnbBalanceChecker(puzzleId);
checker.run().catch(err => {
  console.error('❌ Erro:', err);
  process.exit(1);
});
