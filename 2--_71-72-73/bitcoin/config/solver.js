/**
 * Bitcoin Puzzle Solver - Sequencial com checkpoint
 */
import fs   from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import axios from 'axios';
import { CryptoEngine }                          from './utils.js';
import { PUZZLE_CONFIG, RUNTIME_CONFIG, ACTIVE_PUZZLES } from './config.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// ─── Rate Limiter Global ──────────────────────────────────────────────────────
// Serializa todas as requisições entre os 3 solvers rodando em Promise.all.
// Exportado para que balance_verifier.js possa reutilizar a mesma instância.
export class GlobalRateLimiter {
  constructor(delayMs = 1200) {
    this._delayMs = delayMs;
    this._queue   = Promise.resolve();
  }

  // Enfileira fn — executa só após a anterior terminar + delay
  schedule(fn) {
    const result = this._queue.then(() => fn());
    this._queue  = result
      .catch(() => {})
      .then(() => sleep(this._delayMs));
    return result;
  }

  setDelay(ms) { this._delayMs = ms; }
}

// Instância única compartilhada por todos os BitcoinSolver e balance_verifier
export const globalLimiter = new GlobalRateLimiter(1200);

// ─── BitcoinSolver ────────────────────────────────────────────────────────────
export class BitcoinSolver {
  constructor(puzzleId) {
    this.puzzleId = puzzleId;
    this.config   = PUZZLE_CONFIG[puzzleId];

    if (!this.config) throw new Error(`❌ Puzzle #${puzzleId} não encontrado em PUZZLE_CONFIG`);

    this.rangeMin = BigInt(this.config.rangeMin);
    this.rangeMax = BigInt(this.config.rangeMax);

    if (this.rangeMin <= 0n)              throw new Error(`❌ PUZZLE_${puzzleId}: rangeMin deve ser > 0`);
    if (this.rangeMax <= 0n)              throw new Error(`❌ PUZZLE_${puzzleId}: rangeMax deve ser > 0`);
    if (this.rangeMin > this.rangeMax)    throw new Error(`❌ PUZZLE_${puzzleId}: rangeMin > rangeMax`);

    const initialBigInt = BigInt(this.config.initialPrivkey);
    if (initialBigInt < this.rangeMin || initialBigInt > this.rangeMax) {
      throw new Error(`❌ PUZZLE_${puzzleId}: initialPrivkey fora do range`);
    }

    this.stateFile  = path.join(__dirname, '..', 'cache',         `puzzle_${puzzleId}.json`);
    this.logFile    = path.join(__dirname, '..', 'logs',          `puzzle_${puzzleId}.log`);
    this.resultsDir = path.join(__dirname, '..', `PUZZLE_${puzzleId}`);

    this._ensureDirs();
    this.state = this._loadState();
    this.batch = [];
  }

  _ensureDirs() {
    [
      path.dirname(this.stateFile),
      path.dirname(this.logFile),
      this.resultsDir,
    ].forEach(dir => {
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    });
  }

