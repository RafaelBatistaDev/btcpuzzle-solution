#!/usr/bin/env node

/**
 * Gerador de Chaves Solana - Utilitário
 * 
 * Gera novos pares de chaves válidos para Solana (Ed25519 + Base58)
 * 
 * Uso:
 *   1. Aleatorio (seguro):
 *      node solana/config/generate_keys.js --random 3
 * 
 *   2. Sequencial (para Puzzles):
 *      node solana/config/generate_keys.js --sequential 71 10
 * 
 *   3. A partir de um hex customizado:
 *      node solana/config/generate_keys.js --hex 0x4000000000000000 5
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { CryptoEngine } from './utils.js';
import { PUZZLE_CONFIG } from './config.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Parse de argumentos
const args = process.argv.slice(2);
const modo = args[0]; // --random, --sequential, --hex
const param1 = args[1]; // puzzle ID ou quantidade ou hex
const param2 = args[2]; // quantidade (se --sequential)

function exibir_uso() {
  console.log(`
╔════════════════════════════════════════════════════════════╗
║  🔐 GERADOR DE CHAVES SOLANA - Ed25519 + Base58           ║
╚════════════════════════════════════════════════════════════╝

USO:
  1️⃣  Gerar aleatórias (seguras):
      node solana/config/generate_keys.js --random 3

  2️⃣  Gerar sequenciais (Puzzle 71):
      node solana/config/generate_keys.js --sequential 71 10

  3️⃣  Gerar a partir de hex customizado:
      node solana/config/generate_keys.js --hex 0x4000000000000000 5

EXEMPLOS:
  $ node generate_keys.js --random 1          # 1 chave aleatória
  $ node generate_keys.js --sequential 72 5   # 5 chaves do Puzzle 72
  $ node generate_keys.js --hex 0x0001 3      # 3 chaves sequenciais do hex
`);
}

function main() {
  if (!modo || !param1) {
    exibir_uso();
    process.exit(1);
  }

  let quantidade = 1;
  let rangeMinHex = null;

  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║  🔐 GERANDO CHAVES SOLANA                                  ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  // ─────────────────────────────────────────────────
  // MODO: ALEATÓRIO
  // ─────────────────────────────────────────────────
  if (modo === '--random') {
    quantidade = Number(param1) || 1;
    console.log(`🎲 Modo: ALEATÓRIO (${quantidade} chave${quantidade > 1 ? 's' : ''})\n`);
    
    // Gera chaves aleatórias (sem rangeMinHex)
    const chaves = CryptoEngine.gerarNovasChavesEquivalentes(quantidade);
    const validacao = CryptoEngine.validarChavesGeradas(chaves);

    exibir_resultados(chaves, validacao);
    salvar_em_arquivo(chaves, 'aleatorias');
  }

  // ─────────────────────────────────────────────────
  // MODO: SEQUENCIAL (PUZZLE)
  // ─────────────────────────────────────────────────
  else if (modo === '--sequential') {
    const puzzleId = Number(param1);
    quantidade = Number(param2) || 1;

    if (![71, 72, 73].includes(puzzleId)) {
      console.error(`❌ Puzzle inválido! Deve ser 71, 72 ou 73`);
      process.exit(1);
    }

    const config = PUZZLE_CONFIG[puzzleId];
    rangeMinHex = config.rangeMin;

    console.log(`🔗 Modo: SEQUENCIAL (${quantidade} chave${quantidade > 1 ? 's' : ''})`);
    console.log(`📋 Puzzle: SOL_PUZZLE_${puzzleId}`);
    console.log(`🔀 Range Min: ${rangeMinHex}\n`);

    // Gera chaves sequenciais
    const chaves = CryptoEngine.gerarNovasChavesEquivalentes(quantidade, rangeMinHex);
    const validacao = CryptoEngine.validarChavesGeradas(chaves);

    exibir_resultados(chaves, validacao);
    salvar_em_arquivo(chaves, `puzzle_${puzzleId}_sequencial`);
  }

  // ─────────────────────────────────────────────────
  // MODO: HEX CUSTOMIZADO
  // ─────────────────────────────────────────────────
  else if (modo === '--hex') {
    rangeMinHex = param1;
    quantidade = Number(param2) || 1;

    console.log(`🔗 Modo: HEX CUSTOMIZADO (${quantidade} chave${quantidade > 1 ? 's' : ''})`);
    console.log(`📍 Inicio: ${rangeMinHex}\n`);

    // Gera chaves sequenciais a partir do hex
    const chaves = CryptoEngine.gerarNovasChavesEquivalentes(quantidade, rangeMinHex);
    const validacao = CryptoEngine.validarChavesGeradas(chaves);

    exibir_resultados(chaves, validacao);
    salvar_em_arquivo(chaves, 'hex_customizado');
  }

  // ─────────────────────────────────────────────────
  // MODO DESCONHECIDO
  // ─────────────────────────────────────────────────
  else {
    console.error(`❌ Modo desconhecido: ${modo}`);
    exibir_uso();
    process.exit(1);
  }
}

function exibir_resultados(chaves, validacao) {
  console.log('═'.repeat(70));
  console.log('📊 RESULTADOS');
  console.log('═'.repeat(70));

  for (let i = 0; i < chaves.length; i++) {
    const chave = chaves[i];
    console.log(`\n[${i + 1}/${chaves.length}] ✓ Chave Gerada`);
    console.log(`  ├─ Private Key (Hex):  ${chave.privHex}`);
    console.log(`  ├─ Endereço Solana:    ${chave.endereco}`);
    console.log(`  ├─ Modo:               ${chave.modo}`);
    console.log(`  └─ Timestamp:          ${chave.timestamp}`);
  }

  console.log('\n' + '═'.repeat(70));
  console.log('✅ VALIDAÇÃO');
  console.log('═'.repeat(70));
  console.log(`  ├─ Total Gerado:       ${validacao.resumo.totalGeradas}`);
  console.log(`  ├─ Válidas:            ${validacao.resumo.totalValidas} ✓`);
  console.log(`  └─ Inválidas:          ${validacao.resumo.totalInvalidas} ✗`);

  if (validacao.invalidas.length > 0) {
    console.log('\n⚠️  CHAVES INVÁLIDAS:');
    validacao.invalidas.forEach((inv, idx) => {
      console.log(`  [${idx + 1}] ${inv.privHex} - ${inv.erro}`);
    });
  }
}

function salvar_em_arquivo(chaves, etiqueta) {
  const logsDir = path.join(__dirname, '..', 'logs');
  
  if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '');
  const filename = `keys_${etiqueta}_${timestamp}.jsonl`;
  const filepath = path.join(logsDir, filename);

  const conteudo = chaves.map(c => JSON.stringify(c)).join('\n') + '\n';
  fs.writeFileSync(filepath, conteudo, 'utf-8');

  console.log(`\n💾 Arquivo salvo: ${filepath}\n`);
}

main();
