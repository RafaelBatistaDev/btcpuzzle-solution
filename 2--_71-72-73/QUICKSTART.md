# 🚀 Guia de Início Rápido (Quick Start)

Este guia ensina a preparar o ambiente, configurar credenciais, iniciar os solvers e auditar resultados.

---

## 📋 Resumo de Comandos

| Operação | Script | Objetivo |
| :--- | :--- | :--- |
| **Instalar dependências** | `chmod +x *.sh *.py && ./setup_toolbox.sh` | Node.js, NPM, Python e bibliotecas |
| **Orquestrador Bitcoin** | `./orchestrator_bitcoin.sh` | Puzzles 71→72→73 só em Bitcoin |
| **Orquestrador LTC+DOGE** | `./orchestrator_ltc_doge.sh` | Puzzles 71→72→73 em Litecoin e Dogecoin |
| **Orquestrador EVM** | `./orchestrator_evm.sh` | Puzzles 71→72→73 em ETH, Polygon, BNB e Solana |
| **Puzzle 71 (todas redes)** | `chmod +x *.sh *.py *.js  && ./start_puzzle71_all.sh` | Abre 3 terminais e roda P71 em paralelo |
| **Puzzle 72 (todas redes)** | `chmod +x *.sh *.py && ./start_puzzle72_all.sh` | Abre 3 terminais e roda P72 em paralelo |
| **Puzzle 73 (todas redes)** | `chmod +x *.sh *.py && ./start_puzzle73_all.sh` | Abre 3 terminais e roda P73 em paralelo |
| **Verificar tudo** | `chmod +x *.sh *.py && uv run check_all_networks.py` | Auditoria consolidada |

### Tabela de Iniciar / Parar

| Modo | Iniciar | Parar |
| :--- | :--- | :--- |
| **Bitcoin (P71→P73)** | `./orchestrator_bitcoin.sh` | `./stop_orchestrator_bitcoin.sh` |
| **Litecoin + Dogecoin (P71→P73)** | `./orchestrator_ltc_doge.sh` | `./stop_orchestrator_ltc_doge.sh` |
| **EVM + Solana (P71→P73)** | `./orchestrator_evm.sh` | `./stop_orchestrator_evm.sh` |
| **Puzzle 71 (todas redes)** | `./start_puzzle71_all.sh` | `./stop_puzzle71_all.sh` |
| **Puzzle 72 (todas redes)** | `./start_puzzle72_all.sh` | `./stop_puzzle72_all.sh` |
| **Puzzle 73 (todas redes)** | `./start_puzzle73_all.sh` | `./stop_puzzle73_all.sh` |

---

## 🛠️ Passo 1: Ambiente

```bash
chmod +x *.sh lib/*.sh
./setup_toolbox.sh
```

Opcional (Toolbox / Fedora Silverblue):

```bash
toolbox create puzzle-solver
toolbox enter puzzle-solver
```

---

## ⚙️ Passo 2: Configurar `.env`

```bash
cp .env.example .env
```

Variáveis críticas:

- `SEARCH_MODE=sequential` — **obrigatório**
- `BATCH_SIZE=1` — recomendado para evitar rate limits
- Preencha `ETHERSCAN_KEY`, `BSCSCAN_KEY` e endpoints RPC

---

## 🏎️ Passo 3: Executar

### Opção A — 3 orquestradores (recomendado para rodar tudo)

Abra **3 terminais** e execute um orquestrador em cada:

```bash
./orchestrator_bitcoin.sh      # terminal 1
./orchestrator_ltc_doge.sh     # terminal 2
./orchestrator_evm.sh          # terminal 3
```

Cada orquestrador inicia os puzzles 71, 72 e 73 do seu grupo com intervalos entre eles para não sobrecarregar RPC/rede.

### Opção B — Um puzzle em todas as redes

Abre automaticamente 3 terminais (Bitcoin | LTC+DOGE | EVM+Solana):

```bash
./start_puzzle71_all.sh   # só Puzzle 71
./start_puzzle72_all.sh   # só Puzzle 72
./start_puzzle73_all.sh   # só Puzzle 73
```

---

## ⏸️ Passo 4: Parar com segurança

Use o script `stop_*` correspondente ao que foi iniciado:

```bash
./stop_orchestrator_bitcoin.sh
./stop_orchestrator_ltc_doge.sh
./stop_orchestrator_evm.sh

./stop_puzzle71_all.sh
./stop_puzzle72_all.sh
./stop_puzzle73_all.sh
```

Também é possível usar `Ctrl+C` no terminal do orquestrador — o sinal é propagado aos processos filhos e o checkpoint é salvo em `cache/puzzle_*.json`.

---

## 📊 Passo 5: Verificar resultados

```bash
uv run check_all_networks.py
cat relatorio_final/saldos_encontrados.jsonl
```
