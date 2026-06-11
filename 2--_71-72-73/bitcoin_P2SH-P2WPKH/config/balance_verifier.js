/**
 * Bitcoin Balance Verifier - Verificação pontual de saldos
 * Reutiliza globalLimiter e RUNTIME_CONFIG do solver para evitar conflito de rate limit
 */
import fs   from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import axios from 'axios';
import { RUNTIME_CONFIG }           from './config.js';
import { globalLimiter }            from './solver.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function detectBitcoinProvider(baseUrl) {
  const url = baseUrl.toLowerCase();
  if (url.includes('alchemy.com')) return 'alchemy';
  if (url.includes('mempool.space')) return 'mempool';
  return 'blockchain.info';
}

async function fetchAddressBalance(baseUrl, addr) {
  const provider = detectBitcoinProvider(baseUrl);

  if (provider === 'mempool') {
    const mempoolRoot = baseUrl.replace(/\/$/, '').replace(/\/api$/i, '');
    const resp = await axios.get(`${mempoolRoot}/api/address/${addr}`, {
      headers: { 'User-Agent': 'ClawRafaelIA-Test/1.0' },
      timeout: RUNTIME_CONFIG.TIMEOUT_MS,
      validateStatus: () => true,
    });
    if (resp.status === 200) {
      const d = resp.data;
      const onchain = d.chain_stats.funded_txo_sum - d.chain_stats.spent_txo_sum;
      const mempool = d.mempool_stats.funded_txo_sum - d.mempool_stats.spent_txo_sum;
      return BigInt(onchain + mempool);
    }
    if (resp.status === 404) return 0n;
    return null;
  }

  if (provider === 'alchemy') {
    const resp = await axios.get(`${baseUrl}/v1/addresses/${addr}/balance`, {
      headers: { 'Accept': 'application/json', 'User-Agent': 'ClawRafaelIA-Test/1.0' },
      timeout: RUNTIME_CONFIG.TIMEOUT_MS,
      validateStatus: () => true,
    });
    if (resp.status === 200 && resp.data !== undefined) {
      return BigInt(resp.data.balance ?? resp.data ?? 0);
    }
    return null;
  }

  const resp = await axios.get(`${baseUrl}/balance`, {
    params: { active: addr },
    headers: { 'User-Agent': 'ClawRafaelIA-Test/1.0', 'Connection': 'keep-alive' },
    timeout: RUNTIME_CONFIG.TIMEOUT_MS,
    validateStatus: () => true,
  });
  if (resp.status === 200 && resp.data && resp.data[addr]) {
    return BigInt(resp.data[addr].final_balance || 0);
  }
  return 0n;
}

export class BitcoinBalanceVerifier {
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

  /**
   * Verifica saldos de múltiplos endereços Bitcoin.
   * Utiliza o mesmo globalLimiter do solver para não conflitar com as buscas em andamento.
   */
  async verifyBalances(addresses, puzzleId = null) {
    if (!addresses || addresses.length === 0) return [];

    const puzzle  = puzzleId || this.puzzleId;
    const results = [];
    const baseUrl = RUNTIME_CONFIG.BLOCKCHAIN_INFO_BASE_URL || 'https://blockchain.info';
    const provider = detectBitcoinProvider(baseUrl);

    this.log(`🔍 Verificando ${addresses.length} endereços via ${provider} (${baseUrl})`);

    for (let i = 0; i < addresses.length; i++) {
      const addr = addresses[i].trim();
      if (!addr) continue;

      this.log(`📡 Consultando ${i + 1}/${addresses.length}: ${addr.substring(0, 10)}...`);

      try {
        const balance = await globalLimiter.schedule(() => fetchAddressBalance(baseUrl, addr));

        if (balance === null) {
          this.log(`⚠️ Rate limit ou erro HTTP. Aumentando delay e aguardando 15s...`);
          globalLimiter.setDelay(3000);
          await new Promise(r => setTimeout(r, 15000));
          i--;
          continue;
        }

        const balanceBtc = Number(balance) / 1e8;
        results.push({
          address:   addr,
          balance:   Number(balance),
          timestamp: new Date().toISOString(),
        });

        if (balance > 0n) {
          const puzzleStr = puzzle ? ` [PUZZLE #${puzzle}]` : '';
          this.log(
            `\x07\x07\x07\n${'='.repeat(80)}\n` +
            `🚨 BITCOIN SALDO ENCONTRADO!${puzzleStr} 🚨\n` +
            `Endereço: ${addr}\n` +
            `Saldo: ${balance.toString()} sat (${balanceBtc.toFixed(8)} BTC)\n` +
            `${'='.repeat(80)}\n`
          );
          this._saveToFoundFile('bitcoin', puzzle, addr, Number(balance), `${balanceBtc.toFixed(8)} BTC (${balance.toString()} sat)`);
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

export default BitcoinBalanceVerifier;
