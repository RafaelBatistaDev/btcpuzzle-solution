#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
Auditoria de Rede BNB Chain - Foco em dRPC JSON-RPC Batch de Alta Performance
Valida conexão, latência e saldos dos puzzles de forma agrupada com cabeçalhos anti-bloqueio.
"""

import os
import sys
import time
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
    border = "═" * 70
    print(f"\n{BOLD}{BLUE}{border}")
    print(f"📡 {title.upper()}")
    print(f"{border}{RESET}")

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
    print(f"║          AUDITORIA DE REDE BNB CHAIN - dRPC BATCH NATIVO   ║")
    print(f"╚════════════════════════════════════════════════════════════╝{RESET}")

    # 1. Carregar configurações
    log_section("1. Carregando Configurações do arquivo .env")
    env = load_env()
    
    bnb_rpc = env.get("BNB_RPC_ENDPOINT", "https://bsc-dataseed.binance.org")
    bnb_batch_size = int(env.get("BNB_BATCH_SIZE", "20"))
    bnb_delay_ms = int(env.get("BNB_DELAY_MS", "50"))
    bnb_timeout_ms = int(env.get("BNB_TIMEOUT_MS", "10000"))
    bnb_initial_delay = int(env.get("BNB_INITIAL_DELAY_MS", "100"))
    
    target_71 = env.get("BNB_TARGET_71", "0x00000000219ab540356cBB839Cbe05303d7705Fa")
    target_72 = env.get("BNB_TARGET_72", "0xBE0eB53F46cd790Cd13851d5EFf43D12404d33E8")
    target_73 = env.get("BNB_TARGET_73", "0x40B38765696e3d5d8d9d834D8AaD4bB6e418E489")
    
    # Mascarar credencial dkey do dRPC para exibição limpa
    masked_rpc = bnb_rpc
    if "bsc/" in bnb_rpc:
        parts = bnb_rpc.split("bsc/")
        if len(parts) > 1:
            masked_rpc = f"{parts[0]}bsc/{parts[1][:6]}..."

    print(f"  BNB dRPC Endpoint: {BOLD}{masked_rpc}{RESET}")
    print(f"  Batch Size Configurado: {BOLD}{bnb_batch_size}{RESET}")
    print(f"  Alvos Mapeados (Targets 71-73)")
    log_success("Configurações importadas com sucesso!")

    if bnb_initial_delay > 0:
        time.sleep(bnb_initial_delay / 1000.0)

    # Cabeçalhos padrão de produção para evitar bloqueio de agentes automatizados (WAF)
    headers = {
        "Content-Type": "application/json",
        "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    }

    # 2. Conectividade básica (eth_blockNumber)
    log_section("2. Teste de Conectividade com dRPC BNB Chain")
    
    rpc_ok = False
    latency_rpc = 0.0
    
    try:
        t_start = time.time()
        payload = {"jsonrpc": "2.0", "id": 1, "method": "eth_blockNumber", "params": []}
        resp = requests.post(bnb_rpc, json=payload, headers=headers, timeout=bnb_timeout_ms/1000.0)
        latency_rpc = (time.time() - t_start) * 1000
        
        if resp.status_code == 200:
            json_data = resp.json()
            if "result" in json_data:
                block_num = int(json_data["result"], 16)
                log_success("Conectado com sucesso ao Nó dRPC BNB!")
                print(f"  Altura do Bloco: {BOLD}{block_num}{RESET}")
                print(f"  Latência RPC: {BOLD}{latency_rpc:.2f} ms{RESET}")
                rpc_ok = True
            else:
                log_error(f"Resposta inválida do RPC: {json_data}")
        else:
            log_error(f"Erro HTTP {resp.status_code} ao tentar conectar ao nó dRPC.")
    except Exception as e:
        log_error(f"Falha de conexão com a rede BNB: {e}")

    # 3. Verificação em Lote (Batch) dos Puzzles
    log_section("3. Verificação de Saldo dos Puzzles via JSON-RPC Batch")
    
    if rpc_ok:
        try:
            target_addresses = [target_71, target_72, target_73]
            payloads = []
            
            for idx, addr in enumerate(target_addresses):
                payloads.append({
                    "jsonrpc": "2.0",
                    "id": idx + 1,
                    "method": "eth_getBalance",
                    "params": [addr.lower(), "latest"]
                })
            
            if bnb_delay_ms > 0:
                time.sleep(bnb_delay_ms / 1000.0)
                
            resp = requests.post(bnb_rpc, json=payloads, headers=headers, timeout=bnb_timeout_ms/1000.0)
            
            if resp.status_code == 200:
                data = resp.json()
                if isinstance(data, list):
                    data_sorted = sorted(data, key=lambda x: x.get("id", 0))
                    for i, item in enumerate(data_sorted):
                        addr = target_addresses[i]
                        if "result" in item:
                            balance_wei = int(item["result"], 16)
                            balance_bnb = balance_wei / 1e18
                            status_color = GREEN if balance_bnb > 0 else RESET
                            print(f"  Puzzle {71+i} ({addr[:10]}...): {BOLD}{status_color}{balance_bnb:.8f} BNB{RESET}")
                        else:
                            log_error(f"Erro no lote para o Puzzle {71+i}: {item.get('error')}")
                else:
                    log_warn("Retorno do dRPC não veio em formato de lote (lista).")
            else:
                log_error(f"Erro HTTP {resp.status_code} na requisição de lote.")
        except Exception as e:
            log_error(f"Erro durante a execução do lote BNB: {e}")
    else:
        log_warn("Varredura de saldos ignorada porque o teste de conectividade falhou.")
            
    # Resumo Final
    print(f"\n{BOLD}{CYAN}╔════════════════════════════════════════════════════════════╗")
    print(f"║                   RESUMO DA AUDITORIA                      ║")
    print(f"╚════════════════════════════════════════════════════════════╝{RESET}")
    print(f"  • Latência BNB dRPC Node: {BOLD}{latency_rpc:.2f} ms{RESET}" if rpc_ok else f"  • Latência BNB dRPC Node: {RED}FALHA{RESET}")
    print(f"\n{BOLD}{GREEN}✓ Auditoria de Rede BNB concluída!{RESET}\n")

if __name__ == "__main__":
    main()