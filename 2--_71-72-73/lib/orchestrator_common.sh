#!/bin/bash
# Funções compartilhadas pelos orquestradores e runners de rede.

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

orchestrator_project_root() {
  local src="${BASH_SOURCE[1]:-${BASH_SOURCE[0]}}"
  while [ -L "$src" ]; do
    local dir
    dir="$(cd -P "$(dirname "$src")" && pwd)"
    src="$(readlink "$src")"
    [[ $src != /* ]] && src="$dir/$src"
  done
  cd -P "$(dirname "$src")/.." && pwd
}

record_pid() {
  local pidfile=$1
  local pid=$2
  echo "$pid" >> "$pidfile"
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

check_internet() {
  while ! curl -s -m 5 --connect-timeout 5 https://1.1.1.1 > /dev/null 2>&1; do
    echo "⚠️  Internet indisponível. Aguardando reconexão..."
    sleep 10
  done
  echo "✅ Internet OK"
}

load_env_and_search_mode() {
  local root=$1
  if [ -f "$root/.env" ]; then
    # shellcheck disable=SC1091
    source "$root/.env"
    echo "✅ Configurações carregadas de .env"
  fi
  export SEARCH_MODE="sequential"
}

apply_delays_for_group() {
  local group=$1
  case "$group" in
    bitcoin)
      export BTC_DELAY_MS=4000
      export BTC_P2PKH_DELAY_MS=4000
      export BTC_P2WPKH_DELAY_MS=4000
      export BTC_P2SH_DELAY_MS=4000
      echo "⏱️  Delays Bitcoin: 4s entre chamadas RPC"
      ;;
    ltc_doge)
      export LTC_DELAY_MS=800
      export LTC_P2PKH_DELAY_MS=800
      export LTC_P2SH_DELAY_MS=800
      export DOGE_DELAY_MS=1200
      export DOGE_P2PKH_DELAY_MS=1200
      export DOGE_P2SH_DELAY_MS=1200
      echo "⏱️  Delays LTC: 0.8s (paralelo) | DOGE: 1.2s"
      ;;
    evm)
      export ETH_DELAY_MS=2500
      export BNB_DELAY_MS=2500
      export POLYGON_DELAY_MS=2500
      export SOL_DELAY_MS=1500
      echo "⏱️  Delays EVM: 2.5s | Solana: 1.5s"
      ;;
    all)
      export ETH_DELAY_MS=2500
      export BNB_DELAY_MS=2500
      export POLYGON_DELAY_MS=2500
      export SOL_DELAY_MS=1500
      export BTC_DELAY_MS=4000
      export BTC_P2PKH_DELAY_MS=4000
      export BTC_P2WPKH_DELAY_MS=4000
      export BTC_P2SH_DELAY_MS=4000
      export LTC_DELAY_MS=4000
      export LTC_P2PKH_DELAY_MS=4000
      export LTC_P2SH_DELAY_MS=4000
      export DOGE_DELAY_MS=4000
      export DOGE_P2PKH_DELAY_MS=4000
      export DOGE_P2SH_DELAY_MS=4000
      echo "⏱️  Delays paralelos: EVM 2.5s, Solana 1.5s, UTXO 4s"
      ;;
  esac
}

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
  fi
  echo -e "${RED}❌${NC}"
  return 1
}

test_api_litecoin() {
  local url="${LTC_BLOCKCHAIN_INFO_BASE_URL:-https://litecoinspace.org}"
  local probe_addr="LR3gVmNE5FSdxVr9p4JJXv9wxxPKzNGfez"
  local test_url=""

  if [[ "$url" == *"litecoinspace.org"* ]]; then
    local root="${url%/api}"
    root="${root%/}"
    test_url="${root}/api/address/${probe_addr}"
    echo -n "  🔗 Litecoin API (Litecoinspace)... "
  elif [[ "$url" == *"blockcypher.com"* ]]; then
    local root="${url%/}"
    test_url="${root}/${probe_addr}/balance"
    echo -n "  🔗 Litecoin API (Blockcypher)... "
  else
    test_url="${url}/balance?active=${probe_addr}"
    echo -n "  🔗 Litecoin API... "
  fi

  if curl -s -m 5 "${test_url}" > /dev/null 2>&1; then
    echo -e "${GREEN}✅${NC}"
    return 0
  fi
  echo -e "${RED}❌${NC}"
  return 1
}

test_api_dogecoin() {
  local url="${DOGE_BLOCKCHAIN_INFO_BASE_URL:-https://dogecoin.atomicwallet.io/api/v1/address}"
  local probe_addr="D6X5ogrzSKT3S4bhYHoWGuNATqBX9oCUYL"
  local test_url=""
  local label="Dogecoin API"

  if [[ "$url" == *"blockcypher.com"* ]]; then
    local root="${url%/}"
    test_url="${root}/${probe_addr}/balance"
    label="Blockcypher"
  elif [[ "$url" == *"atomicwallet.io"* ]]; then
    local root="${url%/}"
    test_url="${root}/${probe_addr}"
    label="AtomicWallet"
  elif [[ "$url" == *"chain.so"* ]]; then
    test_url="https://chain.so/api/v3/balance/DOGE/${probe_addr}"
    label="Chain.so"
  else
    test_url="${url%/}/${probe_addr}"
  fi

  echo -n "  🔗 Dogecoin API (${label})... "

  local body
  body=$(curl -s -m 8 -H "Accept: application/json" -H "User-Agent: Puzzle-Solver/1.0" "${test_url}")
  if [[ "$body" == *"balance"* || "$body" == *"final_balance"* ]] && [[ "$body" != *"Just a moment"* ]]; then
    echo -e "${GREEN}✅${NC}"
    return 0
  fi

  echo -n "fallback AtomicWallet... "
  body=$(curl -s -m 8 -H "Accept: application/json" "https://dogecoin.atomicwallet.io/api/v1/address/${probe_addr}")
  if [[ "$body" == *"balance"* ]]; then
    echo -e "${GREEN}✅${NC}"
    return 0
  fi

  echo -e "${RED}❌${NC}"
  return 1
}

test_api_ethereum() {
  local url="${ETH_RPC_ENDPOINT:-https://rpc.ankr.com/eth}"
  echo -n "  🔗 Ethereum RPC... "
  if curl -s -m 5 -X POST -H "Content-Type: application/json" -H "Accept: application/json" -H "User-Agent: Puzzle-Solver/1.0" \
    -d '{"jsonrpc":"2.0","method":"eth_chainId","params":[],"id":1}' "$url" > /dev/null 2>&1; then
    echo -e "${GREEN}✅${NC}"
    return 0
  fi
  echo -e "${RED}❌${NC}"
  return 1
}

test_api_polygon() {
  local url="${POLYGON_RPC_ENDPOINT:-https://rpc.ankr.com/polygon}"
  echo -n "  🔗 Polygon RPC... "
  if curl -s -m 5 -X POST -H "Content-Type: application/json" -H "Accept: application/json" -H "User-Agent: Puzzle-Solver/1.0" \
    -d '{"jsonrpc":"2.0","method":"eth_chainId","params":[],"id":1}' "$url" > /dev/null 2>&1; then
    echo -e "${GREEN}✅${NC}"
    return 0
  fi
  echo -e "${RED}❌${NC}"
  return 1
}

test_api_bnb() {
  local url="${BNB_RPC_ENDPOINT:-https://rpc.ankr.com/bsc}"
  echo -n "  🔗 BNB RPC... "
  if curl -s -m 5 -X POST -H "Content-Type: application/json" -H "Accept: application/json" -H "User-Agent: Puzzle-Solver/1.0" \
    -d '{"jsonrpc":"2.0","method":"eth_chainId","params":[],"id":1}' "$url" > /dev/null 2>&1; then
    echo -e "${GREEN}✅${NC}"
    return 0
  fi
  echo -e "${RED}❌${NC}"
  return 1
}

test_api_solana() {
  local url="${SOL_RPC_ENDPOINT:-https://api.mainnet-beta.solana.com}"
  echo -n "  🔗 Solana RPC... "
  if curl -s -m 5 -X POST -H "Content-Type: application/json" -H "Accept: application/json" -H "User-Agent: Puzzle-Solver/1.0" \
    -d '{"jsonrpc":"2.0","method":"getHealth","params":[],"id":1}' "$url" > /dev/null 2>&1; then
    echo -e "${GREEN}✅${NC}"
    return 0
  fi
  echo -e "${RED}❌${NC}"
  return 1
}

run_puzzle_safe() {
  local network=$1
  local puzzle_id=$2
  local solver_script=$3
  local root=$4
  local start_time
  start_time=$(date +%s)

  PUZZLE_ID=$puzzle_id node "$root/$solver_script" 2>&1 | tee "/tmp/${network}_p${puzzle_id}.log"
  local exit_code=$?
  local end_time
  end_time=$(date +%s)
  local duration=$((end_time - start_time))

  if [ $exit_code -eq 0 ]; then
    echo -e "${GREEN}✅ [${network}] Puzzle #${puzzle_id}: Concluído (${duration}s)${NC}"
  elif grep -q "rate limit\|429\|API limit\|account limit\|Rate limit" "/tmp/${network}_p${puzzle_id}.log" 2>/dev/null; then
    echo -e "${YELLOW}⏱️  [${network}] Puzzle #${puzzle_id}: Rate limit atingido - pausando rede${NC}"
    return 2
  else
    echo -e "${RED}❌ [${network}] Puzzle #${puzzle_id}: Erro (exit code: $exit_code) - continuando${NC}"
    return 1
  fi
  return $exit_code
}

group_solver_patterns() {
  local group=$1
  case "$group" in
    bitcoin)
      echo "bitcoin_alternating_coordinator.js"
      ;;
    ltc_doge)
      echo "litecoin_alternating_coordinator.js"
      echo "dogecoin_alternating_coordinator.js"
      ;;
    evm)
      echo "ethereum/puzzle_solver_ethereum.js"
      echo "solana/puzzle_solver_solana.js"
      echo "polygon/puzzle_solver_polygon.js"
      echo "bnb/puzzle_solver_bnb.js"
      ;;
    all)
      echo "bitcoin_alternating_coordinator.js"
      echo "litecoin_alternating_coordinator.js"
      echo "dogecoin_alternating_coordinator.js"
      echo "ethereum/puzzle_solver_ethereum.js"
      echo "solana/puzzle_solver_solana.js"
      echo "polygon/puzzle_solver_polygon.js"
      echo "bnb/puzzle_solver_bnb.js"
      ;;
  esac
}

stop_processes_by_patterns() {
  local sig=$1
  shift
  local pattern
  for pattern in "$@"; do
    pkill -"$sig" -f "$pattern" 2>/dev/null || true
  done
}

stop_from_pidfile() {
  local sig=$1
  local pidfile=$2
  [ -f "$pidfile" ] || return 0
  while read -r pid; do
    [ -n "$pid" ] && kill_process_tree "$sig" "$pid"
  done < "$pidfile"
}

group_pidfile() {
  local group=$1
  local puzzle_id=$2
  echo "/tmp/run_${group}_puzzle${puzzle_id}.pids"
}

orchestrator_pidfile() {
  local group=$1
  echo "/tmp/orchestrator_${group}.pids"
}
