#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
Auditoria de Rede Polygon - Foco em Polygon RPC & Etherscan API V2 (Chain 137)
Valida conexão, chaves de API, limites de taxa e saldos dos puzzles.
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
    print(f"║          AUDITORIA DE REDE POLYGON - RPC & ETHERSCAN V2     ║")
    print(f"╚════════════════════════════════════════════════════════════╝{RESET}")

    # 1. Carregar configurações
    log_section("1. Carregando Configurações do arquivo .env")
    env = load_env()
    
    polygon_rpc = env.get("POLYGON_RPC_ENDPOINT", "https://polygon-rpc.com")
    polygon_api_key = env.get("POLYGON_API_KEY")
    global_etherscan_key = env.get("ETHERSCAN_KEY")
    
    target_71 = env.get("POLYGON_TARGET_71", "0x00000000219ab540356cBB839Cbe05303d7705Fa")
    target_72 = env.get("POLYGON_TARGET_72", "0xBE0eB53F46cd790Cd13851d5EFf43D12404d33E8")
    target_73 = env.get("POLYGON_TARGET_73", "0x40B38765696e3d5d8d9d834D8AaD4bB6e418E489")
    
    etherscan_url = "https://api.etherscan.io/v2/api"
    
    # Resolver qual chave de API usar para a Etherscan V2 API (Chain 137)
    # Nota: Em alguns setups do projeto, POLYGON_API_KEY está configurada como a URL do dRPC.
    # Se for esse o caso, usaremos a chave global ETHERSCAN_KEY como fallback.
    api_key_to_use = None
    if polygon_api_key and not polygon_api_key.startswith("http"):
        api_key_to_use = polygon_api_key
        print(f"  Polygon API Key (do .env): {BOLD}{api_key_to_use[:6]}... (Tamanho: {len(api_key_to_use)}){RESET}")
    elif global_etherscan_key and not global_etherscan_key.startswith("http"):
        api_key_to_use = global_etherscan_key
        print(f"  Usando Fallback ETHERSCAN_KEY: {BOLD}{api_key_to_use[:6]}... (Tamanho: {len(api_key_to_use)}){RESET}")
        if polygon_api_key and polygon_api_key.startswith("http"):
            log_warn("POLYGON_API_KEY no .env está configurada como a URL dRPC. Usando a chave ETHERSCAN_KEY como alternativa.")
    
    if not api_key_to_use or api_key_to_use == "YourApiKeyToken":
        log_warn("Nenhuma chave válida encontrada para Etherscan API V2 (Chain 137). Testes da Etherscan V2 serão limitados.")
        
    print(f"  Polygon RPC Endpoint: {BOLD}{polygon_rpc}{RESET}")
    print(f"  Etherscan V2 API Url: {BOLD}{etherscan_url} (Chain ID: 137){RESET}")
    print(f"  Alvos (Targets):")
    print(f"    - Puzzle 71: {target_71}")
    print(f"    - Puzzle 72: {target_72}")
    print(f"    - Puzzle 73: {target_73}")
    log_success("Configurações importadas com sucesso!")

    # 2. Conectividade básica (Etherscan V2 e RPC)
    log_section("2. Teste de Conectividade com Etherscan API V2 e RPC")
    
    etherscan_ok = False
    latency_etherscan = 0.0
    if api_key_to_use and api_key_to_use != "YourApiKeyToken":
        try:
            t_start = time.time()
            resp = requests.get(
                etherscan_url,
                params={"chainid": 137, "module": "block", "action": "getblocknobytime", "timestamp": int(time.time()), "closest": "before", "apikey": api_key_to_use},
                timeout=5
            )
            latency_etherscan = (time.time() - t_start) * 1000
            
            if resp.status_code == 200:
                log_success("Conectado com sucesso à API Etherscan V2 (Chain 137)!")
                print(f"  Latência Etherscan: {BOLD}{latency_etherscan:.2f} ms{RESET}")
                etherscan_ok = True
            else:
                log_warn(f"Etherscan V2 respondeu com status código: {resp.status_code}")
        except Exception as e:
            log_error(f"Falha de conexão com a Etherscan API: {e}")
    else:
        log_warn("Pulando teste da Etherscan API V2 porque nenhuma chave de API válida está disponível.")

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
        resp = requests.post(polygon_rpc, json=payload, headers={"Content-Type": "application/json"}, timeout=5)
        latency_rpc = (time.time() - t_start) * 1000
        
        if resp.status_code == 200:
            data = resp.json()
            if "result" in data:
                block_hex = data["result"]
                block_num = int(block_hex, 16)
                log_success("Conectado com sucesso ao Polygon RPC Node!")
                print(f"  Altura do Bloco RPC: {BOLD}{block_num}{RESET}")
                print(f"  Latência RPC: {BOLD}{latency_rpc:.2f} ms{RESET}")
                rpc_ok = True
            else:
                log_warn(f"RPC respondeu com formato inválido: {data}")
        else:
            log_warn(f"RPC respondeu com status código: {resp.status_code}")
    except Exception as e:
        log_error(f"Falha de conexão com Polygon RPC: {e}")

    # 3. Auditoria Etherscan V2 (balancemulti) em carteira ativa
    log_section("3. Auditoria de Funções de Saldo via Etherscan V2 (balancemulti)")
    
    etherscan_balance_ok = False
    vitalik_addr = "0xd8da6bf26964af9d7eed9e03e53415d37aa96045"
    
    if etherscan_ok:
        try:
            params = {
                "chainid": 137,
                "module": "account",
                "action": "balancemulti",
                "address": vitalik_addr,
                "tag": "latest",
                "apikey": api_key_to_use
            }
            
            resp = requests.get(etherscan_url, params=params, timeout=5)
            data = resp.json()
            
            if resp.status_code == 200 and data.get("status") == "1" and isinstance(data.get("result"), list):
                result_list = data["result"]
                if len(result_list) > 0:
                    item = result_list[0]
                    balance_wei = int(item.get("balance", "0"))
                    balance_matic = balance_wei / 1e18
                    log_success("balancemulti (Etherscan V2): Sucesso!")
                    print(f"  Carteira Teste (Vitalik): {vitalik_addr}")
                    print(f"  Saldo Encontrado: {BOLD}{balance_matic:.4f} MATIC{RESET}")
                    etherscan_balance_ok = True
                else:
                    log_warn("balancemulti retornou lista vazia de resultados")
            else:
                msg = data.get("message", "Sem mensagem de erro")
                res = data.get("result", "Sem detalhes")
                log_error(f"balancemulti falhou: {msg} - {res}")
                if "rate limit" in str(res).lower() or "rate limit" in str(msg).lower():
                    log_warn("API Etherscan atingiu limite de taxa (Rate Limit)")
        except Exception as e:
            log_error(f"Erro ao testar balancemulti via Etherscan V2: {e}")
    else:
        log_warn("Pulando auditoria de saldo via Etherscan V2 porque a conexão inicial falhou.")

    # 4. Auditoria de Saldos dos Targets (Puzzles) via Etherscan V2
    log_section("4. Verificação de Saldo dos Endereços dos Puzzles (Etherscan V2)")
    
    if etherscan_balance_ok:
        try:
            target_addresses = [target_71, target_72, target_73]
            address_str = ",".join(target_addresses)
            
            params = {
                "chainid": 137,
                "module": "account",
                "action": "balancemulti",
                "address": address_str,
                "tag": "latest",
                "apikey": api_key_to_use
            }
            
            resp = requests.get(etherscan_url, params=params, timeout=5)
            data = resp.json()
            
            if resp.status_code == 200 and data.get("status") == "1" and isinstance(data.get("result"), list):
                results = data["result"]
                for i, item in enumerate(results):
                    addr = item.get("account")
                    balance_wei = int(item.get("balance", "0"))
                    balance_matic = balance_wei / 1e18
                    status_color = GREEN if balance_matic > 0 else RESET
                    print(f"  Puzzle {71+i} ({addr[:10]}...): {BOLD}{status_color}{balance_matic:.8f} MATIC{RESET}")
            else:
                log_error(f"Falha ao consultar saldos dos puzzles via Etherscan: {data.get('result')}")
        except Exception as e:
            log_error(f"Erro ao verificar saldos em lote via Etherscan: {e}")
    else:
        log_warn("Pulando verificação de puzzles via Etherscan porque o teste de saldo falhou.")

    # 4b. Auditoria extra via RPC caso ativo
    if rpc_ok:
        log_section("4b. Verificação de Saldo dos Puzzles via Polygon RPC (Batch)")
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
            
            resp = requests.post(polygon_rpc, json=payloads, headers={"Content-Type": "application/json"}, timeout=5)
            if resp.status_code == 200:
                data = resp.json()
                if isinstance(data, list):
                    # Ordenar resultados pelo ID da requisição
                    data_sorted = sorted(data, key=lambda x: x.get("id", 0))
                    for i, item in enumerate(data_sorted):
                        addr = target_addresses[i]
                        if "result" in item:
                            balance_hex = item["result"]
                            balance_wei = int(balance_hex, 16) if balance_hex.startswith("0x") else int(balance_hex)
                            balance_matic = balance_wei / 1e18
                            status_color = GREEN if balance_matic > 0 else RESET
                            print(f"  Puzzle {71+i} ({addr[:10]}...): {BOLD}{status_color}{balance_matic:.8f} MATIC{RESET}")
                        else:
                            log_error(f"Erro no retorno RPC para o Puzzle {71+i}: {item.get('error')}")
                else:
                    # Tenta tratar se veio apenas um objeto (caso de lote com 1 item ou comportamento do RPC)
                    if isinstance(data, dict) and "result" in data:
                        addr = target_addresses[0]
                        balance_hex = data["result"]
                        balance_wei = int(balance_hex, 16) if balance_hex.startswith("0x") else int(balance_hex)
                        balance_matic = balance_wei / 1e18
                        status_color = GREEN if balance_matic > 0 else RESET
                        print(f"  Puzzle 71 ({addr[:10]}...): {BOLD}{status_color}{balance_matic:.8f} MATIC{RESET}")
                        log_warn("Retorno RPC batch veio como um único objeto em vez de lista. Exibido apenas o Puzzle 71.")
                    else:
                        log_warn("Retorno RPC batch não veio como lista")
            else:
                log_error(f"Falha ao consultar saldos dos puzzles via RPC: Código {resp.status_code}")
        except Exception as e:
            log_error(f"Erro ao verificar saldos dos puzzles via RPC: {e}")

    # Resumo Final da Auditoria
    print(f"\n{BOLD}{CYAN}╔════════════════════════════════════════════════════════════╗")
    print(f"║                   RESUMO DA AUDITORIA                      ║")
    print(f"╚════════════════════════════════════════════════════════════╝{RESET}")
    print(f"  • Latência Etherscan V2 (Chain 137): " + (f"{BOLD}{latency_etherscan:.2f} ms{RESET}" if etherscan_ok else f"{RED}FALHA/NÃO DISPONÍVEL{RESET}"))
    print(f"  • Latência Polygon RPC Node: " + (f"{BOLD}{latency_rpc:.2f} ms{RESET}" if rpc_ok else f"{RED}FALHA{RESET}"))
    print(f"  • API Etherscan V2 Key: {GREEN}OPERACIONAL{RESET}" if etherscan_balance_ok else f"  • API Etherscan V2 Key: {RED}FALHA/Rejeitada/Não Configurada{RESET}")
    print(f"  • Polygon RPC Node: {GREEN}OPERACIONAL{RESET}" if rpc_ok else f"  • Polygon RPC Node: {RED}FALHA/Inativo{RESET}")
    print(f"\n{BOLD}{GREEN}✓ Auditoria de Rede Polygon concluída com sucesso!{RESET}\n")

if __name__ == "__main__":
    main()
