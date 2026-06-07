#!/bin/bash

# Bitcoin Puzzles - Parallel Execution
# Uso: SEARCH_MODE=sequential ./run_all_puzzles.sh
#      SEARCH_MODE=random ./run_all_puzzles.sh

set -e

# Função para verificar internet
check_internet() {
  while ! curl -s -m 5 --connect-timeout 5 https://1.1.1.1 > /dev/null 2>&1; do
    echo "⚠️  Internet indisponível. Aguardando reconexão..."
    sleep 10
  done
  echo "✅ Internet OK"
}

# Verificar internet ao iniciar
echo "🌐 Verificando conexão internet..."
check_internet

# Carregar variáveis do .env
if [ -f ".env" ]; then
  source .env
  echo "✅ Configurações carregadas de .env"
fi

export SEARCH_MODE="${SEARCH_MODE:-sequential}"
export BTC_PUBLIC_API_DELAY_MS=4000
echo "⏱️  Delay do Bitcoin ajustado para 4s para execução paralela segura"

echo "🔍 Bitcoin: P71 P72 P73 (${SEARCH_MODE})"

# Declarar array de PIDs para que a trap tenha acesso
declare -a pids

cleanup() {
  echo -e "\n⚠️  Interrupção detectada! Terminando todos os processos de forma limpa (SIGTERM)..."
  for pid in "${pids[@]}"; do
    if [ -n "$pid" ] && kill -0 $pid 2>/dev/null; then
      kill -TERM $pid 2>/dev/null
    fi
  done
  wait 2>/dev/null
  exit 1
}
trap cleanup SIGINT SIGTERM

(PUZZLE_ID=71 node puzzle_solver.js) &
PID71=$!
pids+=($PID71)

sleep 7

(PUZZLE_ID=72 node puzzle_solver.js) &
PID72=$!
pids+=($PID72)

sleep 7

(PUZZLE_ID=73 node puzzle_solver.js) &
PID73=$!
pids+=($PID73)

wait $PID71 $PID72 $PID73 2>/dev/null || true
