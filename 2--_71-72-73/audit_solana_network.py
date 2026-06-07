#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
Auditoria de Rede Solana - Foco em Solana JSON-RPC & Helius Endpoint
Valida conexão, limites de taxa, latência e saldos dos puzzles.
"""

import os
import sys
import time
import json
from pathlib import Path
import requests

# Cores para terminal
GREEN = "\033[92m"
YELLOW = "\033[93m"
RED = "\033[91m"
BLUE = "\033[94m"
CYAN = "\033[96m"
RESET = "\033[0m"
BOLD = "\033[1m"

def log_section(title):
    print(f"\n{BOLD}{BLUE}═" * 70)
    print(f"📡 {title.upper()}")
    print("═" * 70 + f"{RESET}")

def log_success(msg):
    print(f"  {GREEN}✔ {msg}{RESET}")

def log_warn(msg):
    print(f"  {YELLOW}⚠️  {msg}{RESET}")

def log_error(msg):
    print(f"  {RED}✘ {msg}{RESET}")

def load_env():
    env_path = Path(__file__).parent / ".env"
    env = {}
    if env_path.exists():
        with open(env_path, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith("#"):
                    continue
                if "=" in line:
                    key, val = line.split("=", 1)
                    val = val.strip().strip('"').strip("'")
                    env[key.strip()] = val
    return env

def main():
    print(f"\n{BOLD}{CYAN}╔════════════════════════════════════════════════════════════╗")
    print(f"║          AUDITORIA DE REDE SOLANA - RPC & HELIUS           ║")
    print(f"╚════════════════════════════════════════════════════════════╝{RESET}")

    # 1. Carregar configurações
    log_section("1. Carregando Configurações do arquivo .env")
    env = load_env()
    
    sol_rpc = env.get("SOL_RPC_ENDPOINT", "https://api.mainnet-beta.solana.com")
    sol_delay_ms = int(env.get("SOL_DELAY_MS", "110"))
    sol_timeout_ms = int(env.get("SOL_TIMEOUT_MS", "3000"))
    
    target_71 = env.get("SOL_TARGET_71", "4ZJhPQAgUseCsWhKvJLTmmRRUV74fdoTpQLNfKoekbPY")
    target_72 = env.get("SOL_TARGET_72", "9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM")
    target_73 = env.get("SOL_TARGET_73", "7mhcgF1DVsj5iv4CxZDgp51H6MBBwqamsH1KnqXhSRc5")
    
    # Mascarar chave Helius no log para segurança
    masked_rpc = sol_rpc
    if "api-key=" in sol_rpc:
        parts = sol_rpc.split("api-key=")
        if len(parts) > 1:
            key = parts[1]
            masked_key = key[:6] + "..." if len(key) > 6 else "..."
            masked_rpc = parts[0] + "api-key=" + masked_key
            
    print(f"  Solana RPC Endpoint: {BOLD}{masked_rpc}{RESET}")
    print(f"  Delay configurado: {BOLD}{sol_delay_ms} ms{RESET}")
    print(f"  Timeout configurado: {BOLD}{sol_timeout_ms} ms{RESET}")
    print(f"  Alvos (Targets):")
    print(f"    - Puzzle 71: {target_71}")
    print(f"    - Puzzle 72: {target_72}")
    print(f"    - Puzzle 73: {target_73}")
    log_success("Configurações importadas com sucesso!")

    # 2. Conectividade básica com o RPC da Solana (getEpochInfo)
    log_section("2. Teste de Conectividade com Solana RPC Node")
    
    rpc_ok = False
    latency_rpc = 0.0
    epoch_info = {}
    
    try:
        t_start = time.time()
        payload = {
            "jsonrpc": "2.0",
            "id": 1,
            "method": "getEpochInfo"
        }
        
        headers = {"Content-Type": "application/json"}
        resp = requests.post(sol_rpc, json=payload, headers=headers, timeout=sol_timeout_ms/1000.0)
        latency_rpc = (time.time() - t_start) * 1000
        
        if resp.status_code == 200:
            data = resp.json()
            if "result" in data:
                epoch_info = data["result"]
                log_success("Conectado com sucesso ao Solana RPC Node!")
                print(f"  Latência RPC: {BOLD}{latency_rpc:.2f} ms{RESET}")
                print(f"  Slot Atual: {BOLD}{epoch_info.get('absoluteSlot')}{RESET}")
                print(f"  Época Atual: {BOLD}{epoch_info.get('epoch')}{RESET}")
                print(f"  Progresso da Época: {BOLD}{epoch_info.get('slotIndex')} / {epoch_info.get('slotsInEpoch')}{RESET}")
                rpc_ok = True
            else:
                log_warn(f"RPC respondeu com formato inesperado: {data}")
        elif resp.status_code == 429:
            log_error("RPC retornou código 429 - Limite de taxa (Rate Limit) excedido!")
        else:
            log_error(f"RPC respondeu com status código HTTP: {resp.status_code}")
            
    except Exception as e:
        log_error(f"Falha de conexão com Solana RPC: {e}")

    # 3. Teste de Consulta de Saldo Nativo (getBalance) em carteira ativa
    log_section("3. Auditoria de Funções de Saldo (getBalance)")
    
    rpc_balance_ok = False
    # Wallet ativa de teste (Binance Hot Wallet no Solana)
    binance_wallet = "9W52yWEd2ZssJuBt14577vmzPLaxBuu5AwyCHXM7dH3g"
    
    if rpc_ok:
        try:
            # Respeitar rate limits
            time.sleep(sol_delay_ms / 1000.0)
            
            payload = {
                "jsonrpc": "2.0",
                "id": 1,
                "method": "getBalance",
                "params": [binance_wallet]
            }
            
            resp = requests.post(sol_rpc, json=payload, headers={"Content-Type": "application/json"}, timeout=sol_timeout_ms/1000.0)
            data = resp.json()
            
            if resp.status_code == 200 and "result" in data:
                result = data["result"]
                # O valor retornado é em lamports (1 SOL = 1e9 lamports)
                balance_lamports = int(result.get("value", 0))
                balance_sol = balance_lamports / 1e9
                log_success("getBalance: Sucesso!")
                print(f"  Carteira Teste (Binance Hot Wallet): {binance_wallet}")
                print(f"  Saldo Encontrado: {BOLD}{balance_sol:.4f} SOL{RESET} ({balance_lamports} Lamports)")
                rpc_balance_ok = True
            else:
                log_error(f"getBalance falhou: {data.get('error', 'Erro desconhecido')}")
        except Exception as e:
            log_error(f"Erro ao testar getBalance: {e}")
    else:
        log_warn("Pulando auditoria de saldo porque a conexão com o RPC falhou.")

    # 4. Auditoria de Saldos dos Targets (Puzzles)
    log_section("4. Verificação de Saldo dos Endereços dos Puzzles (getBalance)")
    
    if rpc_balance_ok:
        target_addresses = [target_71, target_72, target_73]
        
        for i, addr in enumerate(target_addresses):
            try:
                # Respeitar rate limits entre as requisições
                time.sleep(sol_delay_ms / 1000.0)
                
                payload = {
                    "jsonrpc": "2.0",
                    "id": i + 1,
                    "method": "getBalance",
                    "params": [addr]
                }
                
                resp = requests.post(sol_rpc, json=payload, headers={"Content-Type": "application/json"}, timeout=sol_timeout_ms/1000.0)
                data = resp.json()
                
                if resp.status_code == 200 and "result" in data:
                    result = data["result"]
                    balance_lamports = int(result.get("value", 0))
                    balance_sol = balance_lamports / 1e9
                    status_color = GREEN if balance_sol > 0 else RESET
                    print(f"  Puzzle {71+i} ({addr[:10]}...): {BOLD}{status_color}{balance_sol:.9f} SOL{RESET} ({balance_lamports} Lamports)")
                else:
                    log_error(f"Falha ao consultar saldo do Puzzle {71+i}: {data.get('error', 'Erro no RPC')}")
            except Exception as e:
                log_error(f"Erro ao verificar saldo do Puzzle {71+i}: {e}")
    else:
        log_warn("Pulando verificação de puzzles porque a API do RPC não passou na validação de saldo.")

    # Resumo Final da Auditoria
    print(f"\n{BOLD}{CYAN}╔════════════════════════════════════════════════════════════╗")
    print(f"║                   RESUMO DA AUDITORIA                      ║")
    print(f"╚════════════════════════════════════════════════════════════╝{RESET}")
    print(f"  • Latência do RPC Node: " + (f"{BOLD}{latency_rpc:.2f} ms{RESET}" if rpc_ok else f"{RED}FALHA{RESET}"))
    print(f"  • Métodos JSON-RPC (getEpochInfo): {GREEN}OPERACIONAL{RESET}" if rpc_ok else f"  • Métodos JSON-RPC (getEpochInfo): {RED}FALHA{RESET}")
    print(f"  • Saldo e Leitura (getBalance): {GREEN}OPERACIONAL{RESET}" if rpc_balance_ok else f"  • Saldo e Leitura (getBalance): {RED}FALHA{RESET}")
    print(f"\n{BOLD}{GREEN}✓ Auditoria de Rede Solana concluída com sucesso!{RESET}\n")

if __name__ == "__main__":
    main()
