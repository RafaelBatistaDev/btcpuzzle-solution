/**
 * Litecoin Balance Verifier - Verificação pontual de saldos
 */
import fs   from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { RUNTIME_CONFIG } from './config.js';
import { globalLimiter }  from './solver.js';
import { fetchLitecoinAddressBalance, LTC_DEFAULT_API_URL } from '../../litecoin_api.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export class LitecoinBalanceVerifier {
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
    const baseUrl = RUNTIME_CONFIG.BLOCKCHAIN_INFO_BASE_URL || LTC_DEFAULT_API_URL;
    const chainSoApiKey = process.env.LTC_CHAIN_SO_API_KEY || process.env.CHAIN_SO_API_KEY || null;

    this.log(`🔍 Verificando ${addresses.length} endereços via ${baseUrl}`);

    for (let i = 0; i < addresses.length; i++) {
      const addr = addresses[i].trim();
      if (!addr) continue;

      this.log(`📡 Consultando ${i + 1}/${addresses.length}: ${addr.substring(0, 10)}...`);

      try {
        const balance = await globalLimiter.schedule(() => fetchLitecoinAddressBalance(
          baseUrl,
          addr,
          RUNTIME_CONFIG.TIMEOUT_MS,
          chainSoApiKey,
          (fn) => globalLimiter.schedule(fn),
        ));

        if (balance === null) {
          this.log(`⚠️ Rate limit ou erro HTTP. Aumentando delay e aguardando 10s...`);
          globalLimiter.setDelay(2000);
          await new Promise(r => setTimeout(r, 10000));
          i--;
          continue;
        }

        const balanceLtc = Number(balance) / 1e8;
        results.push({
          address:   addr,
          balance:   Number(balance),
          timestamp: new Date().toISOString(),
        });

        if (balance > 0n) {
          const puzzleStr = puzzle ? ` [PUZZLE #${puzzle}]` : '';
          this.log(
            `\x07\x07\x07\n${'='.repeat(80)}\n` +
            `🚨 LITECOIN SALDO ENCONTRADO!${puzzleStr} 🚨\n` +
            `Endereço: ${addr}\n` +
            `Saldo: ${balance.toString()} litoshis (${balanceLtc.toFixed(8)} LTC)\n` +
            `${'='.repeat(80)}\n`
          );
          this._saveToFoundFile('litecoin', puzzle, addr, Number(balance), `${balanceLtc.toFixed(8)} LTC (${balance.toString()} litoshis)`);
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
      format:             'p2pkh',
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

export default LitecoinBalanceVerifier;
