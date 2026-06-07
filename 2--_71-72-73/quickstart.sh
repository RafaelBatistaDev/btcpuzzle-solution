#!/bin/bash

# 🎯 QUICK START - Menu Interativo de Comandos
# Todos os comandos disponíveis neste projeto

print_header() {
  echo ""
  echo "╔════════════════════════════════════════════════════════════╗"
  echo "║          🚀 QUICK START - Menu de Comandos               ║"
  echo "║  Bitcoin + Ethereum + Solana + Polygon + BNB             ║"
  echo "╚════════════════════════════════════════════════════════════╝"
  echo ""
}

print_menu() {
  echo "┌─ RODAR SOLVERS ─────────────────────────────────────────────┐"
  echo "│                                                             │"
  echo "│  [1]  Rodar TODOS os 5 networks em paralelo (MASTER)      │"
  echo "│       ./run_all_networks.sh                               │"
  echo "│                                                             │"
  echo "│  [2]  Rodar Bitcoin (P71, P72, P73)                       │"
  echo "│       ./run_all_puzzles.sh                                │"
  echo "│                                                             │"
  echo "│  [3]  Rodar Ethereum (P71, P72, P73)                      │"
  echo "│       ./run_all_puzzles_ethereum.sh                       │"
  echo "│                                                             │"
  echo "│  [4]  Rodar Solana (P71, P72, P73)                        │"
  echo "│       ./run_all_puzzles_solana.sh                         │"
  echo "│                                                             │"
  echo "│  [5]  Rodar Polygon (P71, P72, P73) ⭐                    │"
  echo "│       ./run_all_puzzles_polygon.sh                        │"
  echo "│                                                             │"
  echo "│  [6]  Rodar BNB (P71, P72, P73) ⭐                        │"
  echo "│       ./run_all_puzzles_bnb.sh                            │"
  echo "│                                                             │"
  echo "└─────────────────────────────────────────────────────────────┘"
  echo ""
  
  echo "┌─ VERIFICAR RESULTADOS ──────────────────────────────────────┐"
  echo "│                                                             │"
  echo "│  [7]  Verificar TODOS os 5 networks (MASTER)              │"
  echo "│       uv run check_all_networks.py                        │"
  echo "│                                                             │"
  echo "│  [8]  Verificar Bitcoin                                   │"
  echo "│       uv run check_bitcoin.py                             │"
  echo "│                                                             │"
  echo "│  [9]  Verificar Ethereum                                  │"
  echo "│       uv run check_ethereum.py                            │"
  echo "│                                                             │"
  echo "│  [10] Verificar Solana                                    │"
  echo "│       uv run check_solana.py                              │"
  echo "│                                                             │"
  echo "│  [11] Verificar Polygon ⭐                                │"
  echo "│       uv run check_polygon.py                             │"
  echo "│                                                             │"
  echo "│  [12] Verificar BNB ⭐                                    │"
  echo "│       uv run check_bnb.py                                 │"
  echo "│                                                             │"
  echo "└─────────────────────────────────────────────────────────────┘"
  echo ""
  
  echo "┌─ ANALISAR RESULTADOS ───────────────────────────────────────┐"
  echo "│                                                             │"
  echo "│  [13] Ver TODOS consolidados                              │"
  echo "│       cat relatorio_final/all_networks_consolidated.jsonl│"
  echo "│                                                             │"
  echo "│  [14] Contar total de endereços encontrados               │"
  echo "│       wc -l relatorio_final/all_networks_consolidated...  │"
  echo "│                                                             │"
  echo "│  [15] Filtrar por network específico (Bitcoin/Ethereum...)│"
  echo "│       grep '\"network\": \"NETWORK\"' relatorio_final/...  │"
  echo "│                                                             │"
  echo "└─────────────────────────────────────────────────────────────┘"
  echo ""
  
  echo "┌─ ATALHOS ÚTEIS ─────────────────────────────────────────────┐"
  echo "│                                                             │"
  echo "│  [20] Workflow completo (run + check)                     │"
  echo "│       ./run_all_networks.sh && uv run check_all_...       │"
  echo "│                                                             │"
  echo "│  [21] Ver lista de todos os scripts                       │"
  echo "│       ls -lh puzzle_solver_*.js run_all_*.sh check_*.py   │"
  echo "│                                                             │"
  echo "│  [22] Abrir QUICKSTART.md                                 │"
  echo "│       cat QUICKSTART.md                                   │"
  echo "│                                                             │"
  echo "│  [0]  Sair                                                │"
  echo "│                                                             │"
  echo "└─────────────────────────────────────────────────────────────┘"
  echo ""
}

run_command() {
  case $1 in
    1)
      echo "▶️  Rodando TODOS os networks..."
      ./run_all_networks.sh
      ;;
    2)
      echo "▶️  Rodando Bitcoin..."
      ./run_all_puzzles.sh
      ;;
    3)
      echo "▶️  Rodando Ethereum..."
      ./run_all_puzzles_ethereum.sh
      ;;
    4)
      echo "▶️  Rodando Solana..."
      ./run_all_puzzles_solana.sh
      ;;
    5)
      echo "▶️  Rodando Polygon..."
      ./run_all_puzzles_polygon.sh
      ;;
    6)
      echo "▶️  Rodando BNB..."
      ./run_all_puzzles_bnb.sh
      ;;
    7)
      echo "▶️  Verificando TODOS os networks..."
      uv run check_all_networks.py
      ;;
    8)
      echo "▶️  Verificando Bitcoin..."
      uv run check_bitcoin.py
      ;;
    9)
      echo "▶️  Verificando Ethereum..."
      uv run check_ethereum.py
      ;;
    10)
      echo "▶️  Verificando Solana..."
      uv run check_solana.py
      ;;
    11)
      echo "▶️  Verificando Polygon..."
      uv run check_polygon.py
      ;;
    12)
      echo "▶️  Verificando BNB..."
      uv run check_bnb.py
      ;;
    13)
      echo "▶️  Mostrando consolidado..."
      cat relatorio_final/all_networks_consolidated.jsonl
      ;;
    14)
      echo "▶️  Contando endereços..."
      wc -l relatorio_final/all_networks_consolidated.jsonl
      ;;
    15)
      echo "Qual network? (bitcoin/ethereum/solana/polygon/bnb):"
      read -r network
      grep "\"network\": \"$network\"" relatorio_final/all_networks_consolidated.jsonl
      ;;
    20)
      echo "▶️  Workflow completo..."
      echo "  1️⃣  Rodando solvers..."
      ./run_all_networks.sh
      echo ""
      echo "  2️⃣  Verificando resultados..."
      uv run check_all_networks.py
      echo ""
      echo "✅ Workflow concluído!"
      ;;
    21)
      echo "▶️  Scripts disponíveis:"
      ls -lh puzzle_solver_*.js run_all_*.sh check_*.py
      ;;
    22)
      cat QUICKSTART.md
      ;;
    0)
      echo "Até logo! 👋"
      exit 0
      ;;
    *)
      echo "❌ Opção inválida!"
      ;;
  esac
}

# Main
print_header
print_menu

read -p "Escolha uma opção (0-22): " choice
echo ""

run_command $choice
