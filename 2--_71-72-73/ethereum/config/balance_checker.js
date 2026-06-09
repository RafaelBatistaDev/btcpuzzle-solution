/**
 * Ethereum Balance Checker - Apenas consulta saldo
 * Não interfere com o solver
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import axios from 'axios';
import { CryptoEngine } from './utils.js';
import { PUZZLE_CONFIG, RUNTIME_CONFIG } from './config.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

class EthereumBalanceChecker {
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
   * Consulta saldo via Etherscan API V2 em lotes
   */
  async checkBalances(addresses) {
    const results = [];
    const apiUrl = RUNTIME_CONFIG.RPC_ENDPOINT; // points to https://api.etherscan.io/v2/api
    const apiKey = RUNTIME_CONFIG.ETHERSCAN_KEY;

    this.log(`📡 Usando Etherscan API V2: ${apiUrl}`);

    for (let offset = 0; offset < addresses.length; offset += 20) {
      const chunk = addresses.slice(offset, offset + 20);
      const addressesStr = chunk.map(addr => addr.toLowerCase()).join(',');
      
      this.log(`📡 Consultando lote de ${chunk.length} endereços via Etherscan...`);

      try {
        const resp = await axios.get(apiUrl, {
          params: {
            chainid: 1, // Ethereum Mainnet
            module: 'account',
            action: 'balancemulti',
            address: addressesStr,
            tag: 'latest',
            apikey: apiKey
          },
          headers: {
            'User-Agent': 'Puzzle-Solver-Client/1.0',
            'Connection': 'keep-alive'
          },
          timeout: RUNTIME_CONFIG.TIMEOUT_MS,
          validateStatus: () => true
        });

        if (resp.status === 429 || (resp.data && resp.data.result && typeof resp.data.result === 'string' && resp.data.result.includes('rate limit reached'))) {
          this.log(`⚠️ Etherscan Rate limit atingido. Aguardando 5s...`);
          await new Promise(r => setTimeout(r, 5000));
          offset -= 20; // Repete este lote
          continue;
        }

        if (resp.status === 200 && resp.data.status === '1' && Array.isArray(resp.data.result)) {
          resp.data.result.forEach(item => {
            const addr = item.account;
            const balanceWei = BigInt(item.balance || '0');
            const balanceEth = Number(balanceWei) / 1e18;
            const checksumAddr = CryptoEngine.toChecksumAddress(addr);

            results.push({
              address: checksumAddr,
              balanceWei: item.balance || '0',
              balanceEth: balanceEth.toFixed(8),
              timestamp: new Date().toISOString(),
            });

            if (balanceWei > 0n) {
              const alert = '\x07'.repeat(5);
              this.log(`${alert}\n${'='.repeat(80)}\n🚨 ETHEREUM SALDO ENCONTRADO! 🚨\nEndereço: ${checksumAddr}\nSaldo: ${balanceEth.toFixed(8)} ETH\n${'='.repeat(80)}\n`);
            }
          });
        } else if (resp.data && resp.data.message) {
          this.log(`⚠️ Mensagem Etherscan para lote: ${resp.data.message} (${resp.data.result})`);
        }
      } catch (err) {
        this.log(`⚠️ Erro ao consultar lote de endereços: ${err.message}`);
      }

      // Delay entre requisições
      if (offset + 20 < addresses.length) {
        await new Promise(r => setTimeout(r, RUNTIME_CONFIG.DELAY_MS));
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
          coin: 'ethereum',
          puzzle: this.puzzleId,
          address: r.address,
          balance: r.balanceWei,
          formatted_balance: `${r.balanceEth} ETH (${r.balanceWei} Wei)`,
          timestamp_verified: r.timestamp
        };
        fs.appendFileSync(foundFile, JSON.stringify(record) + '\n');
        this.log(`  → ${r.address}: ${r.balanceEth} ETH`);
      });
    } else {
      this.log(`  Nenhum endereço com saldo encontrado.`);
    }
  }

  /**
   * Executa verificação
   */
  async run() {
    this.log(`🔍 Ethereum P${this.puzzleId} - Balance Checker`);
    const candidates = this.getCandidates();
    this.log(`📋 Total de endereços a verificar: ${candidates.length}`);

    const results = await this.checkBalances(candidates);
    this.saveReport(results);
  }
}

// Executa
const puzzleId = Number(process.env.PUZZLE_ID || 71);
const checker = new EthereumBalanceChecker(puzzleId);
checker.run().catch(err => {
  console.error('❌ Erro:', err);
  process.exit(1);
});
