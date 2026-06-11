#!/bin/bash
# Para o orquestrador EVM/Solana e todos os solvers ETH/POLY/BNB/SOL.

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck disable=SC1091
source "$ROOT/lib/stop_orchestrator.sh"

stop_orchestrator_group "evm" "EVM + Solana"
