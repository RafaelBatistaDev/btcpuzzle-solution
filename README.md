# 🎯 Bitcoin Puzzle Suite

Conjunto completo de ferramentas para validação, análise e automação de carteiras Bitcoin e Solana através da plataforma HelioWallet. Sistema modular com 5 pipelines especializados.

---

## 📦 Estrutura do Projeto

### 1️⃣ **1-Validar-Endereços** | Validação de Endereços Bitcoin
Valida endereços Bitcoin gerados contra arquivo de puzzle range.

```bash
cd 1-Validar-Endereços
uv run validador_puzzle.py            # Valida contra resultado
uv run get_puzzle_range.py            # Extrai range do puzzle
```

**Arquivos:**
- `validador_puzzle.py` — motor de validação
- `get_puzzle_range.py` — extractor de range
- `resultado_puzzle.txt` — endereço alvo
- `A.md` — documentação

**Tech Stack:** Python 3.10+, uv

---

### 2️⃣ **2--71-72-73** | Bitcoin Puzzle Solver (Node.js)
Solver paralelo em Node.js para puzzles Bitcoin 71, 72, 73 usando toolbox Fedora containerizado.

```bash
cd 2--71-72-73

# Primeira vez - setup
toolbox create puzzle-solver
toolbox enter puzzle-solver
bash setup_toolbox.sh

# Executar solver
PUZZLE_ID=72 node puzzle_solver.js

# Monitorar
tail -f puzzle72.log
```

**Funcionalidades:**
- ✅ Geração paralela de chaves ECDSA
- ✅ Validação contra endereços target
- ✅ Persistência de estado em cache/
- ✅ Histórico por puzzle em PUZZLE_7X/

**Tech Stack:** Node.js 18+ ESM, elliptic, bs58, axios, Toolbox Fedora

**Arquivos Principais:**
- `puzzle_solver.js` — engine principal
- `setup_toolbox.sh` — auto-setup container
- `cache/` — estado persistente (JSON)
- `PUZZLE_7X/` — histórico de batches

---

### 3️⃣ **3-Converte-Jsonl-Extrair-Private-Key** | Extração de Private Keys
Converte histórico JSONL de batches em arquivo de private keys em hexadecimal.

```bash
cd 3-Converte-Jsonl-Extrair-Private-Key

# Modo padrão (procura batch_history.jsonl no diretório)
uv run extract_privhex.py

# Com caminhos explícitos
uv run extract_privhex.py -i /caminho/batch_history.jsonl -o /caminho/saida.txt
```

**Funcionalidades:**
- ✅ Parsing incremental de JSONL
- ✅ Extração de private keys em hex
- ✅ Agregação de múltiplos sources
- ✅ Suporte a caminhos customizados

**Tech Stack:** Python 3.10+, uv

**Saída:**
- `privhex_output.txt` — lista de private keys
- `Total_output.txt` — consolidado

---

### 4️⃣ **4-Private-Key-Bitcoin-HelioWallet** | Automação Bitcoin
Validação automatizada de frases mnemonics e extração de saldos Bitcoin via HelioWallet.

```bash
cd 4-Private-Key-Bitcoin-HelioWallet

# Processar (continua de onde parou)
uv run automacao_bitcoin_saldo.py frases.txt

# Com browser visível
uv run automacao_bitcoin_saldo.py frases.txt --show

# Resetar histórico e recomeçar
uv run automacao_bitcoin_saldo.py frases.txt --reset
```

**Sistema de Rastreamento:**
- 📊 `logs/checkpoint.json` — posição última execução
- ✅ `logs/linhas_sucesso_heliowallet.txt` — frases com sucesso
- ❌ `logs/linhas_falha_heliowallet.txt` — frases falhadas
- 📋 `logs/dados_completos_heliowallet.jsonl` — saldos capturados

**Funcionalidades:**
- ✅ Validação de mnemonics BIP39 (12-24 palavras)
- ✅ Extração de saldos BTC e USD
- ✅ Rastreamento automático de progresso
- ✅ Processamento incremental (sem repetições)
- ✅ Modo headless e visual

**Tech Stack:** Python 3.10+, Playwright (Firefox), uv

