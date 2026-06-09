/**
 * Utilitários Criptográficos BNB - Simplificado
 */

import crypto from 'crypto';
import EC from 'elliptic';
import { keccak256 } from 'web3-utils';

const ec = new EC.ec('secp256k1');

export class CryptoEngine {
  /**
   * Converte privkey para endereço Ethereum (EIP-55 Checksum)
   */
  static privkeyToAddress(privkeyInt) {
    const privkeyHex = BigInt(privkeyInt).toString(16).padStart(64, '0');
    const key = ec.keyFromPrivate(privkeyHex);
    const pubkey = key.getPublic();
    
    const x = pubkey.getX().toString(16).padStart(64, '0');
    const y = pubkey.getY().toString(16).padStart(64, '0');
    const pubkeyBuffer = Buffer.from(x + y, 'hex');

    const hash = Buffer.from(keccak256(pubkeyBuffer).slice(2), 'hex');
    const address = '0x' + hash.slice(-20).toString('hex');
    
    return this.toChecksumAddress(address);
  }

  /**
   * Checksum Address EIP-55
   */
  static toChecksumAddress(address) {
    const addr = address.toLowerCase().replace('0x', '');
    const hash = keccak256(Buffer.from(addr, 'utf-8')).slice(2);
    
    let ret = '0x';
    for (let i = 0; i < addr.length; i++) {
      ret += parseInt(hash[i], 16) >= 8 ? addr[i].toUpperCase() : addr[i];
    }
    return ret;
  }

  /**
   * Valida formato de endereço
   */
  static isValidAddress(addr) {
    return /^0x[a-fA-F0-9]{40}$/.test(addr);
  }

  /**
   * Gera privkey aleatória
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
}
