#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
Auditoria de Rede Polygon - Foco em dRPC Node de Alta Performance
Valida conexão, latência, throttling e saldos dos puzzles via RPC Batch nativo.
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
    print(f"║          AUDITORIA DE REDE POLYGON - dRPC BATCH NATIVO     ║")
    print(f"╚════════════════════════════════════════════════════════════╝{RESET}")

    # 1. Carregar configurações
    log_section("1. Carregando Configurações do arquivo .env")
    env = load_env()
    
    polygon_rpc = env.get("POLYGON_RPC_ENDPOINT", "https://polygon-rpc.com")
    global_etherscan_key = env.get("ETHERSCAN_KEY")
    
    target_71 = env.get("POLYGON_TARGET_71", "0x00000000219ab540356cBB839Cbe05303d7705Fa")
    target_72 = env.get("POLYGON_TARGET_72", "0xBE0eB53F46cd790Cd13851d5EFf43D12404d33E8")
    target_73 = env.get("POLYGON_TARGET_73", "0x40B38765696e3d5d8d9d834D8AaD4bB6e418E489")
    
    # Extração de variáveis de timing e controle de taxa
    timeout_ms = int(env.get("POLYGON_TIMEOUT_MS", "5000"))
    timeout_sec = timeout_ms / 1000.0
    
    initial_delay_ms = int(env.get("POLYGON_INITIAL_DELAY_MS", "100"))
    delay_ms = int(env.get("POLYGON_DELAY_MS", "300"))
    
    etherscan_url = "https://api.etherscan.io/v2/api"
    
    # Mascarar credencial dkey do dRPC para exibição de log limpa e segura
    masked_rpc = polygon_rpc
    if "dkey=" in polygon_rpc:
        base_part, dkey_part = polygon_rpc.split("dkey=", 1)
        masked_rpc = f"{base_part}dkey={dkey_part[:6]}..."

    print(f"  Polygon dRPC Endpoint: {BOLD}{masked_rpc}{RESET}")
    
    # Forçar uso da ETHERSCAN_KEY global apenas se ela não for uma URL (protegendo roteamento)
    api_key_to_use = None
    if global_etherscan_key and not global_etherscan_key.startswith("http") and global_etherscan_key != "YourApiKeyToken":
        api_key_to_use = global_etherscan_key
        print(f"  Etherscan Fallback API Key: {BOLD}{api_key_to_use[:6]}...{RESET}")
    else:
        print(f"  Etherscan API Key: {YELLOW}Desativada (Usando dRPC Provedor Único){RESET}")
        
    print(f"  Alvos (Targets):")
    print(f"    - Puzzle 71: {target_71}")
    print(f"    - Puzzle 72: {target_72}")
    print(f"    - Puzzle 73: {target_73}")
    log_success("Configurações importadas com sucesso!")

    # Executa o delay inicial controlado configurado no .env
    if initial_delay_ms > 0:
        time.sleep(initial_delay_ms / 1000.0)

    # 2. Conectividade básica via dRPC Node
    log_section("2. Teste de Conectividade com Provedor dRPC Polygon")
    
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
        resp = requests.post(polygon_rpc, json=payload, headers={"Content-Type": "application/json"}, timeout=timeout_sec)
        latency_rpc = (time.time() - t_start) * 1000
        
        if resp.status_code == 200:
            data = resp.json()
            if "result" in data:
                block_num = int(data["result"], 16)
                log_success("Conectado com sucesso ao Nó dRPC Polygon!")
                print(f"  Altura do Bloco RPC: {BOLD}{block_num}{RESET}")
                print(f"  Latência RPC: {BOLD}{latency_rpc:.2f} ms{RESET}")
                rpc_ok = True
            else:
                log_warn(f"dRPC respondeu com formato inesperado: {data}")
        else:
            log_warn(f"dRPC respondeu com código HTTP: {resp.status_code}")
    except Exception as e:
        log_error(f"Falha crítica de conexão com Polygon dRPC: {e}")

    # Teste condicional da Etherscan V2 caso haja uma chave global estrita
    etherscan_ok = False
    latency_etherscan = 0.0
    if api_key_to_use:
        try:
            t_start = time.time()
            resp = requests.get(
                etherscan_url,
                params={"chainid": 137, "module": "block", "action": "getblocknobytime", "timestamp": int(time.time()), "closest": "before", "apikey": api_key_to_use},
                timeout=timeout_sec
            )
            latency_etherscan = (time.time() - t_start) * 1000
            if resp.status_code == 200:
                log_success("Conectado com sucesso à API Etherscan V2 Secundária!")
                etherscan_ok = True
        except Exception:
            pass

    # 3. Auditoria dRPC em carteira de controle ativo (Vitalik Address)
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
            # Throttling entre requisições consecutivas
            if delay_ms > 0:
                time.sleep(delay_ms / 1000.0)
                
            resp = requests.post(polygon_rpc, json=payload, headers={"Content-Type": "application/json"}, timeout=timeout_sec)
            if resp.status_code == 200:
                balance_wei = int(resp.json()["result"], 16)
                balance_matic = balance_wei / 1e18
                log_success("RPC eth_getBalance: Sucesso!")
                print(f"  Carteira Teste (Vitalik): {vitalik_addr}")
                print(f"  Saldo Encontrado: {BOLD}{balance_matic:.4f} POL/MATIC{RESET}")
        except Exception as e:
            log_error(f"Erro ao testar chamada de saldo no dRPC: {e}")

    # 4. Auditoria de Saldos dos Targets (Puzzles) via dRPC Batch Avançado
    log_section("4. Verificação de Saldo dos Puzzles via Polygon dRPC (Batch)")
    
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
            
            if delay_ms > 0:
                time.sleep(delay_ms / 1000.0)
                
            resp = requests.post(polygon_rpc, json=payloads, headers={"Content-Type": "application/json"}, timeout=timeout_sec)
            if resp.status_code == 200:
                data = resp.json()
                if isinstance(data, list):
                    data_sorted = sorted(data, key=lambda x: x.get("id", 0))
                    for i, item in enumerate(data_sorted):
                        addr = target_addresses[i]
                        if "result" in item:
                            balance_wei = int(item["result"], 16)
                            balance_matic = balance_wei / 1e18
                            status_color = GREEN if balance_matic > 0 else RESET
                            print(f"  Puzzle {71+i} ({addr[:10]}...): {BOLD}{status_color}{balance_matic:.8f} POL/MATIC{RESET}")
                        else:
                            log_error(f"Erro no retorno dRPC para o Puzzle {71+i}: {item.get('error')}")
                else:
                    log_warn("Provedor dRPC não retornou uma lista estruturada para o lote.")
            else:
                log_error(f"Falha ao consultar saldos em lote: Código {resp.status_code}")
        except Exception as e:
            log_error(f"Erro durante a execução do lote de puzzles RPC: {e}")
    else:
        log_warn("Pulando lote de puzzles porque a infraestrutura dRPC falhou nos testes anteriores.")

    # Resumo Final da Auditoria
    print(f"\n{BOLD}{CYAN}╔════════════════════════════════════════════════════════════╗")
    print(f"║                   RESUMO DA AUDITORIA                      ║")
    print(f"╚════════════════════════════════════════════════════════════╝{RESET}")
    print(f"  • Latência Polygon dRPC Node: {BOLD}{latency_rpc:.2f} ms{RESET}" if rpc_ok else f"  • Latência Polygon dRPC Node: {RED}FALHA{RESET}")
    print(f"  • Provedor dRPC Principal: {GREEN}OPERACIONAL{RESET}" if rpc_ok else f"  • Provedor dRPC Principal: {RED}NÃO OPERACIONAL{RESET}")
    print(f"  • Controle de Delay (Throttling): {GREEN}ATIVO ({delay_ms}ms){RESET}")
    print(f"\n{BOLD}{GREEN}✓ Auditoria de Rede Polygon concluída com sucesso!{RESET}\n")

if __name__ == "__main__":
    main()