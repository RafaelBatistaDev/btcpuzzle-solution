#!/bin/bash
# Para um puzzle específico em todos os grupos de rede.

stop_puzzle_all() {
  local puzzle_id=$1

  local root
  root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
  # shellcheck disable=SC1091
  source "$root/lib/orchestrator_common.sh"

  RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

  echo -e "${YELLOW}⏹️  Parando Puzzle #${puzzle_id} em todas as redes...${NC}"

  local pidfile="/tmp/start_puzzle${puzzle_id}_all.pids"
  stop_from_pidfile TERM "$pidfile"

  for group in bitcoin ltc_doge evm; do
    stop_from_pidfile TERM "$(group_pidfile "$group" "$puzzle_id")"
  done

  for pid in $(pgrep -f "start_puzzle${puzzle_id}_all.sh" 2>/dev/null); do
    kill_process_tree TERM "$pid"
  done
  for group in bitcoin ltc_doge evm; do
    for pid in $(pgrep -f "run_networks_group_puzzle.sh ${group} ${puzzle_id}" 2>/dev/null); do
      kill_process_tree TERM "$pid"
    done
  done

  sleep 2

  stop_from_pidfile KILL "$pidfile"
  rm -f "$pidfile"
  for group in bitcoin ltc_doge evm; do
    local pf
    pf="$(group_pidfile "$group" "$puzzle_id")"
    stop_from_pidfile KILL "$pf"
    rm -f "$pf"
  done

  for group in bitcoin ltc_doge evm; do
    for pid in $(pgrep -f "run_networks_group_puzzle.sh ${group} ${puzzle_id}" 2>/dev/null); do
      kill_process_tree KILL "$pid"
    done
  done

  local remaining
  remaining=$(pgrep -fc "start_puzzle${puzzle_id}_all.sh|run_networks_group_puzzle.sh (bitcoin|ltc_doge|evm) ${puzzle_id}" 2>/dev/null || echo 0)
  if [ "$remaining" -eq 0 ]; then
    echo -e "${GREEN}✅ Puzzle #${puzzle_id} encerrado em todas as redes.${NC}"
  else
    echo -e "${RED}⚠️  Ainda há $remaining processo(s) do puzzle ${puzzle_id}.${NC}"
    exit 1
  fi
}
