#!/bin/bash

# Para o master puzzle73 e todos os processos filhos (node, tee, subshells)

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

PIDFILE="/tmp/run_all_networks_puzzle73.pids"

kill_tree() {
  local sig=$1
  local pid=$2
  local child

  [ -z "$pid" ] && return 0
  for child in $(pgrep -P "$pid" 2>/dev/null); do
    kill_tree "$sig" "$child"
  done
  kill -"$sig" -- -"$pid" 2>/dev/null || kill -"$sig" "$pid" 2>/dev/null || true
}

echo -e "${YELLOW}⏹️  Parando run_all_networks_puzzle73 e processos filhos...${NC}"

if [ -f "$PIDFILE" ]; then
  while read -r pid; do
    [ -n "$pid" ] && kill_tree TERM "$pid"
  done < "$PIDFILE"
fi

for pid in $(pgrep -f './run_all_networks_puzzle73.sh' 2>/dev/null); do
  kill_tree TERM "$pid"
done

for pattern in \
  "bitcoin_alternating_coordinator.js" \
  "ethereum/puzzle_solver_ethereum.js" \
  "solana/puzzle_solver_solana.js" \
  "polygon/puzzle_solver_polygon.js" \
  "bnb/puzzle_solver_bnb.js"
do
  pkill -TERM -f "$pattern" 2>/dev/null || true
done

sleep 2

if [ -f "$PIDFILE" ]; then
  while read -r pid; do
    [ -n "$pid" ] && kill_tree KILL "$pid"
  done < "$PIDFILE"
  rm -f "$PIDFILE"
fi

for pid in $(pgrep -f './run_all_networks_puzzle73.sh' 2>/dev/null); do
  kill_tree KILL "$pid"
done

for pattern in \
  "bitcoin_alternating_coordinator.js" \
  "ethereum/puzzle_solver_ethereum.js" \
  "solana/puzzle_solver_solana.js" \
  "polygon/puzzle_solver_polygon.js" \
  "bnb/puzzle_solver_bnb.js"
do
  pkill -KILL -f "$pattern" 2>/dev/null || true
done

remaining=$(pgrep -fc './run_all_networks_puzzle73.sh|puzzle_solver_|bitcoin_alternating_coordinator' 2>/dev/null || echo 0)
if [ "$remaining" -eq 0 ]; then
  echo -e "${GREEN}✅ Todos os processos puzzle73 foram encerrados.${NC}"
else
  echo -e "${RED}⚠️  Ainda há $remaining processo(s). Rode: pgrep -af puzzle73${NC}"
  exit 1
fi
