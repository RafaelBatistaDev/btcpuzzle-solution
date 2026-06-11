#!/bin/bash
# Para um orquestrador central e todos os processos do grupo.

stop_orchestrator_group() {
  local group=$1
  local label=$2

  local root
  root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
  # shellcheck disable=SC1091
  source "$root/lib/orchestrator_common.sh"

  RED='\033[0;31m'
  GREEN='\033[0;32m'
  YELLOW='\033[1;33m'
  NC='\033[0m'

  echo -e "${YELLOW}⏹️  Parando orquestrador ${label} e processos filhos...${NC}"

  local orch_pidfile
  orch_pidfile="$(orchestrator_pidfile "$group")"
  stop_from_pidfile TERM "$orch_pidfile"

  local puzzle
  for puzzle in 71 72 73; do
    stop_from_pidfile TERM "$(group_pidfile "$group" "$puzzle")"
  done

  for pid in $(pgrep -f "orchestrator_${group}.sh" 2>/dev/null); do
    kill_process_tree TERM "$pid"
  done
  for pid in $(pgrep -f "run_networks_group_puzzle.sh ${group}" 2>/dev/null); do
    kill_process_tree TERM "$pid"
  done

  local patterns
  patterns=$(group_solver_patterns "$group")
  while read -r pattern; do
    [ -n "$pattern" ] && pkill -TERM -f "$pattern" 2>/dev/null || true
  done <<< "$patterns"

  sleep 2

  stop_from_pidfile KILL "$orch_pidfile"
  for puzzle in 71 72 73; do
    local pf
    pf="$(group_pidfile "$group" "$puzzle")"
    stop_from_pidfile KILL "$pf"
    rm -f "$pf"
  done
  rm -f "$orch_pidfile"

  for pid in $(pgrep -f "orchestrator_${group}.sh" 2>/dev/null); do
    kill_process_tree KILL "$pid"
  done
  for pid in $(pgrep -f "run_networks_group_puzzle.sh ${group}" 2>/dev/null); do
    kill_process_tree KILL "$pid"
  done

  while read -r pattern; do
    [ -n "$pattern" ] && pkill -KILL -f "$pattern" 2>/dev/null || true
  done <<< "$patterns"

  local remaining
  remaining=$(pgrep -fc "orchestrator_${group}.sh|run_networks_group_puzzle.sh ${group}" 2>/dev/null || echo 0)
  if [ "$remaining" -eq 0 ]; then
    echo -e "${GREEN}✅ Orquestrador ${label} encerrado.${NC}"
  else
    echo -e "${RED}⚠️  Ainda há $remaining processo(s) do grupo ${group}.${NC}"
    exit 1
  fi
}