**Veja:** [GUIA_PROGRESSO.md](4-Private-Key-Bitcoin-HelioWallet/GUIA_PROGRESSO.md)

---

### 5️⃣ **5-Private-Key-Solana-HelioWallet** | Automação Solana
Idêntico ao Bitcoin mas para Solana - validação de mnemonics e extração de saldos SOL.

```bash
cd 5-Private-Key-Solana-HelioWallet

# Processar (continua de onde parou)
uv run automacao_solana_saldo.py frases.txt

# Com browser visível
uv run automacao_solana_saldo.py frases.txt --show

# Resetar histórico e recomeçar
uv run automacao_solana_saldo.py frases.txt --reset
```

**Sistema de Rastreamento:** *(Idêntico ao Bitcoin)*
- 📊 `logs/checkpoint.json` — posição última execução
- ✅ `logs/linhas_sucesso_heliowallet.txt` — frases com sucesso
- ❌ `logs/linhas_falha_heliowallet.txt` — frases falhadas
- 📋 `logs/dados_completos_heliowallet.jsonl` — saldos capturados

**Funcionalidades:**
- ✅ Validação de mnemonics BIP39 (12-24 palavras)
- ✅ Extração de saldos SOL e USD
- ✅ Rastreamento automático de progresso
- ✅ Processamento incremental (sem repetições)
- ✅ Modo headless e visual

**Tech Stack:** Python 3.10+, Playwright (Firefox), uv

**Veja:** [GUIA_PROGRESSO.md](5-Private-Key-Solana-HelioWallet/GUIA_PROGRESSO.md)

---

## 🔄 Pipeline Completo de Uso

```
┌─────────────────────────────────────────────────────────┐
│ 2. PUZZLE SOLVER (Node.js)                              │
│ Gera candidates e private keys → PUZZLE_7X/             │
└──────────────────┬──────────────────────────────────────┘
                   │
                   ↓
┌─────────────────────────────────────────────────────────┐
│ 3. EXTRATOR JSONL → PRIVHEX (Python)                    │
│ batch_history.jsonl → privhex_output.txt                │
└──────────────────┬──────────────────────────────────────┘
                   │
        ┌──────────┴──────────┐
        ↓                     ↓
┌──────────────────┐   ┌──────────────────┐
│ 4. BITCOIN       │   │ 5. SOLANA        │
│ Automação        │   │ Automação        │
│ (HelioWallet)    │   │ (HelioWallet)    │
│ BTC + USD        │   │ SOL + USD        │
└──────────────────┘   └──────────────────┘
        │                     │
        └──────────┬──────────┘
                   ↓
┌─────────────────────────────────────────────────────────┐
│ 1. VALIDAÇÃO DE ENDEREÇOS (Python)                      │
│ Verifica resultados contra puzzle range                 │
└─────────────────────────────────────────────────────────┘
```

---

## 🛠️ Requisitos Globais

### Obrigatório
- Python 3.10+
- Node.js 18+ (para pasta 2)
- uv (gerenciador Python)

### Para Pasta 2 (Solver Node)
- Linux com Toolbox (Fedora/Silverblue/COSMIC)
- Podman (rootless)

### Para Automações (Pastas 4-5)
- Firefox (ou Chromium) instalado
- Conexão com internet
- Playwright instalado via `uv`

---

## 📊 Formato de Dados

### Input: Frases Mnemonics
```
arquivo frases.txt (uma por linha)
twelve word recovery phrase example for wallet access
another twelve word recovery phrase for bitcoin test
```

### Output: JSONL (Saldos)
```json
{"frase": "twelve word...", "timestamp": "2026-05-31T10:30:00", "saldo_btc": "0.05", "saldo_usd": "2100.50"}
{"frase": "another twelve...", "timestamp": "2026-05-31T10:35:00", "saldo_sol": "150.25", "saldo_usd": "25000.00"}
```

### Output: TXT (Listas)
```
// linhas_sucesso_heliowallet.txt
twelve word recovery phrase example for wallet access
another twelve word recovery phrase for bitcoin test

// linhas_falha_heliowallet.txt
invalid twelve word phrase here should not work
another broken phrase for testing purposes only
```

---

## 🚀 Quick Start

