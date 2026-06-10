# 🔐 Geração de Chaves Solana - Documentação

## Arquitetura de Derivação

Na rede Solana (que utiliza a curva elíptica **Ed25519**), o processo seguro e correto para gerar novos endereços válidos funciona a partir de uma semente (Seed) de 32 bytes (256 bits).

```
[Semente / Chave Privada Hex] ──> [Algoritmo Ed25519] ──> [Chave Pública (Bytes)] ──> [Codificação Base58] ──> Endereço Solana
```

### Implementação no Projeto

A lógica está centralizada em **`solana/config/utils.js`** na classe `CryptoEngine`:

```javascript
// 1. Método principal: Gera chaves equivalentes
CryptoEngine.gerarNovasChavesEquivalentes(quantidade, rangeMinHex?)

// 2. Método auxiliar: Valida chaves geradas
CryptoEngine.validarChavesGeradas(chaves)
```

---

## 🛠️ Como Usar

### Opção 1: Gerar Chaves Aleatórias (Seguras)

Para gerar 3 chaves criptograficamente seguras e aleatórias:

```bash
node solana/config/generate_keys.js --random 3
```

**Output:**
```
🎲 Modo: ALEATÓRIO (3 chaves)

[1/3] ✓ Chave Gerada
  ├─ Private Key (Hex):  0x8f2a3c...
  ├─ Endereço Solana:    4ZJhPQAgU...
  ├─ Modo:               aleatorio
  └─ Timestamp:          2026-06-04T22:52:24.123Z

💾 Arquivo salvo: solana/logs/keys_aleatorias_20260604_225224.jsonl
```

### Opção 2: Gerar Chaves Sequenciais (Para Puzzles)

Para gerar 10 chaves sequenciais a partir do início do **Puzzle 71**:

```bash
node solana/config/generate_keys.js --sequential 71 10
```

**Output:**
```
🔗 Modo: SEQUENCIAL (10 chaves)
📋 Puzzle: SOL_PUZZLE_71
🔀 Range Min: 0x0000000000000000000000000000000000000000000000400000000000000000

[1/10] ✓ Chave Gerada
  ├─ Private Key (Hex):  0x0000000000000000000000000000000000000000000000400000000000000000
  ├─ Endereço Solana:    4ZJhPQAgUseCsWhKvJLTmmRRUV74fdoTpQLNfKoekbPY
  ├─ Modo:               sequencial
  └─ Timestamp:          2026-06-04T22:52:24.123Z

...

[10/10] ✓ Chave Gerada
  ├─ Private Key (Hex):  0x0000000000000000000000000000000000000000000000400000000000000009
  ├─ Endereço Solana:    7mRe9X1fHKzqJ5vLYkMU7ywQQVGWRKbKNnL1YPqJPZ5M
  ├─ Modo:               sequencial
  └─ Timestamp:          2026-06-04T22:52:24.234Z

💾 Arquivo salvo: solana/logs/keys_puzzle_71_sequencial_20260604_225224.jsonl
```

### Opção 3: Gerar a Partir de um Hex Customizado

Para gerar 5 chaves sequenciais a partir de um hex específico:

```bash
node solana/config/generate_keys.js --hex 0x4000000000000000 5
```

---

## 📊 Validação de Chaves

Todas as chaves geradas são **automaticamente validadas**:

```javascript
// Internamente, cada chave passa por:
CryptoEngine.isValidAddress(endereco)  // ✓ Valida formato Base58 + 32 bytes
```

**Checklist de Validação:**
- ✅ Formato Base58 válido
- ✅ Exatamente 32 bytes (256 bits) para endereço
- ✅ Derivação Ed25519 correta
- ✅ Timestamp ISO para rastreabilidade

---

## 🔒 Segurança e Armazenamento

### ⚠️ Checkpoint de Segurança

1. **Persistência Segura:** 
   - Chaves são salvas em `solana/logs/keys_*.jsonl` 
   - Protegidas por permissões do filesystem Linux
   - Nenhuma chave é exibida em logs de console (apenas quando solicitado)