  _loadState() {
    let state = {
      lastPrivkey:   this.config.initialPrivkey,
      totalChecked:  0,
      dailyRequests: { date: new Date().toISOString().split('T')[0], count: 0 },
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
      state.dailyRequests = { date: new Date().toISOString().split('T')[0], count: 0 };
    }

    // Valida formato do lastPrivkey salvo
    let hasValidFormat = false;
    if (typeof state.lastPrivkey === 'string') {
      const hex = state.lastPrivkey.startsWith('0x')
        ? state.lastPrivkey.slice(2)
        : state.lastPrivkey;
      hasValidFormat = /^[0-9a-fA-F]+$/.test(hex) || /^[0-9]+$/.test(state.lastPrivkey);
    }

    if (!hasValidFormat) {
      state.lastPrivkey = this.config.initialPrivkey;
    } else {
      try {
        const loaded = BigInt(state.lastPrivkey);
        if (loaded < this.rangeMin || loaded > this.rangeMax) {
          this.log(`⚠️  lastPrivkey fora do range. Reiniciando do initialPrivkey.`);
          state.lastPrivkey = this.config.initialPrivkey;
        }
      } catch (e) {
        this.log(`⚠️  lastPrivkey inválido. Reiniciando do initialPrivkey.`);
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

  async _waitForNewDay(today) {
    while (true) {
      const now        = new Date();
      const midnight   = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
      const msLeft     = midnight.getTime() - now.getTime();
      const minutesLeft = Math.ceil(msLeft / 60000);

      this.log(`💤 Limite diário atingido. Dormindo 5 min... (~${minutesLeft} min para UTC midnight)`);
      await sleep(Math.min(5 * 60000, msLeft + 5000));

      const currentDay = new Date().toISOString().split('T')[0];
      if (currentDay !== today) {
        this.state.dailyRequests.date  = currentDay;
        this.state.dailyRequests.count = 0;
        this._saveState();
        this.log(`🌅 Novo dia (${currentDay}). Retomando!`);
        return;
      }
    }
  }

  async checkRateLimit() {
    const today = new Date().toISOString().split('T')[0];

    if (this.state.dailyRequests.date !== today) {
      this.state.dailyRequests.date  = today;
      this.state.dailyRequests.count = 0;
      this._saveState();
    }

    const limit = RUNTIME_CONFIG.MAX_REQ_24H;
    if (this.state.dailyRequests.count >= limit) {
      this.log(`⚠️ Limite diário atingido (${this.state.dailyRequests.count}/${limit}).`);
      await this._waitForNewDay(today);
    }
  }

  // ─── queryRPC ─────────────────────────────────────────────────────────────
  async queryRPC(addresses) {
    await this.checkRateLimit();

    const result   = {};
    const baseUrl  = RUNTIME_CONFIG.BLOCKCHAIN_INFO_BASE_URL || 'https://blockchain.info';
    const isAlchemy = baseUrl.includes('alchemy.com');
    const isMempool = baseUrl.includes('mempool.space');

    try {

      // ── Alchemy ────────────────────────────────────────────────────────────
      if (isAlchemy) {
        this.log(`📡 [Alchemy] Consultando ${addresses.length} endereços...`);

        for (let i = 0; i < addresses.length; i++) {
          const addr = addresses[i];
          this.state.dailyRequests.count++;
          this._saveState();

          try {
            const url  = `${baseUrl}/v1/addresses/${addr}/balance`;
            const resp = await globalLimiter.schedule(() => axios.get(url, {
              headers:        { 'Accept': 'application/json', 'User-Agent': 'ClawRafaelIA-Test/1.0' },
              timeout:        RUNTIME_CONFIG.TIMEOUT_MS,
              validateStatus: () => true,
            }));

            if (resp.status === 429) {
              this.log(`⚠️ [429 Alchemy] Rate limit. Aumentando delay e aguardando 15s...`);
              globalLimiter.setDelay(3000);
              await sleep(15000);
              i--;
              continue;
            }

            if (resp.status === 200 && resp.data !== undefined) {
              result[addr] = {
                balance:       BigInt(resp.data.balance ?? resp.data ?? 0),
                address:       addr,
                nTx:           0,
                totalReceived: 0,
                totalSent:     0,
                provider:      'alchemy',
              };
            } else {
              this.log(`⚠️ [Alchemy] HTTP ${resp.status} para ${addr.substring(0, 10)}... Retentando em 5s...`);
              await sleep(5000);
              i--;
              continue;
            }
          } catch (err) {
            this.log(`⚠️ [Alchemy] Erro: ${err.message}. Retentando em 5s...`);
            await sleep(5000);
            i--;
            continue;
          }
        }

      // ── Mempool.space ──────────────────────────────────────────────────────
      } else if (isMempool) {
        this.log(`📡 [Mempool.space] Consultando ${addresses.length} endereços...`);

        for (let i = 0; i < addresses.length; i++) {
          const addr = addresses[i];
          this.log(`📡 [Mempool] ${i + 1}/${addresses.length}: ${addr.substring(0, 10)}...`);
          this.state.dailyRequests.count++;
          this._saveState();

          try {
            const url  = `${baseUrl}/api/address/${addr}`;
            const resp = await globalLimiter.schedule(() => axios.get(url, {
              headers:        { 'User-Agent': 'ClawRafaelIA-Test/1.0', 'Connection': 'keep-alive' },
              timeout:        RUNTIME_CONFIG.TIMEOUT_MS,
              validateStatus: () => true,
            }));

            if (resp.status === 429) {
              this.log(`⚠️ [429 Mempool] Rate limit. Aumentando delay e aguardando 15s...`);
              globalLimiter.setDelay(3000);
              await sleep(15000);
              i--;
              continue;
            }

            if (resp.status === 200) {
              const d      = resp.data;
              const onchain = d.chain_stats.funded_txo_sum  - d.chain_stats.spent_txo_sum;
              const mempool = d.mempool_stats.funded_txo_sum - d.mempool_stats.spent_txo_sum;
              result[addr] = {
                balance:       BigInt(onchain + mempool),
                address:       addr,
                nTx:           d.chain_stats.tx_count + d.mempool_stats.tx_count,
                totalReceived: d.chain_stats.funded_txo_sum,
                totalSent:     d.chain_stats.spent_txo_sum,
                provider:      'mempool',
              };
            } else if (resp.status === 404) {
              result[addr] = {
                balance:       0n,
                address:       addr,
                nTx:           0,
                totalReceived: 0,
                totalSent:     0,
                provider:      'mempool',
              };
            } else {
              this.log(`⚠️ [Mempool] HTTP ${resp.status} para ${addr.substring(0, 10)}... Retentando em 5s...`);
              await sleep(5000);
              i--;
              continue;
            }
          } catch (err) {
            this.log(`⚠️ [Mempool] Erro: ${err.message}. Retentando em 5s...`);
            await sleep(5000);
            i--;
            continue;
          }
        }

      // ── Blockchain.info (default) ──────────────────────────────────────────
      } else {
        this.log(`📡 [Blockchain.info] Consultando ${addresses.length} endereços...`);

        for (let i = 0; i < addresses.length; i++) {
          const addr = addresses[i];
          this.log(`📡 [Blockchain] ${i + 1}/${addresses.length}: ${addr.substring(0, 10)}...`);
          this.state.dailyRequests.count++;
          this._saveState();

          try {
            const resp = await globalLimiter.schedule(() => axios.get(`${baseUrl}/balance`, {
              params:         { active: addr },
              headers:        { 'User-Agent': 'ClawRafaelIA-Test/1.0', 'Connection': 'keep-alive' },
              timeout:        RUNTIME_CONFIG.TIMEOUT_MS,
              validateStatus: () => true,
            }));

            if (resp.status === 429) {
              this.log(`⚠️ [429 Blockchain] Rate limit. Aumentando delay e aguardando 15s...`);
              globalLimiter.setDelay(3000);
              await sleep(15000);
              i--;
              continue;
            }

            if (resp.status === 200) {
              const data = resp.data;
              if (data && data[addr]) {
                const entry  = data[addr];
                result[addr] = {
                  balance:       BigInt(entry.final_balance   || 0),
                  address:       addr,
                  nTx:           entry.n_tx                   || 0,
                  totalReceived: entry.total_received         || 0,
                  totalSent:     entry.total_sent             || 0,
                  provider:      'blockchain.info',
                };
              } else {
                this.log(`⚠️ [Blockchain] Resposta vazia para ${addr.substring(0, 10)}...`);
                result[addr] = {
                  balance: 0n, address: addr, nTx: 0,
                  totalReceived: 0, totalSent: 0, provider: 'blockchain.info',
                };
              }
            } else {
              this.log(`⚠️ [Blockchain] HTTP ${resp.status} para ${addr.substring(0, 10)}... Retentando em 5s...`);
              await sleep(5000);
              i--;
              continue;
            }
          } catch (err) {
            this.log(`⚠️ [Blockchain] Erro: ${err.message}. Retentando em 5s...`);
            await sleep(5000);
            i--;
            continue;
          }
        }
      }

      return result;

    } catch (err) {
      this.log(`⚠️ Erro crítico em queryRPC: ${err.message}`);
      await sleep(5000);
      return {};
    }
  }

  // ─── processBatch ─────────────────────────────────────────────────────────
  async processBatch() {
    if (this.batch.length === 0) return;

    const addresses   = this.batch.map(b => b.addr);
    const results     = await this.queryRPC(addresses);
    const historyFile = path.join(this.resultsDir, 'batch_history.jsonl');

    for (const item of this.batch) {
      const info       = results[item.addr] || { balance: 0n, nTx: 0, totalReceived: 0, totalSent: 0, provider: 'unknown' };
      const balanceNum = Number(info.balance);

      const record = {
        timestamp:       new Date().toISOString(),
        puzzle:          this.puzzleId,
        provider:        info.provider      || 'unknown',
        privHex:         item.privHex,
        wif:             item.wif,
        address:         item.addr,
        status:          balanceNum > 0 ? 'SALDO_ENCONTRADO' : 'sem_saldo',
        finalBalance:    balanceNum,
        finalBalanceBtc: (balanceNum / 1e8).toFixed(8),
        totalReceived:   info.totalReceived || 0,
        totalReceivedBtc:((info.totalReceived || 0) / 1e8).toFixed(8),
        totalSent:       info.totalSent     || 0,
        totalSentBtc:    ((info.totalSent   || 0) / 1e8).toFixed(8),
        nTx:             info.nTx           || 0,
        formats: {
          BIP44C: {
            address: item.addr,
            balance: balanceNum,
            btc:     (balanceNum / 1e8).toFixed(8),
            txCount: info.nTx || 0,
          },
        },
      };

      fs.appendFileSync(historyFile, JSON.stringify(record) + '\n');

      if (info.balance > 0n) {
        const balanceBtc = (balanceNum / 1e8).toFixed(8);
        this.log(`💰 SALDO ENCONTRADO: ${item.addr} (${balanceBtc} BTC)`);
        this._saveFound(item, info.balance, info.nTx || 0);
        this._saveState();
        process.exit(0);
      } else if ((info.nTx || 0) > 0) {
        this.log(`📜 TX HISTÓRICO: ${item.addr} (${info.nTx} tx, saldo zerado)`);
        this._saveFound(item, 0n, info.nTx || 0);
      }
    }

    this.batch = [];
  }

  _saveFound(item, balance, nTx = 0) {
    const balanceBtc    = (Number(balance) / 1e8).toFixed(8);
    const privHexPadded = item.privHex.padStart(64, '0');
    const hasSaldo      = balance > 0n;
    const status        = hasSaldo ? 'SALDO_ENCONTRADO' : 'TX_HISTORICO';

    const content =
      `BITCOIN PUZZLE #${this.puzzleId} — ${status}\n` +
      `Endereço: ${item.addr}\n` +
      `Saldo: ${balanceBtc} BTC (${balance.toString()} Sat)\n` +
      `Transações: ${nTx}\n` +
      `Privkey (Hex - 64 chars): ${privHexPadded}\n` +
      `WIF: ${item.wif}\n`;

    fs.writeFileSync(path.join(this.resultsDir, `FOUND_${item.addr}.txt`), content);

    const foundFile = path.join(this.resultsDir, '..', '..', 'relatorio_final', 'saldos_encontrados.jsonl');
    const foundDir  = path.dirname(foundFile);
    if (!fs.existsSync(foundDir)) fs.mkdirSync(foundDir, { recursive: true });

    const record = {
      coin:               'bitcoin',
      puzzle:             this.puzzleId,
      status,
      address:            item.addr,
      balance:            Number(balance),
      formatted_balance:  `${balanceBtc} BTC (${balance.toString()} Sat)`,
      nTx,
      privHex:            privHexPadded,
      wif:                item.wif,
      timestamp_verified: new Date().toISOString(),
    };
    fs.appendFileSync(foundFile, JSON.stringify(record) + '\n');

    if (hasSaldo) {
      console.log(`\x1b[32m🚀 CHAVE ENCONTRADA\x1b[0m`);
    } else {
      console.log(`\x1b[33m📜 TX HISTÓRICO SALVO\x1b[0m`);
    }
  }

  // ─── search ───────────────────────────────────────────────────────────────
  // CORREÇÃO PRINCIPAL: loop encerra quando privkey > rangeMax em vez de reiniciar
  async search() {
    const currentBigInt = BigInt(this.state.lastPrivkey);
    const initialBigInt = BigInt(this.config.initialPrivkey);

    this.log(`[🔐] Range Min:      ${this.rangeMin.toString()}`);
    this.log(`[🔐] Range Max:      ${this.rangeMax.toString()}`);
    this.log(`[🔐] InitialPrivkey: ${this.config.initialPrivkey}`);
    this.log(`[🔐] LastPrivkey:    ${this.state.lastPrivkey}`);

    if (currentBigInt === initialBigInt) {
      this.log(`[✅] Iniciando do ZERO do Puzzle #${this.puzzleId}`);
    } else {
      const pct = ((currentBigInt - this.rangeMin) * 10000n / (this.rangeMax - this.rangeMin));
      this.log(`[✅] Retomando checkpoint: ${currentBigInt.toString()} (${(Number(pct) / 100).toFixed(2)}%)`);
    }

    this.log(`🔍 Iniciando busca sequencial — Puzzle #${this.puzzleId}`);
    let cycleCount = 0;

    // ── Loop principal ──────────────────────────────────────────────────────
    outer: while (true) {
      cycleCount++;

      // Enche o batch
      while (this.batch.length < RUNTIME_CONFIG.BATCH_SIZE) {
        const lastPrivkeyBig = BigInt(this.state.lastPrivkey);
        const privkey        = lastPrivkeyBig + 1n;

        // ✅ CORREÇÃO: para quando esgota o range — não reinicia
        if (privkey > this.rangeMax) {
          this.log(`🏁 Range completo em ${this.state.totalChecked.toLocaleString()} chaves verificadas.`);
          if (this.batch.length > 0) await this.processBatch();
          this._saveState();
          break outer;
        }

        // Avança lastPrivkey mesmo se inválido, para não travar
        this.state.lastPrivkey = '0x' + privkey.toString(16);

        if (!CryptoEngine.validatePrivkeyRange(privkey, this.rangeMin, this.rangeMax)) continue;

        const addr = CryptoEngine.privkeyToAddress(privkey);
        const wif  = CryptoEngine.privkeyToWif(privkey);

        if (!CryptoEngine.isValidAddress(addr)) continue;

        this.state.totalChecked++;

        // Alvo encontrado direto (sem precisar da API)
        if (addr.toLowerCase() === this.config.target.toLowerCase()) {
          const privkey_str = privkey.toString(16).padStart(64, '0');
          this.log(
            `\x07\x07\x07\n${'='.repeat(80)}\n` +
            `🏆 CHAVE ENCONTRADA! PUZZLE #${this.puzzleId} RESOLVIDO! 🏆\n` +
            `${'='.repeat(80)}\n` +
            `Endereço: ${addr}\nPrivkey (HEX): ${privkey_str}\nWIF: ${wif}\n` +
            `${'='.repeat(80)}\n`
          );
          this._saveFound({ addr, privHex: privkey_str, wif }, 0n);
          this._saveState();
          process.exit(0);
        }

        this.batch.push({
          addr,
          privHex: privkey.toString(16).padStart(64, '0'),
          wif,
        });
      }

      await this.processBatch();

      if (cycleCount % 10 === 0) {
        const last = BigInt(this.state.lastPrivkey);
        const pct  = ((last - this.rangeMin) * 10000n / (this.rangeMax - this.rangeMin));
        this.log(
          `📊 ${cycleCount} lotes | ` +
          `${this.state.totalChecked.toLocaleString()} verificados | ` +
          `${(Number(pct) / 100).toFixed(2)}% do range`
        );
        this._saveState();
      }
    }

    this.log(`✅ Puzzle #${this.puzzleId} finalizado.`);
  }
}

// ─── Main ────────────────────────────────────────────────────────────────────
if (import.meta.url === `file://${process.argv[1]}`) {
  // Usa ACTIVE_PUZZLES de config.js — sem hardcode
  const solvers = ACTIVE_PUZZLES.map(id => new BitcoinSolver(id));

  process.on('SIGINT', () => {
    solvers.forEach(s => s._saveState());
    console.log('\n✅ Estado salvo para todos os puzzles. Encerrando.');
    process.exit(0);
  });

  Promise.all(
    solvers.map(s =>
      s.search()
        .then(()    => console.log(`✅ Puzzle #${s.puzzleId} concluído.`))
        .catch(err  => console.error(`❌ Puzzle #${s.puzzleId} erro: ${err.message}`))
    )
  ).then(() => {
    console.log('🏁 Todos os puzzles processados.');
    process.exit(0);
  });
}
