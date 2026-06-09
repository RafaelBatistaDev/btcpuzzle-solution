/**
 * Ethereum Balance Verifier - Módulo centralizado de verificação de saldos
 * Usado por: balance_checker.js, solver.js, e scripts principais
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import axios from 'axios';
import { CryptoEngine } from './utils.js';
import { RUNTIME_CONFIG } from './config.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export class EthereumBalanceVerifier {
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
   * Verifica saldos de múltiplos endereços Ethereum via RPC
   * @param {array} addresses - Lista de endereços Ethereum
   * @param {number} puzzleId - ID do puzzle (opcional, para logging)
   * @returns {Promise<array>} Array com resultados {address, balanceWei, balanceEth, timestamp}
   */
  async verifyBalances(addresses, puzzleId = null) {
    if (!addresses || addresses.length === 0) return [];

    const puzzle = puzzleId || this.puzzleId;
    const results = [];
    const foundCount = { total: 0, addresses: [] };
    const apiUrl = this.rpcUrl; // points to https://api.etherscan.io/v2/api
    const apiKey = RUNTIME_CONFIG.ETHERSCAN_KEY;

    this.log(`🔍 Ethereum Verifier: Checando ${addresses.length} endereços...`);
    this.log(`📡 Usando Etherscan API V2: ${apiUrl}`);

    try {
      // Processa em fatias de 20 (limite Etherscan)
      for (let offset = 0; offset < addresses.length; offset += 20) {
        const chunk = addresses.slice(offset, offset + 20);
        const addressesStr = chunk.map(addr => addr.toLowerCase()).join(',');
        
        this.log(`📡 Consultando lote de ${chunk.length} endereços...`);

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

        this.logApiResponse(chunk, 'balancemulti', resp.status, resp.data);

        // Detectar rate limiting
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

            const result = {
              address: checksumAddr,
              balanceWei: item.balance || '0',
              balanceEth: balanceEth.toFixed(8),
              timestamp: new Date().toISOString(),
            };

            results.push(result);

            // Se encontrou saldo > 0, alerta e salva
            if (balanceWei > 0n) {
              foundCount.total++;
              foundCount.addresses.push(checksumAddr);

              const alert = '\x07'.repeat(5);
              const puzzleStr = puzzle ? ` [PUZZLE #${puzzle}]` : '';
              this.log(`${alert}\n${'='.repeat(80)}\n🚨 ETHEREUM SALDO ENCONTRADO!${puzzleStr} 🚨\nEndereço: ${checksumAddr}\nSaldo: ${balanceEth.toFixed(8)} ETH\n${'='.repeat(80)}\n`);

              this._saveToFoundFile('ethereum', puzzle, checksumAddr, item.balance, `${balanceEth.toFixed(8)} ETH`);
            }
          });
        } else if (resp.data && resp.data.message) {
          this.log(`⚠️ Mensagem Etherscan: ${resp.data.message} (${resp.data.result})`);
        }

        // Delay entre requisições
        if (offset + 20 < addresses.length) {
          await new Promise(r => setTimeout(r, this.delay));
        }
      }
    } catch (err) {
      this.logApiResponse(addresses, 'balancemulti', err.response?.status || 0, { error: err.message });
      this.log(`⚠️ Erro Etherscan API V2 Ethereum: ${err.message}`);
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

export default EthereumBalanceVerifier;