```bash
# 1. Clonar/Entrar no repositório
cd /var/home/recifecrypto/OneDrive/btcpuzzle

# 2. Setup Python (pasta 1, 3, 4 ou 5)
cd 4-Private-Key-Bitcoin-HelioWallet
uv sync  # instala dependências

# 3. Copiar arquivo de frases
cp ~/seus_dados/frases.txt .

# 4. Executar automação
uv run automacao_bitcoin_saldo.py frases.txt

# 5. Monitorar progresso
tail -f logs/checkpoint.json
```

---

## 📍 Começar - Guia Passo a Passo

### 1️⃣ Validar Endereços
Valida endereços Bitcoin gerados contra arquivo de puzzle range.

```bash
cd 1-Validar-Endereços
uv run validador_puzzle.py
```
👉 **Função:** Verifica se um endereço corresponde ao puzzle alvo

---

### 2️⃣ Procurar Desafios (Puzzles 71, 72, 73)
Executa solver paralelo em Node.js para gerar e testar chaves.

```bash
cd 2--71-72-73
toolbox enter puzzle-solver
PUZZLE_ID=72 node puzzle_solver.js
```
👉 **Função:** Gera candidates e mantém histórico em `PUZZLE_7X/`

---

### 3️⃣ Converter JSONL e Extrair Private Keys
Extrai private keys em hexadecimal do histórico de batches.

```bash
cd 3-Converte-Jsonl-Extrair-Private-Key
uv run extract_privhex.py
```
👉 **Função:** Converte `batch_history.jsonl` → `privhex_output.txt`

---

### 4️⃣ Procurar Saldo Bitcoin (HelioWallet)
Automação para validar mnemonics e extrair saldos BTC.

```bash
cd 4-Private-Key-Bitcoin-HelioWallet
uv run automacao_bitcoin_saldo.py frases.txt
```
👉 **Função:** Obtém BTC + USD para cada frase válida  
📊 **Saída:** `logs/linhas_sucesso_heliowallet.txt` + `logs/dados_completos_heliowallet.jsonl`

---

### 5️⃣ Procurar Saldo Solana (HelioWallet)
Automação para validar mnemonics e extrair saldos SOL.

```bash
cd 5-Private-Key-Solana-HelioWallet
uv run automacao_solana_saldo.py frases.txt
```
👉 **Função:** Obtém SOL + USD para cada frase válida  
📊 **Saída:** `logs/linhas_sucesso_heliowallet.txt` + `logs/dados_completos_heliowallet.jsonl`

---

---

## 📈 Monitoramento

```bash
# Ver progresso em tempo real
watch -n 5 "wc -l logs/*.txt"

# Verificar último checkpoint
cat logs/checkpoint.json | jq .

# Contar sucessos vs falhas
echo "Sucesso: $(wc -l < logs/linhas_sucesso_heliowallet.txt)"
echo "Falha: $(wc -l < logs/linhas_falha_heliowallet.txt)"
```

---

## 🐛 Troubleshooting

| Problema | Solução |
|----------|---------|
| `ModuleNotFoundError: No module named 'playwright'` | `uv sync` na pasta correspondente |
| Frase não valida | Verifique formato BIP39 (12, 15, 18, 21 ou 24 palavras) |
| Script parou | Execute novamente - retoma de onde parou (exceto com `--reset`) |
| Browser não aparece | Use `--show` para modo visual em lugar de headless |
| Muito lento | Aumente `TIMEOUT_PAGINA` e `ESPERA_CAPTURA` nos scripts |

---

## 📝 Licença

MIT License - Libre para uso educacional e pesquisa

---

## 🔗 Referências Rápidas

| Pasta | Função | Comando |
|-------|--------|---------|
| 1 | Validar endereços | `uv run validador_puzzle.py` |
| 2 | Gerar/Buscar chaves | `PUZZLE_ID=72 node puzzle_solver.js` |
| 3 | Extrair private keys | `uv run extract_privhex.py` |
| 4 | Automação Bitcoin | `uv run automacao_bitcoin_saldo.py frases.txt` |
| 5 | Automação Solana | `uv run automacao_solana_saldo.py frases.txt` |

---

**Última Atualização:** 31 de maio de 2026  
**Versão:** 2.1 (Com Sistema de Rastreamento)
