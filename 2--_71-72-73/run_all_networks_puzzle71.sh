#!/bin/bash

# 🚀 MASTER - Executa o Puzzle #71 em todos os 5 networks em paralelo
# Bitcoin, Ethereum, Solana, Polygon, BNB
# Modo: SEARCH_MODE=sequential (obrigatório)
# Com validação de API no início e tratamento robusto de erros

# NÃO parar em erro - continuar com os outros
set +e
# Job control — cada ( ... ) & ganha process group próprio (necessário para Ctrl+C)
set -m

declare -a pids=()
PIDFILE="/tmp/run_all_networks_puzzle71.pids"
echo $$ > "$PIDFILE"

record_pid() {
  echo "$1" >> "$PIDFILE"
}

kill_process_tree() {
  local sig=$1
  local pid=$2
  local child

  [ -z "$pid" ] && return 0
  for child in $(pgrep -P "$pid" 2>/dev/null); do
    kill_process_tree "$sig" "$child"
  done
  kill -"$sig" -- -"$pid" 2>/dev/null || kill -"$sig" "$pid" 2>/dev/null || true
}

cleanup() {
  echo -e "\n${YELLOW}⚠️  Interrupção detectada! Terminando todos os processos...${NC}"
  trap - SIGINT SIGTERM

  for pid in "${pids[@]}"; do
    if [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null; then
      kill_process_tree TERM "$pid"
    fi
  done

  pkill -TERM -P $$ 2>/dev/null || true
  sleep 2

  for pid in "${pids[@]}"; do
    kill_process_tree KILL "$pid"
  done
  pkill -KILL -P $$ 2>/dev/null || true

  wait 2>/dev/null || true
  rm -f "$PIDFILE"
  echo -e "${GREEN}✅ Processos finalizados.${NC}"
  exit 130
}
trap cleanup SIGINT SIGTERM SIGHUP

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Função para verificar internet
check_internet() {
  while ! curl -s -m 5 --connect-timeout 5 https://1.1.1.1 > /dev/null 2>&1; do
    echo "⚠️  Internet indisponível. Aguardando reconexão..."
    sleep 10
  done
  echo "✅ Internet OK"
}

# Função para testar API de cada rede
test_api_bitcoin() {
  local url="${BLOCKCHAIN_INFO_BASE_URL:-https://blockchain.info}"
  local probe_addr="1PWo3JeB9jrGwfHDNpdGK54CRas7fsVzXU"
  local test_url=""

  if [[ "$url" == *"mempool.space"* ]]; then
    local root="${url%/api}"
    root="${root%/}"
    test_url="${root}/api/address/${probe_addr}"
    echo -n "  🔗 Bitcoin API (Mempool.space)... "
  else
    test_url="${url}/balance?active=${probe_addr}"
    echo -n "  🔗 Bitcoin API (Blockchain.info)... "
  fi

  if curl -s -m 5 "${test_url}" > /dev/null 2>&1; then
    echo -e "${GREEN}✅${NC}"
    return 0
  else
    echo -e "${RED}❌${NC}"
    return 1
  fi
}

test_api_ethereum() {
  local url="${ETH_RPC_ENDPOINT:-https://rpc.ankr.com/eth}"
  echo -n "  🔗 Ethereum RPC... "
  if curl -s -m 5 -X POST -H "Content-Type: application/json" -H "Accept: application/json" -H "User-Agent: Puzzle-Solver/1.0" \
    -d '{"jsonrpc":"2.0","method":"eth_chainId","params":[],"id":1}' "$url" > /dev/null 2>&1; then
    echo -e "${GREEN}✅${NC}"
    return 0
  else
    echo -e "${RED}❌${NC}"
    return 1
  fi
}

test_api_polygon() {
  local url="${POLYGON_RPC_ENDPOINT:-https://rpc.ankr.com/polygon}"
  echo -n "  🔗 Polygon RPC... "
  if curl -s -m 5 -X POST -H "Content-Type: application/json" -H "Accept: application/json" -H "User-Agent: Puzzle-Solver/1.0" \
    -d '{"jsonrpc":"2.0","method":"eth_chainId","params":[],"id":1}' "$url" > /dev/null 2>&1; then
    echo -e "${GREEN}✅${NC}"
    return 0
  else
    echo -e "${RED}❌${NC}"
    return 1
  fi
}

test_api_bnb() {
  local url="${BNB_RPC_ENDPOINT:-https://rpc.ankr.com/bsc}"
  echo -n "  🔗 BNB RPC... "
  if curl -s -m 5 -X POST -H "Content-Type: application/json" -H "Accept: application/json" -H "User-Agent: Puzzle-Solver/1.0" \
    -d '{"jsonrpc":"2.0","method":"eth_chainId","params":[],"id":1}' "$url" > /dev/null 2>&1; then
    echo -e "${GREEN}✅${NC}"
    return 0
  else
    echo -e "${RED}❌${NC}"
    return 1
  fi
}

test_api_solana() {
  local url="${SOL_RPC_ENDPOINT:-https://api.mainnet-beta.solana.com}"
  echo -n "  🔗 Solana RPC... "
  if curl -s -m 5 -X POST -H "Content-Type: application/json" -H "Accept: application/json" -H "User-Agent: Puzzle-Solver/1.0" \
    -d '{"jsonrpc":"2.0","method":"getHealth","params":[],"id":1}' "$url" > /dev/null 2>&1; then
    echo -e "${GREEN}✅${NC}"
    return 0
  else
    echo -e "${RED}❌${NC}"
    return 1
  fi
}

# Função wrapper para executar processo com tratamento de erro e rate limit
run_puzzle_safe() {
  local network=$1
  local puzzle_id=$2
  local solver_script=$3
  local start_time=$(date +%s)
  
  # Executar o solver
  PUZZLE_ID=$puzzle_id node "$solver_script" 2>&1 | tee "/tmp/${network}_p${puzzle_id}.log"
  local exit_code=$?
  
  local end_time=$(date +%s)
  local duration=$((end_time - start_time))
  
  # Verificar o tipo de erro
  if [ $exit_code -eq 0 ]; then
    echo -e "${GREEN}✅ [${network}] Puzzle #${puzzle_id}: Concluído (${duration}s)${NC}"
  else
    # Verificar se é rate limit
    if grep -q "rate limit\|429\|API limit\|account limit\|Rate limit" "/tmp/${network}_p${puzzle_id}.log" 2>/dev/null; then
      echo -e "${YELLOW}⏱️  [${network}] Puzzle #${puzzle_id}: Rate limit atingido - pausando rede${NC}"
      return 2  # Código especial para rate limit
    else
      echo -e "${RED}❌ [${network}] Puzzle #${puzzle_id}: Erro (exit code: $exit_code) - continuando${NC}"
      return 1  # Erro normal
    fi
  fi
  
  return $exit_code
}

# Verificar internet ao iniciar
echo "🌐 Verificando conexão internet..."
check_internet

# Carregar variáveis do .env
if [ -f ".env" ]; then
  source .env
  echo "✅ Configurações carregadas de .env"
fi

# SEARCH_MODE forçado como sequential
export SEARCH_MODE="sequential"

# Aumentar delays para evitar rate limiting (429 / Max calls per second) ao rodar tudo em paralelo
export ETH_DELAY_MS=2500
export BNB_DELAY_MS=2500
export POLYGON_DELAY_MS=2500
export SOL_DELAY_MS=1500
export BTC_DELAY_MS=4000
export BTC_P2PKH_DELAY_MS=4000
export BTC_P2WPKH_DELAY_MS=4000
echo "⏱️  Delays ajustados para execução paralela segura (EVM: 2.5s, Solana: 1.5s, Bitcoin: 4s)"

echo ""
echo "╔════════════════════════════════════════════════════════════╗"
echo "║  🚀 MASTER - 5 NETWORKS / PUZZLE 71                       ║"
echo "║  Bitcoin + Ethereum + Solana + Polygon + BNB              ║"
echo "║  Mode: SEARCH_MODE=sequential                             ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""

# ============ TESTE DE API INICIAL ============
echo -e "${BLUE}🧪 TESTE DE CONECTIVIDADE DAS REDES${NC}"
echo ""

BTC_OK=0
ETH_OK=0
POLY_OK=0
BNB_OK=0
SOL_OK=0

test_api_bitcoin && BTC_OK=1 || { echo -e "${RED}⚠️  Bitcoin vai ser pulado${NC}"; BTC_OK=0; }
test_api_ethereum && ETH_OK=1 || { echo -e "${RED}⚠️  Ethereum vai ser pulado${NC}"; ETH_OK=0; }
test_api_polygon && POLY_OK=1 || { echo -e "${RED}⚠️  Polygon vai ser pulado${NC}"; POLY_OK=0; }
test_api_bnb && BNB_OK=1 || { echo -e "${RED}⚠️  BNB vai ser pulado${NC}"; BNB_OK=0; }
test_api_solana && SOL_OK=1 || { echo -e "${RED}⚠️  Solana vai ser pulado${NC}"; SOL_OK=0; }

echo ""

# Contadores
TOTAL_REDES_OK=$((BTC_OK + ETH_OK + POLY_OK + BNB_OK + SOL_OK))
if [ $TOTAL_REDES_OK -eq 0 ]; then
  echo -e "${RED}❌ NENHUMA REDE DISPONÍVEL! Abortando...${NC}"
  exit 1
fi

echo -e "${GREEN}✅ $TOTAL_REDES_OK de 5 redes disponíveis (Bitcoin alternará P2PKH ↔ P2WPKH por lote) - iniciando processo${NC}"
echo ""

# ============ BITCOIN ============
if [ $BTC_OK -eq 1 ]; then
  echo "▶️  [1/5] Bitcoin P71 (Alternado: P2PKH ↔ P2WPKH)..."
  (run_puzzle_safe "BITCOIN" 71 "bitcoin_alternating_coordinator.js") &
  BTC_P71=$!
  pids+=($BTC_P71)
  record_pid "$BTC_P71"
else
  echo -e "${YELLOW}⏭️  Bitcoin pulado (API indisponível)${NC}"
  BTC_P71=""
fi

# ============ ETHEREUM ============
if [ $ETH_OK -eq 1 ]; then
  echo "▶️  [2/5] Ethereum P71..."
  sleep 3
  (run_puzzle_safe "ETHEREUM" 71 "ethereum/puzzle_solver_ethereum.js") &
  ETH_P71=$!
  pids+=($ETH_P71)
  record_pid "$ETH_P71"
else
  echo -e "${YELLOW}⏭️  Ethereum pulado (API indisponível)${NC}"
  ETH_P71=""
fi

# ============ SOLANA ============
if [ $SOL_OK -eq 1 ]; then
  echo "▶️  [3/5] Solana P71..."
  sleep 3
  (run_puzzle_safe "SOLANA" 71 "solana/puzzle_solver_solana.js") &
  SOL_P71=$!
  pids+=($SOL_P71)
  record_pid "$SOL_P71"
else
  echo -e "${YELLOW}⏭️  Solana pulado (API indisponível)${NC}"
  SOL_P71=""
fi

# ============ POLYGON ============
if [ $POLY_OK -eq 1 ]; then
  echo "▶️  [4/5] Polygon P71..."
  sleep 3
  (run_puzzle_safe "POLYGON" 71 "polygon/puzzle_solver_polygon.js") &
  POLY_P71=$!
  pids+=($POLY_P71)
  record_pid "$POLY_P71"
else
  echo -e "${YELLOW}⏭️  Polygon pulado (API indisponível)${NC}"
  POLY_P71=""
fi

# ============ BNB ============
if [ $BNB_OK -eq 1 ]; then
  echo "▶️  [5/5] BNB P71..."
  sleep 3
  (run_puzzle_safe "BNB" 71 "bnb/puzzle_solver_bnb.js") &
  BNB_P71=$!
  pids+=($BNB_P71)
  record_pid "$BNB_P71"
else
  echo -e "${YELLOW}⏭️  BNB pulado (API indisponível)${NC}"
  BNB_P71=""
fi

echo ""
echo "📊 Aguardando conclusão de todos os processos..."
echo ""

# Aguardar todos os processos (se estiverem rodando)
# Aguardar todos (sem falhar se algum processo tiver problema)
for pid in "${pids[@]}"; do
  wait $pid 2>/dev/null || true
done

trap - SIGINT SIGTERM SIGHUP
rm -f "$PIDFILE"

echo ""
echo "╔════════════════════════════════════════════════════════════╗"
echo "║  ✅ MASTER CONCLUÍDO - Todos os puzzles foram executados    ║"
echo "║  Redes OK: BTC_P2PKH=$BTC_OK, BTC_P2WPKH=$BTC_OK, Ethereum=$ETH_OK, Polygon=$POLY_OK, BNB=$BNB_OK, Solana=$SOL_OK ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""

# Cleanup de logs temporários
rm -f /tmp/{BITCOIN,BITCOIN_P2PKH,BITCOIN_P2WPKH,ETHEREUM,SOLANA,POLYGON,BNB}_p*.log 2>/dev/null || true
