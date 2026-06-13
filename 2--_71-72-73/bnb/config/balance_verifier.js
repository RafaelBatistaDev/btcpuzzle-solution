/**
 * BNB Balance Verifier - Módulo centralizado de verificação de saldos
 * Usado por: balance_checker.js, solver.js, e scripts principais
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import axios from 'axios';
import { CryptoEngine } from './utils.js';
import { RUNTIME_CONFIG } from './config.js';
import { dispatchEvmBalances } from '../../solver_batch_guard.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export class BnbBalanceVerifier {
  constructor(puzzleId = null) {
    this.puzzleId = puzzleId;
    this.batchSize = 10; // Limite JSON-RPC Ankr
    this.delay = 500; // ms entre requisições
    this.rpcUrl = RUNTIME_CONFIG.RPC_ENDPOINT;
    this.foundFile = path.join(__dirname, '..', '..', 'relatorio_final', 'saldos_encontrados.jsonl');
    this.ensureFoundDir();
  }

  ensureFoundDir() {
    const dir = path.dirname(this.foundFile);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  ensureLogDir() {
    const puzzle = this.puzzleId || 72;
    const logDir = path.join(__dirname, '..', `PUZZLE_${puzzle}`);
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }
    return logDir;
  }

  logApiResponse(addresses, method, httpStatus, responseData) {
    try {
      const logDir = this.ensureLogDir();
      const timestamp = new Date().toISOString();
      const logFile = path.join(logDir, 'logs.jsonl');
      
      const record = {
        timestamp,
        method,
        addressCount: Array.isArray(addresses) ? addresses.length : 1,
        addresses: Array.isArray(addresses) ? addresses : [addresses],
        httpStatus,
        response: responseData,
      };
      
      fs.appendFileSync(logFile, JSON.stringify(record) + '\n');
    } catch (e) {
      // Silenciosamente falha se não conseguir logar
    }
  }

  log(msg) {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] ${msg}`);
  }

  /**
   * Verifica saldos de múltiplos endereços BNB via RPC
   * @param {array} addresses - Lista de endereços BNB
   * @param {number} puzzleId - ID do puzzle (opcional, para logging)
   * @returns {Promise<array>} Array com resultados {address, balanceWei, balanceEth, timestamp}
   */
  async verifyBalances(addresses, puzzleId = null) {
    if (!addresses || addresses.length === 0) return [];

    const puzzle = puzzleId || this.puzzleId;
    const results = [];
    const foundCount = { total: 0, addresses: [] };

    this.log(`🔍 BNB Verifier: Checando ${addresses.length} endereços...`);
    this.log(`📡 RPC batch eth_getBalance (${RUNTIME_CONFIG.RPC_ENDPOINTS?.length || 1} endpoint(s))`);

    try {
      const { results: balanceMap } = await dispatchEvmBalances(
        axios,
        addresses,
        RUNTIME_CONFIG.RPC_ENDPOINTS || [RUNTIME_CONFIG.RPC_ENDPOINT],
        {
          timeoutMs: RUNTIME_CONFIG.TIMEOUT_MS,
          retryMs: RUNTIME_CONFIG.RPC_RETRY_MS || 15000,
          toChecksum: (addr) => CryptoEngine.toChecksumAddress(addr),
        }
      );

      for (const addr of addresses) {
        const checksumAddr = CryptoEngine.toChecksumAddress(addr);
        const info = balanceMap[checksumAddr];
        if (!info) continue;

        const balanceWei = info.balance;
        const balanceBnb = Number(balanceWei) / 1e18;

        const result = {
          address: checksumAddr,
          balanceWei: balanceWei.toString(),
          balanceBnb: balanceBnb.toFixed(8),
          timestamp: new Date().toISOString(),
        };
        results.push(result);

        if (balanceWei > 0n) {
          foundCount.total++;
          foundCount.addresses.push(checksumAddr);
          const alert = '\x07'.repeat(5);
          const puzzleStr = puzzle ? ` [PUZZLE #${puzzle}]` : '';
          this.log(`${alert}\n${'='.repeat(80)}\n🚨 BNB SALDO ENCONTRADO!${puzzleStr} 🚨\nEndereço: ${checksumAddr}\nSaldo: ${balanceBnb.toFixed(8)} BNB\n${'='.repeat(80)}\n`);
          this._saveToFoundFile('bnb', puzzle, checksumAddr, balanceWei.toString(), `${balanceBnb.toFixed(8)} BNB`);
        }
      }
    } catch (err) {
      this.logApiResponse(addresses, 'eth_getBalance', err.response?.status || 0, { error: err.message });
      this.log(`⚠️  Erro RPC BNB: ${err.message}`);
    }

    if (foundCount.total > 0) {
      this.log(`💰 Total encontrado: ${foundCount.total} endereço(s) com saldo!`);
    }

    return results;
  }

  /**
   * Salva registro no arquivo consolidado de achados
   */
  _saveToFoundFile(coin, puzzle, address, balanceWei, formatted) {
    const record = {
      coin,
      puzzle,
      address,
      balance: balanceWei,
      formatted_balance: formatted,
      timestamp_verified: new Date().toISOString()
    };

    try {
      fs.appendFileSync(this.foundFile, JSON.stringify(record) + '\n');
    } catch (err) {
      this.log(`⚠️  Erro ao salvar achado: ${err.message}`);
    }
  }
}

export default BnbBalanceVerifier;
