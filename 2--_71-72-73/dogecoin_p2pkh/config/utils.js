/**
 * Utilitários Criptográficos Dogecoin P2PKH (BIP44)
 */
import crypto from 'crypto';
import { createHash } from 'crypto';
import EC from 'elliptic';
import bs58 from 'bs58';

const ec = new EC.ec('secp256k1');

export const DOGE_P2PKH_REGEX = /^D[5-9A-HJ-NP-U][a-km-zA-HJ-NP-Z1-9]{25,33}$/;

export class CryptoEngine {
  /**
   * Converte privkey para endereço Dogecoin P2PKH (Compressed) — prefixo 0x1E
   */
  static privkeyToAddress(privkeyInt) {
    const privkeyHex = BigInt(privkeyInt).toString(16).padStart(64, '0');
    const key    = ec.keyFromPrivate(privkeyHex);
    const pubkey = key.getPublic();
    const x      = pubkey.getX().toString(16).padStart(64, '0');
    const y      = pubkey.getY().toString(16).padStart(64, '0');

    const prefix       = parseInt(y.slice(-1), 16) % 2 === 0 ? '02' : '03';
    const pubkeyBuffer = Buffer.from(prefix + x, 'hex');

    const sha256    = createHash('sha256').update(pubkeyBuffer).digest();
    const ripemd160 = createHash('ripemd160').update(sha256).digest();
    const payload   = Buffer.concat([Buffer.from([0x1E]), ripemd160]);
    const checksum  = createHash('sha256')
      .update(createHash('sha256').update(payload).digest())
      .digest()
      .slice(0, 4);

    return bs58.encode(Buffer.concat([payload, checksum]));
  }

  /**
   * Converte privkey para WIF Dogecoin (Compressed) — prefixo 0x9E
   */
  static privkeyToWif(privkeyInt) {
    const privkeyHex = BigInt(privkeyInt).toString(16).padStart(64, '0');
    const prefix     = Buffer.from([0x9E]);
    const key        = Buffer.from(privkeyHex, 'hex');
    const suffix     = Buffer.from([0x01]);
    const extended   = Buffer.concat([prefix, key, suffix]);
    const checksum   = createHash('sha256')
      .update(createHash('sha256').update(extended).digest())
      .digest()
      .slice(0, 4);

    return bs58.encode(Buffer.concat([extended, checksum]));
  }

  /**
   * Valida formato de endereço Dogecoin P2PKH (D...)
   */
  static isValidAddress(addr) {
    if (!addr || typeof addr !== 'string') return false;
    return DOGE_P2PKH_REGEX.test(addr);
  }

  static generateRandomPrivkey(min, max) {
    if (min <= 0n || max <= 0n) throw new Error('Range inválido');
    if (min > max)              throw new Error('Range inválido');

    const range       = max - min + 1n;
    const randomBytes = BigInt('0x' + crypto.randomBytes(32).toString('hex'));
    const privkey     = min + (randomBytes % range);

    if (privkey < min || privkey > max) throw new Error('Privkey fora do range');
    return privkey;
  }

  static validatePrivkeyRange(privkey, min, max) {
    return privkey >= min && privkey <= max && privkey > 0n;
  }
}
