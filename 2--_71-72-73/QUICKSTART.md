# 🚀 Guia de Início Rápido (Quick Start)


**Opção B: Executar um puzzle específico em todas as redes**
    ```bash
    ./run_all_networks_puzzle71.sh
    ./run_all_networks_puzzle72.sh
    ./run_all_networks_puzzle73.sh
    ```
    toolbox create puzzle-solver
    toolbox enter puzzle-solver
    
    uv run check_all_networks.py
    

Este guia prático ensina a preparar o ambiente, configurar as credenciais, inicializar os solvers em paralelo e auditar os relatórios finais do projeto.

---

## 📋 Resumo de Comandos Rápidos

| Operação | Script/Comando | Objetivo |
| :--- | :--- | :--- |
| **Instalar Dependências** | `./setup_toolbox.sh` | Configura o Node.js, NPM, Python e instala bibliotecas. |
| **Iniciar Tudo (Mestre)** | `./run_all_networks_all_puzzles.sh` | Roda os 3 puzzles (71, 72, 73) nas 5 redes simultaneamente. |
| **Bitcoin (P71-P73)** | `./run_all_puzzles_bitcoin.sh` | Inicia solvers dedicados de Bitcoin. |
| **Ethereum (P71-P73)** | `./run_all_puzzles_ethereum.sh` | Inicia solvers dedicados de Ethereum. |
| **Solana (P71-P73)** | `./run_all_puzzles_solana.sh` | Inicia solvers dedicados de Solana. |
| **Polygon (P71-P73)** | `./run_all_puzzles_polygon.sh` | Inicia solvers dedicados de Polygon. |
| **BNB Chain (P71-P73)** | `./run_all_puzzles_bnb.sh` | Inicia solvers dedicados de BNB Chain. |
| **Verificar Tudo** | `uv run check_all_networks.py` | Executa o auditor Python mestre para todas as blockchains. |
| **Verificar Balanço Rápido** | `./check_balance.sh` | Faz checagem consolidada rápida de Bitcoin e Ethereum. |

---

## 🛠️ Passo 1: Preparando o Ambiente e Dependências

Para evitar conflitos com o sistema host, recomenda-se criar e rodar o projeto através de um contêiner Toolbox (para usuários de sistemas imutáveis/Silverblue) ou instalar diretamente no terminal Unix compatível.

```bash
# 1. Torne os scripts executáveis
chmod +x *.sh *.py

# 2. Instale as dependências (Node.js, Python 3.11+, NPM e dependências de pacotes)
./setup_toolbox.sh
```

---

## ⚙️ Passo 2: Configurando Variáveis de Ambiente (`.env`)

Crie o arquivo de configurações na raiz do projeto:

```bash
cp .env.example .env
```

Abra o arquivo `.env` e configure seus endpoints e alvos.

> [!WARNING]
> Certifique-se de preencher a variável `BSCSCAN_KEY` e `ETHERSCAN_KEY` com chaves válidas. A chave `POLYGON_RPC_ENDPOINT` e `SOL_RPC_ENDPOINT` já possuem endpoints RPC ativos de alta velocidade de uso público/premium do dRPC e Helius.

### Variáveis Críticas de Validação

*   `SEARCH_MODE=sequential`: **Obrigatório**. Qualquer outro modo causará erro crítico de inicialização no validador.
*   `BATCH_SIZE=1`: Tamanho do lote. Recomendado manter valores baixos (`1` a `10`) para evitar rate limits excessivos dos servidores de RPC públicos.

---

## 🏎️ Passo 3: Executando os Solvers

### Executando em Paralelo Completo (Recomendado)
Para rodar todos os 3 puzzles (71, 72, 73) em todas as 5 redes simultaneamente:

```bash
./run_all_networks_all_puzzles.sh
```
*Este comando inicia 15 processos isolados e balanceados. Delays automáticos são injetados na inicialização para evitar sobrecarga imediata nas APIs.*

### Executando Redes Individuais
Se preferir testar ou concentrar o poder de busca em uma única blockchain:

```bash
./run_all_puzzles_bitcoin.sh     # Executa P71, P72 e P73 de Bitcoin
./run_all_puzzles_ethereum.sh    # Executa P71, P72 e P73 de Ethereum
./run_all_puzzles_solana.sh      # Executa P71, P72 e P73 de Solana
./run_all_puzzles_polygon.sh     # Executa P71, P72 e P73 de Polygon
./run_all_puzzles_bnb.sh         # Executa P71, P72 e P73 de BNB Chain
```

---

## ⏸️ Passo 4: Interrompendo a Busca com Segurança

Você pode parar os resolvedores a qualquer momento digitando `Ctrl+C` no terminal de execução:

1.  A interrupção de terminal (`SIGINT`) é capturada pelo script de orquestração.
2.  O sinal é propagado como `SIGTERM` de maneira ordenada para todos os processos filhos (Node.js).
3.  Cada resolvedor salva seu progresso atual (`lastPrivkey`) no arquivo de checkpoint `/cache/puzzle_*.json` antes de encerrar as threads.
4.  O progresso do checkpoint suporta formatos hexadecimais (com prefixo `0x`) e decimais, garantindo que ao reiniciar o script, a busca **retomará exatamente de onde parou**, sem resetar o range de busca de chaves privadas.

---

## 📊 Passo 5: Analisando e Verificando Resultados

Saldos encontrados são armazenados imediatamente nas pastas específicas de cada puzzle e consolidados no relatório central:

### 1. Auditoria Automática por Script
Rode a auditoria consolidada para buscar saldos ativos nos caches de busca:

```bash
# Executa a auditoria geral
uv run check_all_networks.py

# Se preferir auditar redes específicas:
uv run check_bitcoin.py
uv run check_ethereum.py
uv run check_solana.py
uv run check_polygon.py
uv run check_bnb.py
```

### 2. Leitura dos Arquivos de Relatório
*   **Resultados Consolidados**: `cat relatorio_final/saldos_encontrados.jsonl`
*   **Log de Chaves Verificadas**: `cat relatorio_final/all_networks_consolidated.jsonl`
*   **Sucesso do Solver (Txt)**: Se um puzzle for resolvido, um arquivo chamado `FOUND_<endereço>.txt` será criado na pasta correspondente com os detalhes da chave WIF e chave privada bruta.
