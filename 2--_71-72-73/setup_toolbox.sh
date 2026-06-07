#!/bin/bash

# Setup Puzzle Solver - Bitcoin + Ethereum
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

echo "🔧 Setup Node.js + Dependencies"

# Load fnm if available
[ -d "$HOME/.local/share/fnm" ] && export PATH="$HOME/.local/share/fnm:$PATH" && eval "$(fnm env --shell bash)"

# Check Node.js
if ! command -v node &>/dev/null; then
  echo "⚠️  Node.js not found. Please install Node.js 18+ first"
  exit 1
fi

echo "✅ Node.js $(node --version) | npm $(npm --version)"

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Install Solana dependencies
echo "📦 Installing Solana dependencies..."
npm install tweetnacl bs58 js-sha256 --save

echo ""
echo "🎉 Setup Complete!"
echo ""
echo "Usage:"
echo "  PUZZLE_ID=71 node bitcoin/config/solver.js"
echo "  PUZZLE_ID=72 node ethereum/config/solver.js"
echo "  ./run_dual_mode.sh"
