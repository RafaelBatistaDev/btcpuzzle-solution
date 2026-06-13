#!/bin/bash
# Executa um puzzle em um grupo de redes (bitcoin | ltc_doge | evm).

set +e
set -m

GROUP="${1:-}"
PUZZLE_ID="${2:-}"

if [[ ! "$GROUP" =~ ^(bitcoin|ltc_doge|evm)$ ]] || [[ ! "$PUZZLE_ID" =~ ^(71|72|73)$ ]]; then
  echo "Uso: $0 <bitcoin|ltc_doge|evm> <71|72|73>"
  exit 1
fi

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck disable=SC1091
source "$ROOT/lib/orchestrator_common.sh"

declare -a pids=()
PIDFILE="$(group_pidfile "$GROUP" "$PUZZLE_ID")"
echo $$ > "$PIDFILE"

cleanup() {
  echo -e "\n${YELLOW}⚠️  Interrupção detectada! Terminando processos do grupo ${GROUP} puzzle ${PUZZLE_ID}...${NC}"
  trap - SIGINT SIGTERM SIGHUP

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

cd "$ROOT" || exit 1

echo "🌐 Verificando conexão internet..."
check_internet
load_env_and_search_mode "$ROOT"
apply_delays_for_group "$GROUP"

case "$GROUP" in
  bitcoin)
    TITLE="BITCOIN"
    SUBTITLE="Bitcoin (P2PKH ↔ P2WPKH ↔ P2SH-P2WPKH)"
    ;;
  ltc_doge)
    TITLE="LITECOIN + DOGECOIN"
    SUBTITLE="Litecoin + Dogecoin (P2PKH ↔ P2SH-P2WPKH)"
    ;;
  evm)
    TITLE="EVM + SOLANA"
    SUBTITLE="Ethereum + Solana + Polygon + BNB"
    ;;
esac

echo ""
echo "╔════════════════════════════════════════════════════════════╗"
printf "║  🚀 %-55s ║\n" "$TITLE / PUZZLE $PUZZLE_ID"
printf "║  %-57s ║\n" "$SUBTITLE"
echo "║  Mode: SEARCH_MODE=sequential                             ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""

echo -e "${BLUE}🧪 TESTE DE CONECTIVIDADE${NC}"
echo ""

BTC_OK=0 LTC_OK=0 DOGE_OK=0 ETH_OK=0 POLY_OK=0 BNB_OK=0 SOL_OK=0
NETWORK_GAP=3
PUZZLE_STEP=0
TOTAL_STEPS=0

case "$GROUP" in
  bitcoin) TOTAL_STEPS=1 ;;
  ltc_doge) TOTAL_STEPS=2 ;;
  evm) TOTAL_STEPS=4 ;;
esac

if [ "${PREFLIGHT_DONE:-0}" = "1" ]; then
  echo -e "${GREEN}✅ Conectividade validada via preflight batch (puzzles 71+72+73)${NC}"
  case "$GROUP" in
    bitcoin) BTC_OK=1 ;;
    ltc_doge) LTC_OK=1; DOGE_OK=1 ;;
    evm) ETH_OK=1; SOL_OK=1; POLY_OK=1; BNB_OK=1 ;;
  esac
else
  if [ "$GROUP" = "bitcoin" ]; then
    test_api_bitcoin && BTC_OK=1 || { echo -e "${RED}⚠️  Bitcoin indisponível${NC}"; BTC_OK=0; }
  fi
  if [ "$GROUP" = "ltc_doge" ]; then
    test_api_litecoin && LTC_OK=1 || { echo -e "${RED}⚠️  Litecoin indisponível${NC}"; LTC_OK=0; }
    test_api_dogecoin && DOGE_OK=1 || { echo -e "${RED}⚠️  Dogecoin indisponível${NC}"; DOGE_OK=0; }
  fi
  if [ "$GROUP" = "evm" ]; then
    test_api_ethereum && ETH_OK=1 || { echo -e "${RED}⚠️  Ethereum indisponível${NC}"; ETH_OK=0; }
    test_api_solana && SOL_OK=1 || { echo -e "${RED}⚠️  Solana indisponível${NC}"; SOL_OK=0; }
    test_api_polygon && POLY_OK=1 || { echo -e "${RED}⚠️  Polygon indisponível${NC}"; POLY_OK=0; }
    test_api_bnb && BNB_OK=1 || { echo -e "${RED}⚠️  BNB indisponível${NC}"; BNB_OK=0; }
  fi
