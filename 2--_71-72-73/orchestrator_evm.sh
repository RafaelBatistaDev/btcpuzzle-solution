#!/bin/bash
# Orquestrador central #3 — Ethereum, Polygon, BNB, Solana (Puzzles 71, 72, 73)

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck disable=SC1091
source "$ROOT/lib/orchestrator_runner.sh"

orchestrator_main "evm" "EVM + SOLANA" "Ethereum, Polygon, BNB e Solana" 12
