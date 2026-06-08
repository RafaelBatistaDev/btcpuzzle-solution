#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
Auditoria de Rede Ethereum - Foco em Etherscan API V2 e Alchemy RPC Node
Valida conexão, latência, limites de taxa e saldos dos puzzles via RPC Batch.
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
    print(f"║          AUDITORIA DE REDE ETHEREUM - RPC BATCH & API      ║")
    print(f"╚════════════════════════════════════════════════════════════╝{RESET}")

    # 1. Carregar configurações
    log_section("1. Carregando Configurações do arquivo .env")
    env = load_env()
    
    etherscan_key = env.get("ETHERSCAN_KEY")
    eth_rpc = env.get("ETH_RPC_ENDPOINT", "https://ethereum-rpc.publicnode.com")
    
    target_71 = env.get("ETH_TARGET_71", "0x00000000219ab540356cBB839Cbe05303d7705Fa")
    target_72 = env.get("ETH_TARGET_72", "0xBE0eB53F46cd790Cd13851d5EFf43D12404d33E8")
    target_73 = env.get("ETH_TARGET_73", "0x40B38765696e3d5d8d9d834D8AaD4bB6e418E489")
    
    timeout_ms = int(env.get("ETH_TIMEOUT_MS", "10000"))
    timeout_sec = timeout_ms / 1000.0
    
    etherscan_url = "https://api.etherscan.io/v2/api"
    
    print(f"  API Url: {BOLD}{etherscan_url}{RESET}")
    print(f"  ETH RPC Endpoint: {BOLD}{eth_rpc[:50]}...{RESET}")
    if etherscan_key:
        print(f"  Etherscan Key: {BOLD}{etherscan_key[:6]}... (Tamanho: {len(etherscan_key)}){RESET}")
    
    print(f"  Alvos (Targets):")
    print(f"    - Puzzle 71: {target_71}")
    print(f"    - Puzzle 72: {target_72}")
    print(f"    - Puzzle 73: {target_73}")
    log_success("Configurações importadas com sucesso!")

    # 2. Conectividade básica (Etherscan & Alchemy RPC)
    log_section("2. Teste de Conectividade (API e Nó RPC)")
    
    etherscan_ok = False
    latency_etherscan = 0.0
    if etherscan_key and etherscan_key != "YourApiKeyToken":
        try:
            t_start = time.time()
            resp = requests.get(
                etherscan_url,
                params={"chainid": 1, "module": "block", "action": "getblocknobytime", "timestamp": int(time.time()), "closest": "before", "apikey": etherscan_key},
                timeout=timeout_sec
            )
            latency_etherscan = (time.time() - t_start) * 1000
            if resp.status_code == 200:
                log_success(f"Conectado com sucesso à API Etherscan V2!")
                print(f"  Latência Etherscan: {BOLD}{latency_etherscan:.2f} ms{RESET}")
                etherscan_ok = True
            else:
                log_warn(f"Etherscan respondeu com status código: {resp.status_code}")
        except Exception as e:
            log_error(f"Falha de conexão com a Etherscan API: {e}")
    else:
        log_warn("Chave Etherscan ausente ou inválida. Pulando teste de API.")

    rpc_ok = False
    latency_rpc = 0.0
    try:
        t_start = time.time()
        payload = {
            "jsonrpc": "2.0",
            "id": 1,
            "method": "eth_blockNumber",
            "params": []
        }
        resp = requests.post(eth_rpc, json=payload, headers={"Content-Type": "application/json"}, timeout=timeout_sec)
        latency_rpc = (time.time() - t_start) * 1000
        
        if resp.status_code == 200:
            data = resp.json()
            if "result" in data:
                block_num = int(data["result"], 16)
                log_success(f"Conectado com sucesso ao Nó Alchemy Ethereum RPC!")
                print(f"  Altura do Bloco RPC: {BOLD}{block_num}{RESET}")
                print(f"  Latência RPC: {BOLD}{latency_rpc:.2f} ms{RESET}")
                rpc_ok = True
            else:
                log_warn(f"RPC respondeu com formato inválido: {data}")
        else:
            log_warn(f"RPC respondeu com status código: {resp.status_code}")
    except Exception as e:
        log_error(f"Falha de conexão com Ethereum RPC: {e}")

    # 3. Auditoria Cruzada de Saldo (balancemulti vs RPC) em carteira ativa
    log_section("3. Auditoria de Funções de Saldo (Carteira de Teste)")
    vitalik_addr = "0xd8da6bf26964af9d7eed9e03e53415d37aa96045"
    
    if rpc_ok:
        try:
            payload = {
                "jsonrpc": "2.0",
                "id": 1,
                "method": "eth_getBalance",
                "params": [vitalik_addr, "latest"]
            }
            resp = requests.post(eth_rpc, json=payload, headers={"Content-Type": "application/json"}, timeout=timeout_sec)
            if resp.status_code == 200:
                balance_wei = int(resp.json()["result"], 16)
                balance_eth = balance_wei / 1e18
                log_success("RPC eth_getBalance: Sucesso!")
                print(f"  Carteira Teste (Vitalik): {vitalik_addr}")
                print(f"  Saldo Encontrado via RPC: {BOLD}{balance_eth:.4f} ETH{RESET}")
        except Exception as e:
            log_error(f"Erro ao testar saldo via RPC: {e}")
            
    if etherscan_ok:
        try:
            params = {"chainid": 1, "module": "account", "action": "balancemulti", "address": vitalik_addr, "tag": "latest", "apikey": etherscan_key}
            resp = requests.get(etherscan_url, params=params, timeout=timeout_sec)
            data = resp.json()
            if resp.status_code == 200 and data.get("status") == "1" and isinstance(data.get("result"), list):
                balance_eth = int(data["result"][0].get("balance", "0")) / 1e18
                log_success("Etherscan balancemulti: Sucesso!")
                print(f"  Saldo Encontrado via API: {BOLD}{balance_eth:.4f} ETH{RESET}")
        except Exception as e:
            log_warn(f"Falha informativa na API Etherscan: {e}")

    # 4. Auditoria de Saldos dos Targets (Puzzles) via RPC Batch
    log_section("4. Verificação de Saldo dos Puzzles via Ethereum RPC (Batch)")
    
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
            
            resp = requests.post(eth_rpc, json=payloads, headers={"Content-Type": "application/json"}, timeout=timeout_sec)
            if resp.status_code == 200:
                data = resp.json()
                if isinstance(data, list):
                    data_sorted = sorted(data, key=lambda x: x.get("id", 0))
                    for i, item in enumerate(data_sorted):
                        addr = target_addresses[i]
                        if "result" in item:
                            balance_wei = int(item["result"], 16)
                            balance_eth = balance_wei / 1e18
                            status_color = GREEN if balance_eth > 0 else RESET
                            print(f"  Puzzle {71+i} ({addr[:10]}...): {BOLD}{status_color}{balance_eth:.8f} ETH{RESET}")
                        else:
                            log_error(f"Erro no retorno RPC para o Puzzle {71+i}: {item.get('error')}")
                else:
                    log_warn("Retorno RPC batch não veio como lista")
            else:
                log_error(f"Falha ao consultar saldos via RPC Batch: Código {resp.status_code}")
        except Exception as e:
            log_error(f"Erro ao verificar saldos dos puzzles via RPC: {e}")
    else:
        log_warn("Pulando verificação de puzzles porque o nó RPC está inativo.")

    # Resumo Final da Auditoria
    print(f"\n{BOLD}{CYAN}╔════════════════════════════════════════════════════════════╗")
    print(f"║                   RESUMO DA AUDITORIA                      ║")
    print(f"╚════════════════════════════════════════════════════════════╝{RESET}")
    print(f"  • Latência Etherscan: " + (f"{BOLD}{latency_etherscan:.2f} ms{RESET}" if list(env.keys()) and etherscan_ok else f"{YELLOW}N/A ou FALHA{RESET}"))
    print(f"  • Latência Alchemy RPC: " + (f"{BOLD}{latency_rpc:.2f} ms{RESET}" if rpc_ok else f"{RED}FALHA{RESET}"))
    print(f"  • Nó Ethereum RPC: {GREEN}OPERACIONAL{RESET}" if rpc_ok else f"  • Nó Ethereum RPC: {RED}FALHA/Inativo{RESET}")
    print(f"\n{BOLD}{GREEN}✓ Auditoria de Rede Ethereum concluída com sucesso!{RESET}\n")

if __name__ == "__main__":
    main()