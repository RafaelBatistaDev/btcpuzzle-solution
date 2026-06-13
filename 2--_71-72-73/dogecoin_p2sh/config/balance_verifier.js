/**
 * Dogecoin Balance Verifier - Verificação pontual de saldos P2SH
 */
import fs   from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { RUNTIME_CONFIG } from './config.js';
import { globalLimiter }  from './solver.js';
import { DOGE_P2SH_REGEX } from './utils.js';
import { fetchDogecoinAddressBalance, DOGE_DEFAULT_API_URL } from '../../dogecoin_api.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export class DogecoinBalanceVerifier {
  constructor(puzzleId = null) {
    this.puzzleId  = puzzleId;
    this.batchSize = 20;
    this.foundFile = path.join(__dirname, '..', '..', 'relatorio_final', 'saldos_encontrados.jsonl');
    this._ensureFoundDir();
  }

  _ensureFoundDir() {
    const dir = path.dirname(this.foundFile);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  }

  log(msg) {
    console.log(`[${new Date().toISOString()}] ${msg}`);
  }

  async verifyBalances(addresses, puzzleId = null) {
    if (!addresses || addresses.length === 0) return [];

    const puzzle  = puzzleId || this.puzzleId;
    const results = [];
    const baseUrl = RUNTIME_CONFIG.BLOCKCHAIN_INFO_BASE_URL || DOGE_DEFAULT_API_URL;

    this.log(`🔍 Verificando ${addresses.length} endereços via ${baseUrl}`);

    for (let i = 0; i < addresses.length; i++) {
      const addr = addresses[i].trim();
      if (!addr) continue;
      if (!DOGE_P2SH_REGEX.test(addr)) {
        this.log(`⚠️ Endereço inválido (P2SH deve começar com 9 ou A): ${addr.substring(0, 12)}...`);
        continue;
      }

      this.log(`📡 Consultando ${i + 1}/${addresses.length}: ${addr.substring(0, 10)}...`);

      try {
        const balance = await globalLimiter.schedule(() => fetchDogecoinAddressBalance(
          baseUrl,
          addr,
          RUNTIME_CONFIG.TIMEOUT_MS,
          (fn) => globalLimiter.schedule(fn),
        ));

        if (balance === null) {
          this.log(`⚠️ Rate limit ou erro HTTP. Aumentando delay e aguardando 15s...`);
          globalLimiter.setDelay(3000);
          await new Promise(r => setTimeout(r, 15000));
          i--;
          continue;
        }

        const balanceDoge = Number(balance) / 1e8;
        results.push({
          address:   addr,
          balance:   Number(balance),
          timestamp: new Date().toISOString(),
        });

        if (balance > 0n) {
          const puzzleStr = puzzle ? ` [PUZZLE #${puzzle}]` : '';
          this.log(
            `\x07\x07\x07\n${'='.repeat(80)}\n` +
            `🚨 DOGECOIN SALDO ENCONTRADO!${puzzleStr} 🚨\n` +
            `Endereço: ${addr}\n` +
            `Saldo: ${balance.toString()} koinu (${balanceDoge.toFixed(8)} DOGE)\n` +
            `${'='.repeat(80)}\n`
          );
          this._saveToFoundFile('dogecoin', puzzle, addr, Number(balance), `${balanceDoge.toFixed(8)} DOGE (${balance.toString()} koinu)`);
        }

      } catch (err) {
        this.log(`❌ Erro ao consultar ${addr}: ${err.message}`);
        results.push({
          address:   addr,
          balance:   0,
          timestamp: new Date().toISOString(),
        });
      }
    }

    const found = results.filter(r => r.balance > 0);
    if (found.length > 0) {
      this.log(`💰 Total encontrado: ${found.length} endereço(s) com saldo!`);
    }

    return results;
  }

  _saveToFoundFile(coin, puzzle, address, balance, formatted) {
    const record = {
      coin,
      format:             'p2sh',
      puzzle,
      address,
      balance,
      formatted_balance:  formatted,
      timestamp_verified: new Date().toISOString(),
    };

    try {
      fs.appendFileSync(this.foundFile, JSON.stringify(record) + '\n');
    } catch (err) {
      this.log(`⚠️  Erro ao salvar achado: ${err.message}`);
    }
  }
}

export default DogecoinBalanceVerifier;
