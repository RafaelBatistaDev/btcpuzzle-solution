/**
 * BNB (Binance Smart Chain) Puzzle Solver - Simplificado
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import axios from 'axios';
import { CryptoEngine } from './utils.js';
import { PUZZLE_CONFIG, RUNTIME_CONFIG } from './config.js';
import {
  handleBatchRpcFailure,
  logBatchItemErrors,
  getEvmResult,
  rpcHost,
  isTransientRpcMessage,
} from '../../solver_batch_guard.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Helper: Sleep assíncrono para respeitar rate limits
 */
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export class BnbSolver {
  constructor(puzzleId) {
    this.rpcEndpoints = (RUNTIME_CONFIG.RPC_ENDPOINTS?.length
      ? RUNTIME_CONFIG.RPC_ENDPOINTS
      : [RUNTIME_CONFIG.RPC_ENDPOINT]).filter((url) => url && !url.includes('YOUR_'));

    if (this.rpcEndpoints.length === 0) {
      throw new Error('❌ [BNB] Nenhum RPC_ENDPOINT configurado!');
    }

    this.rpcIndex = 0;
    this.puzzleId = puzzleId;
    this.provider = rpcHost(this.rpcEndpoints[0]);
    console.log(`\n✅ [BNB] RPCs: ${this.rpcEndpoints.map((u) => rpcHost(u)).join(' → ')}\n`);
    this.config = PUZZLE_CONFIG[puzzleId];
    this.rangeMin = BigInt(this.config.rangeMin);
    this.rangeMax = BigInt(this.config.rangeMax);
    
    // 🔐 TRAVA QUÂNTICA DE RANGE: Validação rigorosa de BigInt
    if (this.rangeMin <= 0n) throw new Error(`❌ PUZZLE_${puzzleId}: rangeMin deve ser > 0 (${this.rangeMin.toString()})`);
    if (this.rangeMax <= 0n) throw new Error(`❌ PUZZLE_${puzzleId}: rangeMax deve ser > 0 (${this.rangeMax.toString()})`);
    if (this.rangeMin > this.rangeMax) throw new Error(`❌ PUZZLE_${puzzleId}: rangeMin (${this.rangeMin.toString()}) > rangeMax (${this.rangeMax.toString()})`);
    
    const initialBigInt = BigInt(this.config.initialPrivkey);
    if (initialBigInt < this.rangeMin || initialBigInt > this.rangeMax) {
      throw new Error(`❌ PUZZLE_${puzzleId}: initialPrivkey (${initialBigInt.toString()}) fora do range [${this.rangeMin.toString()}, ${this.rangeMax.toString()}]`);
    }
    
    this.stateFile = path.join(__dirname, '..', 'cache', `puzzle_${puzzleId}.json`);
    this.logFile = path.join(__dirname, '..', 'logs', `puzzle_${puzzleId}.log`);
    this.resultsDir = path.join(__dirname, '..', `PUZZLE_${puzzleId}`);
    
    this._ensureDirs();
    this.state = this._loadState();
    this.batch = [];
  }

  _ensureDirs() {
    [path.dirname(this.stateFile), path.dirname(this.logFile), this.resultsDir].forEach(dir => {
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    });
  }

  _loadState() {
    let state = {
      lastPrivkey: this.config.initialPrivkey,
      totalChecked: 0,
      dailyRequests: {
        date: new Date().toISOString().split('T')[0],
        count: 0
      }
    };

    if (fs.existsSync(this.stateFile)) {
      try {
        const saved = JSON.parse(fs.readFileSync(this.stateFile, 'utf-8'));
        state = { ...state, ...saved };
      } catch (e) {
        this.log(`⚠️  Erro ao carregar estado: ${e.message}. Reiniciando do zero.`);
      }
    }

    if (!state.dailyRequests) {
      state.dailyRequests = {
        date: new Date().toISOString().split('T')[0],
        count: 0
      };
    }

    // 🔐 TRAVA QUÂNTICA: Garante que lastPrivkey é uma string hex válida dentro do range
    let hasValidFormat = false;
    if (typeof state.lastPrivkey === 'string') {
      if (state.lastPrivkey.startsWith('0x')) {
        hasValidFormat = /^[0-9a-fA-F]+$/.test(state.lastPrivkey.slice(2));
      } else {
        hasValidFormat = /^[0-9]+$/.test(state.lastPrivkey);
      }
    }

    if (!hasValidFormat) {
      state.lastPrivkey = this.config.initialPrivkey;
    } else {
      try {
        const loadedPrivkey = BigInt(state.lastPrivkey);
        if (loadedPrivkey < this.rangeMin || loadedPrivkey > this.rangeMax) {
          this.log(`⚠️  lastPrivkey fora do range. Reiniciando do initialPrivkey.`);
          state.lastPrivkey = this.config.initialPrivkey;
        }
      } catch (e) {
        this.log(`⚠️  lastPrivkey inválido (${state.lastPrivkey}). Reiniciando do initialPrivkey.`);
        state.lastPrivkey = this.config.initialPrivkey;
      }
    }

    return state;
  }

  _saveState() {
    fs.writeFileSync(this.stateFile, JSON.stringify(this.state, null, 2), 'utf-8');
  }

  log(msg) {
    const timestamp = new Date().toISOString();
    const line = `[${timestamp}] [PUZZLE_${this.puzzleId}] ${msg}`;
    console.log(line);
    fs.appendFileSync(this.logFile, line + '\n');
  }

  _activeRpcUrl() {
    return this.rpcEndpoints[this.rpcIndex % this.rpcEndpoints.length];
  }

  _rotateRpc() {
    if (this.rpcEndpoints.length <= 1) return;
    this.rpcIndex = (this.rpcIndex + 1) % this.rpcEndpoints.length;
    this.provider = rpcHost(this._activeRpcUrl());
    this.log(`🔄 Alternando RPC → ${this.provider}`);
  }

  /**
   * Verifica o limite diário de requisições e aguarda se atingido
   */
  async checkRateLimit() {
    const today = new Date().toISOString().split('T')[0];
    
    if (this.state.dailyRequests.date !== today) {
      this.state.dailyRequests.date = today;
      this.state.dailyRequests.count = 0;
      this._saveState();
    }

    const limit = RUNTIME_CONFIG.MAX_REQ_24H;
    if (this.state.dailyRequests.count >= limit) {
      this.log(`⚠️ Limite diário de requisições atingido (${this.state.dailyRequests.count}/${limit}).`);
      
      while (true) {
        const now = new Date();
        const midnight = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
        const msToMidnight = midnight.getTime() - now.getTime();
        const minutesLeft = Math.ceil(msToMidnight / (1000 * 60));
        
        this.log(`💤 Dormindo por 5 minutos... (restam ~${minutesLeft} minutos para o próximo dia UTC)`);
        
        const sleepMs = Math.min(5 * 60 * 1000, msToMidnight + 5000);
        await new Promise(r => setTimeout(r, sleepMs));
 
        const currentDay = new Date().toISOString().split('T')[0];
        if (currentDay !== today) {
          this.state.dailyRequests.date = currentDay;
          this.state.dailyRequests.count = 0;
          this._saveState();
          this.log(`🌅 Novo dia iniciado (${currentDay}). Retomando buscas!`);
          break;
        }
      }
    }
  }

  /**
   * Consulta BNB RPC - Balance via JSON-RPC Batch
   * Com detecção e reação a erro 429 (Rate Limit)
   */
  async queryRPC(addresses) {
    await this.checkRateLimit();

    // 🕐 ESCALONAMENTO TEMPORAL: Aguarda delay inicial para não cruzar com outros solvers
    if (RUNTIME_CONFIG.INITIAL_DELAY_MS > 0) {
      this.log(`⏰ Aguardando ${RUNTIME_CONFIG.INITIAL_DELAY_MS}ms (turnista BNB)...`);
      await sleep(RUNTIME_CONFIG.INITIAL_DELAY_MS);
    }

    const result = {};
    const url = this._activeRpcUrl();

    if (addresses.length === 0) return result;

    try {
      this.log(`📡 Consultando lote de ${addresses.length} endereços via ${this.provider}...`);
      this.state.dailyRequests.count++;
      this._saveState();

      const payloads = addresses.map((addr, index) => ({
        jsonrpc: '2.0',
        method: 'eth_getBalance',
        params: [addr.toLowerCase(), 'latest'],
        id: index + 1
      }));

      try {
        const resp = await axios.post(url, payloads, {
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'User-Agent': 'Puzzle-Solver-Client/1.0',
            'Connection': 'keep-alive'
          },
          timeout: RUNTIME_CONFIG.TIMEOUT_MS,
          validateStatus: () => true
        });

        if (resp.status === 429 || isTransientRpcMessage(JSON.stringify(resp.data || ''))) {
          this.log(`⚠️ [${this.provider}] Rate limit / bloqueio temporário. Alternando RPC...`);
          this._rotateRpc();
          await sleep(RUNTIME_CONFIG.RPC_RETRY_MS);
          return await this.queryRPC(addresses);
        }

        if (resp.status === 200 && Array.isArray(resp.data)) {
          let itemErrors = 0;
          let firstError = '';
          resp.data.forEach((responseItem, idx) => {
            const addr = addresses[idx];
            if (responseItem.result) {
              const saldoWei = BigInt(responseItem.result);
              const checksumAddr = CryptoEngine.toChecksumAddress(addr);
              result[checksumAddr] = {
                balance: saldoWei,
                address: checksumAddr
              };
            } else if (responseItem.error) {
              itemErrors++;
              if (!firstError) firstError = responseItem.error.message || 'erro RPC';
            }
          });
          logBatchItemErrors((msg) => this.log(msg), this.provider, itemErrors, addresses.length, firstError);
          if (itemErrors === addresses.length) this._rotateRpc();
        } else if (resp.status === 200 && resp.data && !Array.isArray(resp.data)) {
          this.log(`⚠️ Resposta do RPC não é um array: ${JSON.stringify(resp.data)}`);
          if (resp.data.result) {
            const addr = addresses[0];
            const saldoWei = BigInt(resp.data.result);
            const checksumAddr = CryptoEngine.toChecksumAddress(addr);
            result[checksumAddr] = {
              balance: saldoWei,
              address: checksumAddr
            };
          }
        } else {
          this.log(`⚠️ [${this.provider}] Resposta inesperada (HTTP ${resp.status})`);
          this._rotateRpc();
          await sleep(RUNTIME_CONFIG.RPC_RETRY_MS);
          return await this.queryRPC(addresses);
        }
      } catch (err) {
        this.log(`⚠️ [${this.provider}] Erro no lote: ${err.message}. Alternando RPC...`);
        this._rotateRpc();
        await sleep(RUNTIME_CONFIG.RPC_RETRY_MS);
        return await this.queryRPC(addresses);
      }

      return result;
    } catch (err) {
      this.log(`⚠️ Erro ao consultar BNB RPC: ${err.message}`);
      return {};
    }
  }

  /**
   * Processa lote
   */
  async processBatch() {
    if (this.batch.length === 0) return;

    const addresses = this.batch.map(b => b.addr);
    this.log(`📡 Consultando ${this.batch.length} endereços...`);

    const results = await this.queryRPC(addresses);
    const getInfo = (item) => getEvmResult(results, item, (a) => CryptoEngine.toChecksumAddress(a));

    if (await handleBatchRpcFailure(this, this.batch, results, {
      hasResult: (item) => Boolean(getInfo(item)),
      retryMs: RUNTIME_CONFIG.RPC_RETRY_MS || 15000,
    })) {
      this.batch = [];
      return;
    }

    const historyFile = path.join(this.resultsDir, 'batch_history.jsonl');
    for (const item of this.batch) {
      const info = getInfo(item);
      const privHexPadded = item.privHex.padStart(64, '0');
      const record = {
        timestamp:       new Date().toISOString(),
        puzzle:          this.puzzleId,
        provider:        this.provider,
        privHex:         privHexPadded,
        privkey_length:  64,
        addr:            item.addr,
        address:         item.addr,
        status:          info.balance > 0n ? 'SALDO_ENCONTRADO' : 'sem_saldo',
        balance:         info.balance.toString(),
        finalBalance:    Number(info.balance),
        finalBalanceBnb: (Number(info.balance) / 1e18).toFixed(18),
        nTx:             0,
      };
      fs.appendFileSync(historyFile, JSON.stringify(record) + '\n');

      if (info.balance > 0n) {
        const balanceEth = (Number(info.balance) / 1e18).toFixed(8);
        this.log(`💰 SALDO ENCONTRADO: ${item.addr} (${balanceEth} BNB)`);
        this._saveFound(item, info.balance);
        this._saveState();
        process.exit(0);
      }
    }

    this.batch = [];
    await new Promise(r => setTimeout(r, RUNTIME_CONFIG.DELAY_MS));
  }

  _saveFound(item, balance) {
    const balanceEth = (Number(balance) / 1e18).toFixed(8);
    const privHexPadded = item.privHex.padStart(64, '0');
    const content = `BNB PUZZLE #${this.puzzleId} ENCONTRADO!\n` +
      `Endereço: ${item.addr}\n` +
      `Saldo: ${balanceEth} BNB (${balance.toString()} Wei)\n` +
      `Privkey (Hex - 64 chars): ${privHexPadded}\n`;
    
    fs.writeFileSync(path.join(this.resultsDir, `FOUND_${item.addr}.txt`), content);
    
    const foundFile = path.join(this.resultsDir, '..', '..', 'relatorio_final', 'saldos_encontrados.jsonl');
    const foundDir = path.dirname(foundFile);
    if (!fs.existsSync(foundDir)) fs.mkdirSync(foundDir, { recursive: true });
    
    const record = {
      coin: 'bnb',
      puzzle: this.puzzleId,
      address: item.addr,
      balance: balance.toString(),
      formatted_balance: `${balanceEth} BNB (${balance.toString()} Wei)`,
      privHex: privHexPadded,
      privkey_length: 64,
      timestamp_verified: new Date().toISOString()
    };
    fs.appendFileSync(foundFile, JSON.stringify(record) + '\n');
    
    console.log(`\x1b[32m🚀 CHAVE ENCONTRADA\x1b[0m`);
  }

  /**
   * Loop de busca - SEQUENCIAL APENAS
   */
  async search() {
    const initialBigInt = BigInt(this.config.initialPrivkey);
    const currentBigInt = BigInt(this.state.lastPrivkey);
    
    this.log(`[🔐] Initial Range: ${this.rangeMin.toString()}`);
    this.log(`[🔐] Max Range: ${this.rangeMax.toString()}`);
    this.log(`[🔐] InitialPrivkey: ${this.config.initialPrivkey}`);
    this.log(`[🔐] LastPrivkey (cache): ${this.state.lastPrivkey}`);
    
    if (currentBigInt === initialBigInt) {
      this.log(`[✅] Iniciando do ZERO do Puzzle #${this.puzzleId} em modo SEQUENCIAL`);
    } else if (currentBigInt > initialBigInt && currentBigInt <= this.rangeMax) {
      this.log(`[✅] Retomando do checkpoint: privkey ${currentBigInt.toString()} (${((currentBigInt - this.rangeMin) * 100n / (this.rangeMax - this.rangeMin)).toString()}% do range)`);
    } else {
      this.log(`[⚠️] LastPrivkey fora do esperado, reiniciando do initial`);
      this.state.lastPrivkey = this.config.initialPrivkey;
      this._saveState();
    }
    
    this.log(`🔍 Iniciando ${this.config.name} (sequencial)`);
    let cycleCount = 0;

    while (true) {
      cycleCount++;

      while (this.batch.length < RUNTIME_CONFIG.BATCH_SIZE) {
        const lastPrivkeyBig = BigInt(this.state.lastPrivkey);
        let privkey = lastPrivkeyBig + 1n;
        if (privkey > this.rangeMax) {
          privkey = this.rangeMin;
          this.log(`🔄 Privkey atingiu max (${lastPrivkeyBig}), reiniciando do min`);
        }

        if (!CryptoEngine.validatePrivkeyRange(privkey, this.rangeMin, this.rangeMax)) continue;

        const addr = CryptoEngine.privkeyToAddress(privkey);
        if (!CryptoEngine.isValidAddress(addr)) continue;

        this.state.lastPrivkey = '0x' + privkey.toString(16);
        this.state.totalChecked++;

        if (addr.toLowerCase() === this.config.target.toLowerCase()) {
          const alert = '\x07'.repeat(10);
          const privkey_str = privkey.toString(16).padStart(64, '0');
          this.log(`${alert}\n${'='.repeat(80)}\n🏆🏆🏆 CHAVE ENCONTRADA! PUZZLE RESOLVIDO! 🏆🏆🏆\n${'='.repeat(80)}\nEndereço: ${addr}\nPrivkey (HEX - 64 chars): ${privkey_str}\n${'='.repeat(80)}\n`);
          this._saveFound({ addr, privHex: privkey_str }, 0n);
          this._saveState();
          process.exit(0);
        }

        this.batch.push({ addr, privHex: privkey.toString(16).padStart(64, '0') });
      }

      await this.processBatch();
      
      if (cycleCount % 10 === 0) {
        this.log(`✅ ${cycleCount} lotes | ${this.state.totalChecked.toLocaleString()} verificados`);
        this._saveState();
      }
    }
  }
}

// ─── Main ────────────────────────────────────────────────────────────────────
// Puzzles 71, 72, 73 sempre ativos — sem dependência de PUZZLE_ID
if (import.meta.url === `file://${process.argv[1]}`) {
  const PUZZLE_IDS = [71, 72, 73];

  const solvers = PUZZLE_IDS.map(id => new BnbSolver(id));

  process.on('SIGINT', () => {
    solvers.forEach(s => s._saveState());
    console.log('✅ Estado salvo para todos os puzzles (71, 72, 73)');
    process.exit(0);
  });

  // 3 loops independentes em paralelo
  Promise.all(solvers.map(s => s.search()));
}