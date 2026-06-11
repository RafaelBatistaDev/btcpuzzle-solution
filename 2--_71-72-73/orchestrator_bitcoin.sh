#!/bin/bash
# Orquestrador central #1 — Bitcoin (Puzzles 71, 72, 73)

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck disable=SC1091
source "$ROOT/lib/orchestrator_runner.sh"

orchestrator_main "bitcoin" "BITCOIN" "Apenas Bitcoin em todos os puzzles" 10
