#!/bin/bash
# Orquestrador central #2 — Litecoin + Dogecoin (Puzzles 71, 72, 73)

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck disable=SC1091
source "$ROOT/lib/orchestrator_runner.sh"

orchestrator_main "ltc_doge" "LITECOIN + DOGECOIN" "Litecoin e Dogecoin em todos os puzzles" 10
