#!/bin/bash
# Abre 3 terminais e inicia um puzzle em todos os grupos simultaneamente.

start_puzzle_all() {
  local puzzle_id=$1

  local root
  root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
  # shellcheck disable=SC1091
  source "$root/lib/open_terminal.sh"

  local pidfile="/tmp/start_puzzle${puzzle_id}_all.pids"
  echo $$ > "$pidfile"

  echo ""
  echo "╔════════════════════════════════════════════════════════════╗"
  echo "║  🚀 PUZZLE #${puzzle_id} — TODAS AS REDES (3 terminais)              ║"
  echo "║  Bitcoin | Litecoin+Dogecoin | EVM+Solana                 ║"
  echo "╚════════════════════════════════════════════════════════════╝"
  echo ""

  open_project_terminal "Bitcoin P${puzzle_id}" "./run_networks_group_puzzle.sh bitcoin ${puzzle_id}" "$root" || return 1
  sleep 3
  open_project_terminal "LTC+DOGE P${puzzle_id}" "./run_networks_group_puzzle.sh ltc_doge ${puzzle_id}" "$root" || return 1
  sleep 3
  open_project_terminal "EVM+Solana P${puzzle_id}" "./run_networks_group_puzzle.sh evm ${puzzle_id}" "$root" || return 1

  echo ""
  echo "✅ 3 terminais abertos para Puzzle #${puzzle_id}."
  echo "   Parar: ./stop_puzzle${puzzle_id}_all.sh"
  echo ""
}
