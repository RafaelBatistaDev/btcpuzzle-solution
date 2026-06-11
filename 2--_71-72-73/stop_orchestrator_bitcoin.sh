#!/bin/bash
# Para o orquestrador Bitcoin e todos os solvers BTC.

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck disable=SC1091
source "$ROOT/lib/stop_orchestrator.sh"

stop_orchestrator_group "bitcoin" "Bitcoin"
