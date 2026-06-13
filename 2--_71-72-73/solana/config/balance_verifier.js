/**
 * Solana Balance Verifier - Módulo centralizado de verificação de saldos
 * Usado por: balance_checker.js, solver.js, e scripts principais
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import axios from 'axios';
import { CryptoEngine } from './utils.js';
import { RUNTIME_CONFIG } from './config.js';
import { dispatchSolanaBalances } from '../../solver_batch_guard.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export class SolanaBalanceVerifier {
  constructor(puzzleId = null) {
    this.puzzleId = puzzleId;
    this.batchSize = 10;
    this.delay = 500;
    this.rpcUrl = RUNTIME_CONFIG.RPC_ENDPOINT;
    this.foundFile = path.join(__dirname, '..', '..', 'relatorio_final', 'solana_addresses_with_balance.jsonl');
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
   * Verifica saldos de múltiplos endereços Solana via RPC
   * @param {array} addresses - Lista de endereços Solana (base58)
   * @param {number} puzzleId - ID do puzzle (opcional, para logging)
   * @returns {Promise<array>} Array com resultados {address, balanceLamports, balanceSol, timestamp}
   */
  async verifyBalances(addresses, puzzleId = null) {
    if (!addresses || addresses.length === 0) return [];

    const puzzle = puzzleId || this.puzzleId;
    const results = [];
    const foundCount = { total: 0, addresses: [] };

    this.log(`🔍 Solana Verifier: Checando ${addresses.length} endereços...`);
    this.log(`📡 RPC batch getBalance`);

    try {
      const { results: balanceMap } = await dispatchSolanaBalances(
        axios,
        addresses,
        this.rpcUrl,
        {
          timeoutMs: RUNTIME_CONFIG.TIMEOUT_MS,
          retryMs: RUNTIME_CONFIG.RPC_RETRY_MS || 15000,
        }
      );

      for (const addr of addresses) {
        const info = balanceMap[addr];
        if (!info) continue;

        const balanceLamports = info.balance;
        const balanceSol = Number(balanceLamports) / 1e9;

        const result = {
          address: addr,
          balanceLamports: balanceLamports.toString(),
          balanceSol: balanceSol.toFixed(9),
          timestamp: new Date().toISOString(),
        };
        results.push(result);

        if (balanceLamports > 0n) {
          foundCount.total++;
          foundCount.addresses.push(addr);
          const alert = '\x07'.repeat(5);
          const puzzleStr = puzzle ? ` [PUZZLE #${puzzle}]` : '';
          this.log(`${alert}\n${'='.repeat(80)}\n🚨 SOLANA SALDO ENCONTRADO!${puzzleStr} 🚨\nEndereço: ${addr}\nSaldo: ${balanceSol.toFixed(9)} SOL\n${'='.repeat(80)}\n`);
          this._saveToFoundFile('solana', puzzle, addr, balanceLamports.toString(), `${balanceSol.toFixed(9)} SOL`);
        }
      }
    } catch (err) {
      this.logApiResponse(addresses, 'getBalance', err.response?.status || 0, { error: err.message });
      this.log(`⚠️  Erro RPC Solana: ${err.message}`);
    }

    if (foundCount.total > 0) {
      this.log(`💰 Total encontrado: ${foundCount.total} endereço(s) com saldo!`);
    }

    return results;
  }

  /**
   * Salva registro no arquivo consolidado de achados
   */
  _saveToFoundFile(coin, puzzle, address, balanceLamports, formatted) {
    const record = {
      coin,
      puzzle,
      address,
      balance: balanceLamports,
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

export default SolanaBalanceVerifier;
