#!/bin/bash

# Balance Checker - Bitcoin + Ethereum (Node.js Solvers)
# ✅ Corrigido: Usa solvers JavaScript que suportam 100% dos formatos BIP
# 🔑 Suporta: Legacy (1...), Nested SegWit (3...), Native SegWit (bc1q...), Taproot (bc1p...)
# ❌ Remove: Dependência no Python obsoleto com blockchain.info

set -e

# Função para verificar conexão de internet
check_internet() {
  while ! curl -s -m 5 --connect-timeout 5 https://1.1.1.1 > /dev/null 2>&1; do
    echo "⚠️  Internet indisponível. Aguardando reconexão..."
    sleep 10
  done
  echo "✅ Internet OK"
}

# Iniciar verificação de internet
echo "🌐 Verificando conexão de internet..."
check_internet

# Carregar variáveis do .env
if [ -f ".env" ]; then
  source .env
  echo "✅ Configurações carregadas de .env"
fi

# Obter o diretório onde o script está localizado
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

echo ""
echo "🔍 Iniciando Varredura Consolidada de Saldos (Bitcoin + Ethereum)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Diretório de Relatórios: ${SCRIPT_DIR}/relatorio_final"
echo "Suporte de Formatos: BIP44 (1...) | BIP49 (3...) | BIP84 (bc1q...) | BIP86 Taproot (bc1p...)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

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

# ✅ CORRIGIDO: Executar solvers Node.js em paralelo
echo "▶️  Iniciando Bitcoin Solvers (P71, P72, P73)..."
(cd "${SCRIPT_DIR}" && PUZZLE_ID=71 node puzzle_solver.js) &
BTC_P71=$!
pids+=($BTC_P71)
sleep 7
(cd "${SCRIPT_DIR}" && PUZZLE_ID=72 node puzzle_solver.js) &
BTC_P72=$!
pids+=($BTC_P72)
sleep 7
(cd "${SCRIPT_DIR}" && PUZZLE_ID=73 node puzzle_solver.js) &
BTC_P73=$!
pids+=($BTC_P73)

echo "▶️  Iniciando Ethereum Solvers (P71, P72, P73)..."
(cd "${SCRIPT_DIR}" && PUZZLE_ID=71 node puzzle_solver_ethereum.js) &
ETH_P71=$!
pids+=($ETH_P71)
sleep 15
(cd "${SCRIPT_DIR}" && PUZZLE_ID=72 node puzzle_solver_ethereum.js) &
ETH_P72=$!
pids+=($ETH_P72)
sleep 15
(cd "${SCRIPT_DIR}" && PUZZLE_ID=73 node puzzle_solver_ethereum.js) &
ETH_P73=$!
pids+=($ETH_P73)

echo "⏳ Aguardando conclusão de todas as verificações..."
wait $BTC_P71 $BTC_P72 $BTC_P73 $ETH_P71 $ETH_P72 $ETH_P73 2>/dev/null || true

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ Processamento Concluído!"
echo "📊 Relatórios e logs gerados em ${SCRIPT_DIR}/relatorio_final/"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Verifica se encontrou algum saldo
if [ -f "${SCRIPT_DIR}/relatorio_final/saldos_encontrados.jsonl" ]; then
  FOUND_COUNT=$(wc -l < "${SCRIPT_DIR}/relatorio_final/saldos_encontrados.jsonl" 2>/dev/null || echo "0")
  if [ "$FOUND_COUNT" -gt 0 ]; then
    echo ""
    echo "🚨🚨🚨 ALERTA: $FOUND_COUNT SALDO(S) ENCONTRADO(S)! 🚨🚨🚨"
    echo "Verifique: ${SCRIPT_DIR}/relatorio_final/saldos_encontrados.jsonl"
    echo ""
  fi
fi
