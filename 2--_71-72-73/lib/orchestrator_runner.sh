#!/bin/bash
# Motor compartilhado dos 3 orquestradores centrais.

orchestrator_main() {
  local group=$1
  local title=$2
  local subtitle=$3
  local puzzle_gap=${4:-8}

  set +e
  set -m

  local root
  root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
  # shellcheck disable=SC1091
  source "$root/lib/orchestrator_common.sh"

  declare -a pids=()
  local pidfile
  pidfile="$(orchestrator_pidfile "$group")"
  echo $$ > "$pidfile"

  cleanup() {
    echo -e "\n${YELLOW}⚠️  Parando orquestrador ${group}...${NC}"
    trap - SIGINT SIGTERM SIGHUP
    for pid in "${pids[@]}"; do
      if [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null; then
        kill_process_tree TERM "$pid"
      fi
    done
    sleep 2
    for pid in "${pids[@]}"; do
      kill_process_tree KILL "$pid"
    done
    wait 2>/dev/null || true
    rm -f "$pidfile"
    exit 130
  }
  trap cleanup SIGINT SIGTERM SIGHUP

  cd "$root" || exit 1

  echo "🌐 Verificando conexão internet..."
  check_internet
  load_env_and_search_mode "$root"
  apply_delays_for_group "$group"

  preflight_targets "$root" "$group" || true

  echo ""
  echo "╔════════════════════════════════════════════════════════════╗"
  printf "║  🎛️  ORQUESTRADOR CENTRAL: %-32s ║\n" "$title"
  printf "║  %-57s ║\n" "$subtitle"
  echo "║  Puzzles: 71 → 72 → 73 (intervalo ${puzzle_gap}s entre cada)       ║"
  echo "╚════════════════════════════════════════════════════════════╝"
  echo ""

  local puzzle
  local step=0
  for puzzle in 71 72 73; do
    step=$((step + 1))
    if [ "$step" -gt 1 ]; then
      echo "⏳ Aguardando ${puzzle_gap}s antes do Puzzle #${puzzle}..."
      sleep "$puzzle_gap"
    fi
    echo "▶️  [${step}/3] Iniciando grupo ${group} — Puzzle #${puzzle}..."
    ("$root/run_networks_group_puzzle.sh" "$group" "$puzzle") &
    local child=$!
    pids+=("$child")
    record_pid "$pidfile" "$child"
  done

  echo ""
  echo "📊 Orquestrador ${group} ativo — aguardando puzzles 71, 72 e 73..."
  echo ""

  for pid in "${pids[@]}"; do
    wait "$pid" 2>/dev/null || true
  done

  trap - SIGINT SIGTERM SIGHUP
  rm -f "$pidfile"

  echo ""
  echo "╔════════════════════════════════════════════════════════════╗"
  printf "║  ✅ ORQUESTRADOR %-40s ║\n" "${group^^} FINALIZADO"
  echo "╚════════════════════════════════════════════════════════════╝"
  echo ""
}
