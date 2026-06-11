#!/bin/bash
# Para o orquestrador Litecoin/Dogecoin e todos os solvers LTC/DOGE.

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck disable=SC1091
source "$ROOT/lib/stop_orchestrator.sh"

stop_orchestrator_group "ltc_doge" "Litecoin + Dogecoin"