fi

echo ""
TOTAL_REDES_OK=$((BTC_OK + LTC_OK + DOGE_OK + ETH_OK + POLY_OK + BNB_OK + SOL_OK))
if [ "$TOTAL_REDES_OK" -eq 0 ]; then
  echo -e "${RED}❌ NENHUMA REDE DISPONÍVEL no grupo ${GROUP}! Abortando...${NC}"
  rm -f "$PIDFILE"
  exit 1
fi

echo -e "${GREEN}✅ $TOTAL_REDES_OK de $TOTAL_STEPS rede(s) disponíveis — iniciando${NC}"
echo ""

start_network() {
  local label=$1
  local network=$2
  local script=$3
  PUZZLE_STEP=$((PUZZLE_STEP + 1))
  echo "▶️  [${PUZZLE_STEP}/${TOTAL_STEPS}] ${label} P${PUZZLE_ID}..."
  if [ "$PUZZLE_STEP" -gt 1 ]; then
    sleep "$NETWORK_GAP"
  fi
  (run_puzzle_safe "$network" "$PUZZLE_ID" "$script" "$ROOT") &
  local child=$!
  pids+=("$child")
  record_pid "$PIDFILE" "$child"
}

if [ "$GROUP" = "bitcoin" ] && [ "$BTC_OK" -eq 1 ]; then
  start_network "Bitcoin" "BITCOIN" "bitcoin_alternating_coordinator.js"
elif [ "$GROUP" = "bitcoin" ]; then
  echo -e "${YELLOW}⏭️  Bitcoin pulado${NC}"
fi

if [ "$GROUP" = "ltc_doge" ]; then
  if [ "$LTC_OK" -eq 1 ]; then
    start_network "Litecoin" "LITECOIN" "litecoin_alternating_coordinator.js"
  else
    echo -e "${YELLOW}⏭️  Litecoin pulado${NC}"
  fi
  if [ "$DOGE_OK" -eq 1 ]; then
    start_network "Dogecoin" "DOGECOIN" "dogecoin_alternating_coordinator.js"
  else
    echo -e "${YELLOW}⏭️  Dogecoin pulado${NC}"
  fi
fi

if [ "$GROUP" = "evm" ]; then
  if [ "$ETH_OK" -eq 1 ]; then
    start_network "Ethereum" "ETHEREUM" "ethereum/puzzle_solver_ethereum.js"
  else
    echo -e "${YELLOW}⏭️  Ethereum pulado${NC}"
  fi
  if [ "$SOL_OK" -eq 1 ]; then
    start_network "Solana" "SOLANA" "solana/puzzle_solver_solana.js"
  else
    echo -e "${YELLOW}⏭️  Solana pulado${NC}"
  fi
  if [ "$POLY_OK" -eq 1 ]; then
    start_network "Polygon" "POLYGON" "polygon/puzzle_solver_polygon.js"
  else
    echo -e "${YELLOW}⏭️  Polygon pulado${NC}"
  fi
  if [ "$BNB_OK" -eq 1 ]; then
    start_network "BNB" "BNB" "bnb/puzzle_solver_bnb.js"
  else
    echo -e "${YELLOW}⏭️  BNB pulado${NC}"
  fi
fi

echo ""
echo "📊 Aguardando conclusão dos processos (${GROUP} P${PUZZLE_ID})..."
echo ""

for pid in "${pids[@]}"; do
  wait "$pid" 2>/dev/null || true
done

trap - SIGINT SIGTERM SIGHUP
rm -f "$PIDFILE"

echo ""
echo "╔════════════════════════════════════════════════════════════╗"
printf "║  ✅ GRUPO %-47s ║\n" "${GROUP} / PUZZLE ${PUZZLE_ID} CONCLUÍDO"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""
