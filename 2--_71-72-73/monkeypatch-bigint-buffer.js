/**
 * MONKEYPATCH: bigint-buffer para Solana
 * Compatível com Node.js ESM (v18+)
 * 
 * Aplicar ANTES de qualquer import Solana:
 * ```
 * import './monkeypatch-bigint-buffer.js';
 * import { SolanaSolver } from './solana/config/solver.js';
 * ```
 */

import Module from 'module';
import { fileURLToPath } from 'url';
import path from 'path';

// Desabilitar uso de bindings nativos
process.env.BIGINT_BUFFER_DISABLE_NATIVE = 'true';

// CommonJS require para context ESM
const require = Module.createRequire(fileURLToPath(import.meta.url));

// Guardar o original
const originalRequire = Module.prototype.require;

// Interceptar requires de bigint-buffer
Module.prototype.require = function (id) {
  if (id === 'bigint-buffer') {
    return {
      /**
       * Converte Buffer para BigInt (Little Endian)
       */
      toBigIntLE: (buf) => {
        if (!Buffer.isBuffer(buf)) {
          throw new TypeError('Expected Buffer');
        }
        // Reverter bytes (LE) e converter para hex → BigInt
        return BigInt('0x' + buf.toString('hex').match(/../g).reverse().join(''));
      },

      /**
       * Converte BigInt para Buffer (Little Endian)
       */
      toBufferLE: (bigint, width) => {
        if (typeof bigint !== 'bigint') {
          throw new TypeError('Expected BigInt');
        }
        if (!Number.isInteger(width) || width <= 0) {
          throw new RangeError('Width must be positive integer');
        }

        // Converter BigInt para hex string
        let hex = bigint.toString(16);
        
        // Pad com zero se necessário (hex deve ter número par de chars)
        if (hex.length % 2) hex = '0' + hex;

        // Converter hex para Buffer (LE = reverter bytes)
        const bytes = hex.match(/../g).reverse();
        const buf = Buffer.from(bytes.join(''), 'hex');

        // Se buffer é maior que width, truncar
        if (buf.length >= width) {
          return buf.subarray(0, width);
        }

        // Se buffer é menor, fazer padding com zeros
        const padded = Buffer.alloc(width);
        buf.copy(padded);
        return padded;
      }
    };
  }

  // Para todos os outros módulos, usar require original
  return originalRequire.apply(this, arguments);
};

console.log('✅ Monkeypatch bigint-buffer ativado (ESM)');