2. **Formato do Output:**
   - Cada endereço segue o padrão Base58 Solana
   - Compatível com mainnet, devnet e testnet
   - Totalmente válido para transferências reais

3. **Integração com Puzzle Solver:**
   - O gerador alimenta as chaves sequenciais do seu puzzle solver
   - Mantém sincronização com `solana/cache/puzzle_*.json`
   - Respeita os ranges definidos em `config.js`

---

## 🔄 Integração com Seu Pipeline

### Dentro do `solver.js`

O `CryptoEngine.gerarNovasChavesEquivalentes()` já está integrado:

```javascript
// Geração de privkeys no loop de busca (solver.js)
const chaves = CryptoEngine.gerarNovasChavesEquivalentes(
  RUNTIME_CONFIG.BATCH_SIZE,
  this.state.lastPrivkey  // Continua de onde parou
);
```

### Para Uso Manual (Desenvolvimento/Testes)

```javascript
// 1. Gerar aleatórias
const chavasAleatorias = CryptoEngine.gerarNovasChavesEquivalentes(5);

// 2. Validar
const validacao = CryptoEngine.validarChavesGeradas(chavasAleatorias);
console.log(`${validacao.resumo.totalValidas} chaves válidas`);

// 3. Processar
chavasAleatorias.forEach(chave => {
  console.log(`${chave.endereco} (${chave.privHex})`);
});
```

---

## 📋 Ficheiros Relacionados

- **`utils.js`**: Implementação `CryptoEngine.gerarNovasChavesEquivalentes()`
- **`config.js`**: Configuração de ranges e targets (lê do `.env`)
- **`solver.js`**: Usa o gerador internamente no loop de busca
- **`generate_keys.js`**: CLI utilitário para geração isolada
- **`logs/`**: Armazena chaves geradas em formato JSONL

---

## 🎯 Exemplos Práticos

### Exemplo 1: Backup de Carteira de Teste

```bash
# Gerar 10 chaves aleatórias para teste
node solana/config/generate_keys.js --random 10

# Resultado: solana/logs/keys_aleatorias_<timestamp>.jsonl
# Use para pré-financiar suas contas de teste na devnet
```

### Exemplo 2: Continuar Puzzle Interrompido

```bash
# Se seu puzzle foi interrompido, recomece sequencialmente
node solana/config/generate_keys.js --sequential 72 100

# Depois: node solana/puzzle_solver_solana.js
# O solver continuará de onde o gerador parou
```

### Exemplo 3: Validar Batch Gerado

```javascript
// No seu script Node.js
import { CryptoEngine } from './solana/config/utils.js';

const chaves = CryptoEngine.gerarNovasChavesEquivalentes(1000);
const validacao = CryptoEngine.validarChavesGeradas(chaves);

console.log(`✅ ${validacao.resumo.totalValidas} endereços válidos`);
console.log(`❌ ${validacao.resumo.totalInvalidas} endereços inválidos`);
```

---

## 🚨 Troubleshooting

| Erro | Solução |
|------|---------|
| `RangeError: private key must be 32 bytes` | Verifique se o hex tem exatamente 64 caracteres (após `0x`) |
| `Invalid Base58 character` | A chave foi corrompida ou não foi derivada corretamente |
| `ENOENT: solana/logs/` | Crie a pasta manualmente: `mkdir -p solana/logs` |
| `TypeError: Cannot read property 'getPublic'` | tweetnacl não foi instalado - rode `npm install` |

---

## 📚 Referências

- [Solana Program Library - Ed25519](https://github.com/solana-labs/solana-program-library)
- [TweetNaCl.js - Ed25519](https://tweetnacl.js.org/)
- [Base58Check Encoding](https://en.bitcoin.it/wiki/Base58Check_encoding)
- [Solana Address Format](https://docs.solana.com/terminology#address)
