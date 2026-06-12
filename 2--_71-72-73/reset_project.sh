#!/bin/bash
# Zera o progresso de execução (cache, logs, histórico, relatórios).
# Mantém código-fonte, .env, node_modules e .venv.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

NETWORKS=(
  bitcoin_P2PKH
  bitcoin_P2WPKH
  bitcoin_P2SH-P2WPKH
  bnb
  dogecoin_p2pkh
  dogecoin_p2sh
  ethereum
  litecoin_p2pkh
  litecoin_p2sh
  polygon
  solana
)

usage() {
  cat <<'EOF'
Uso: ./reset_project.sh [opções]

Zera o progresso dos solvers para recomeçar do zero:
  - Para orquestradores e puzzles em execução
  - Remove cache, logs, batch_history e backups
  - Limpa relatorio_final e reports
  - Remove __pycache__

Mantém: código, .env, node_modules e .venv.

Opções:
  -y, --yes     Não pedir confirmação
  -h, --help    Mostra esta ajuda
EOF
}

skip_confirm=no
for arg in "$@"; do
  case "$arg" in
    -y|--yes) skip_confirm=yes ;;
    -h|--help) usage; exit 0 ;;
    *)
      echo -e "${RED}Opção desconhecida: $arg${NC}" >&2
      usage >&2
      exit 1
      ;;
  esac
done

if [[ "$skip_confirm" != "yes" ]]; then
  echo -e "${YELLOW}⚠️  Isso apaga todo o progresso salvo (cache, logs e histórico).${NC}"
  read -r -p "Continuar? [s/N] " reply
  if [[ ! "$reply" =~ ^[sS]$ ]]; then
    echo "Cancelado."
    exit 0
  fi
fi

echo -e "${CYAN}🛑 Parando processos em execução...${NC}"
for script in \
  stop_orchestrator_bitcoin.sh \
  stop_orchestrator_evm.sh \
  stop_orchestrator_ltc_doge.sh \
  stop_puzzle71_all.sh \
  stop_puzzle72_all.sh \
  stop_puzzle73_all.sh
do
  if [[ -x "$ROOT/$script" ]]; then
    "$ROOT/$script" 2>/dev/null || true
  fi
done

rm -f /tmp/run_*_puzzle*.pids /tmp/orchestrator_*.pids /tmp/start_puzzle*_all.pids 2>/dev/null || true

count_files() {
  local pattern=$1
  local total=0
  local net

  for net in "${NETWORKS[@]}"; do
    local dir="$ROOT/$net"
    [[ -d "$dir" ]] || continue
    local n
    n=$(find "$dir" -type f -name "$pattern" 2>/dev/null | wc -l)
    total=$((total + n))
  done

  echo "$total"
}

before_cache=$(count_files 'puzzle_*.json')
before_logs=$(count_files 'puzzle_*.log')
before_history=$(count_files 'batch_history.jsonl')
before_reports=$(find "$ROOT/relatorio_final" -type f -name '*.jsonl' 2>/dev/null | wc -l)

echo -e "${CYAN}🧹 Limpando estado das redes...${NC}"
for net in "${NETWORKS[@]}"; do
  dir="$ROOT/$net"
  [[ -d "$dir" ]] || continue

  rm -f "$dir"/cache/puzzle_*.json "$dir"/cache/puzzle_*.json.bak* 2>/dev/null || true
  rm -f "$dir"/logs/puzzle_*.log 2>/dev/null || true
  rm -f "$dir"/PUZZLE_*/batch_history.jsonl "$dir"/PUZZLE_*/batch_history.jsonl.bak* 2>/dev/null || true
done

find "$ROOT" -path "$ROOT/node_modules" -prune -o -path "$ROOT/.venv" -prune -o -type d -name '__pycache__' -exec rm -rf {} + 2>/dev/null || true
find "$ROOT/relatorio_final" -type f -name '*.jsonl' -delete 2>/dev/null || true
find "$ROOT/reports" -type f -delete 2>/dev/null || true

after_cache=$(count_files 'puzzle_*.json')
after_logs=$(count_files 'puzzle_*.log')
after_history=$(count_files 'batch_history.jsonl')
after_reports=$(find "$ROOT/relatorio_final" -type f -name '*.jsonl' 2>/dev/null | wc -l)

removed_cache=$((before_cache - after_cache))
removed_logs=$((before_logs - after_logs))
removed_history=$((before_history - after_history))
removed_reports=$((before_reports - after_reports))

echo
echo -e "${GREEN}✅ Projeto zerado.${NC}"
echo -e "   Cache removido:        ${removed_cache}"
echo -e "   Logs removidos:        ${removed_logs}"
echo -e "   Histórico removido:    ${removed_history}"
echo -e "   Relatórios removidos:  ${removed_reports}"
echo
echo -e "${CYAN}Para recomeçar:${NC}"
echo "   ./orchestrator_bitcoin.sh"
echo "   ./orchestrator_ltc_doge.sh"
echo "   ./orchestrator_evm.sh"
echo "   # ou: ./start_puzzle71_all.sh"

if [[ "$after_cache" -gt 0 || "$after_logs" -gt 0 || "$after_history" -gt 0 ]]; then
  echo
  echo -e "${RED}⚠️  Ainda restam arquivos de estado. Verifique permissões ou processos ativos.${NC}" >&2
  exit 1
fi
