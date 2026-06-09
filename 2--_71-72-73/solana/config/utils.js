/**
 * Utilitários Criptográficos Solana - Simplificado
 * Usa ed25519 para chaves (diferente de Ethereum que usa secp256k1)
 */

import crypto from 'crypto';
import bs58 from 'bs58';
import nacl from 'tweetnacl';
import { sha256 } from 'js-sha256';

export class CryptoEngine {
  /**
   * Converte privkey para endereço Solana (base58 encoded)
   * Solana usa ed25519, não secp256k1 como Ethereum
   */
  static privkeyToAddress(privkeyInt) {
    // Converte BigInt para buffer (32 bytes)
    const privkeyHex = BigInt(privkeyInt).toString(16).padStart(64, '0');
    const privkeyBuffer = Buffer.from(privkeyHex, 'hex');

    // Gera keypair usando ed25519
    const keypair = nacl.sign.keyPair.fromSeed(privkeyBuffer);
    
    // Converte public key para base58 (formato padrão de addresses Solana)
    const address = bs58.encode(keypair.publicKey);
    
    return address;
  }

  /**
   * Valida se endereço está no formato base58 válido para Solana
   * Endereços Solana tem entre 32-44 caracteres em base58
   */
  static isValidAddress(addr) {
    try {
      // Tenta decodificar de base58
      const decoded = bs58.decode(addr);
      // Endereços Solana devem ter 32 bytes
      return decoded.length === 32;
    } catch {
      return false;
    }
  }

  /**
   * Gera privkey aleatória no range
   */
  static generateRandomPrivkey(min, max) {
    if (min <= BigInt(0) || max <= BigInt(0)) throw new Error('Range inválido');
    if (min > max) throw new Error('Range inválido');
    
    const range = max - min + BigInt(1);
    const randomBytes = BigInt('0x' + crypto.randomBytes(32).toString('hex'));
    const privkey = min + (randomBytes % range);
    
    if (privkey < min || privkey > max) throw new Error('Privkey fora do range');
    return privkey;
  }

  /**
   * Valida se privkey está no range
   */
  static validatePrivkeyRange(privkey, min, max) {
    return privkey >= min && privkey <= max && privkey > BigInt(0);
  }

  /**
   * ═══════════════════════════════════════════════════════════════════════
   * 🔐 GERAÇÃO DE CHAVES EQUIVALENTES PARA SOLANA
   * ═══════════════════════════════════════════════════════════════════════
   * 
   * Gera novos pares de chaves válidos para Solana (Ed25519 + Base58).
   * 
   * Dois modos:
   * 1. Sequencial (para puzzles): Gera chaves sequenciais a partir de um range_min
   * 2. Aleatório (seguro): Gera chaves criptograficamente seguras e aleatórias
   * 
   * @param {number} quantidade - Quantas chaves gerar (padrão: 1)
   * @param {string} rangeMinHex - (Opcional) String hex para início sequencial (ex: '0x4000...')
   *                               Se não fornecido, gera aleatórias
   * @returns {Array} Array de objetos {privHex, endereco, seed}
   */
  static gerarNovasChavesEquivalentes(quantidade = 1, rangeMinHex = null) {
    const resultados = [];
    
    // Define o ponto de partida sequencial ou aleatório
    let baseInicial = null;
    
    if (rangeMinHex) {
      // Modo sequencial: converte hex para BigInt
      baseInicial = BigInt(rangeMinHex);
    }

    for (let i = 0; i < quantidade; i++) {
      let seedBytes;
      let privHex;
      let privkeyInt;

      if (baseInicial) {
        // 🔗 SEQUENCIAL (Puzzle Mode)
        privkeyInt = baseInicial + BigInt(i);
        privHex = '0x' + privkeyInt.toString(16).padStart(64, '0');
        
        // Converte para buffer (32 bytes)
        const privkeyHex = privkeyInt.toString(16).padStart(64, '0');
        seedBytes = Buffer.from(privkeyHex, 'hex');
      } else {
        // 🎲 ALEATÓRIO (Modo Seguro)
        seedBytes = crypto.randomBytes(32);
        privHex = '0x' + seedBytes.toString('hex');
        privkeyInt = BigInt(privHex);
      }

      try {
        // Derivação oficial Ed25519 para Solana
        const keypair = nacl.sign.keyPair.fromSeed(seedBytes);
        const endereco = bs58.encode(keypair.publicKey);

        const parCarteira = {
          privHex,                    // Private key em formato hex (256 bits)
          endereco,                   // Endereço Solana em base58
          seed: seedBytes.toString('hex'),  // Seed para debugging/backup
          timestamp: new Date().toISOString(),
          modo: baseInicial ? 'sequencial' : 'aleatorio'
        };

        resultados.push(parCarteira);
      } catch (err) {
        console.error(`❌ Erro ao derivar chave ${i}: ${err.message}`);
      }
    }

    return resultados;
  }

  /**
   * ═══════════════════════════════════════════════════════════════════════
   * 📊 VALIDAÇÃO E LOGGING DE CHAVES GERADAS
   * ═══════════════════════════════════════════════════════════════════════
   * 
   * Valida chaves geradas e prepara para salvar em arquivos de log seguros
   * 
   * @param {Array} chaves - Array retornado de gerarNovasChavesEquivalentes()
   * @returns {Object} {validas, invalidas, resumo}
   */
  static validarChavesGeradas(chaves) {
    const resultado = {
      validas: [],
      invalidas: [],
      resumo: {
        totalGeradas: chaves.length,
        totalValidas: 0,
        totalInvalidas: 0
      }
    };

    for (const chave of chaves) {
      const isValid = this.isValidAddress(chave.endereco);
      
      if (isValid) {
        resultado.validas.push(chave);
        resultado.resumo.totalValidas++;
      } else {
        resultado.invalidas.push({
          ...chave,
          erro: 'Endereço derivado é inválido'
        });
        resultado.resumo.totalInvalidas++;
      }
    }

    return resultado;
  }
}
