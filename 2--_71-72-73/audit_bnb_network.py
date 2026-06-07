#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
Auditoria de Rede BNB - Foco em BscScan API e BNB RPC
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
    print(f"\n{BOLD}{BLUE}" + "═" * 70)
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
    print(f"║          AUDITORIA DE REDE BNB - BSCSCAN & RPC             ║")
    print(f"╚════════════════════════════════════════════════════════════╝{RESET}")

    # 1. Carregar configurações
    log_section("1. Carregando Configurações do arquivo .env")
    env = load_env()
    
    bscscan_key = env.get("BSCSCAN_KEY")
    bnb_rpc = env.get("BNB_RPC_ENDPOINT", "https://bsc-dataseed.binance.org")
    
    target_71 = env.get("BNB_TARGET_71", "0x00000000219ab540356cBB839Cbe05303d7705Fa")
    target_72 = env.get("BNB_TARGET_72", "0xBE0eB53F46cd790Cd13851d5EFf43D12404d33E8")
    target_73 = env.get("BNB_TARGET_73", "0x40B38765696e3d5d8d9d834D8AaD4bB6e418E489")
    
    bscscan_url = "https://api.etherscan.io/v2/api"
    
    if not bscscan_key or bscscan_key == "YourApiKeyToken":
        log_error("BSCSCAN_KEY está faltando ou é um placeholder padrão no .env")
        sys.exit(1)
        
    print(f"  BscScan API Url: {BOLD}{bscscan_url}{RESET}")
    print(f"  BNB RPC Endpoint: {BOLD}{bnb_rpc}{RESET}")
    print(f"  BscScan Key: {BOLD}{bscscan_key[:6]}... (Tamanho: {len(bscscan_key)}){RESET}")
    print(f"  Alvos (Targets):")
    print(f"    - Puzzle 71: {target_71}")
    print(f"    - Puzzle 72: {target_72}")
    print(f"    - Puzzle 73: {target_73}")
    log_success("Configurações importadas com sucesso!")

    # 2. Conectividade básica (BscScan e RPC)
    log_section("2. Teste de Conectividade com BscScan API e RPC")
    
    bscscan_ok = False
    latency_bscscan = 0.0
    try:
        t_start = time.time()
        resp = requests.get(
            bscscan_url,
            params={"chainid": 56, "module": "block", "action": "getblocknobytime", "timestamp": int(time.time()), "closest": "before", "apikey": bscscan_key},
            timeout=5
        )
        latency_bscscan = (time.time() - t_start) * 1000
        
        if resp.status_code == 200:
            log_success(f"Conectado com sucesso à API BscScan!")
            print(f"  Latência BscScan: {BOLD}{latency_bscscan:.2f} ms{RESET}")
            bscscan_ok = True
        else:
            log_warn(f"BscScan respondeu com status código: {resp.status_code}")
    except Exception as e:
        log_error(f"Falha de conexão com a BscScan API: {e}")

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
        resp = requests.post(bnb_rpc, json=payload, headers={"Content-Type": "application/json"}, timeout=5)
        latency_rpc = (time.time() - t_start) * 1000
        
        if resp.status_code == 200:
            data = resp.json()
            if "result" in data:
                block_hex = data["result"]
                block_num = int(block_hex, 16)
                log_success(f"Conectado com sucesso ao BNB RPC Node!")
                print(f"  Altura do Bloco RPC: {BOLD}{block_num}{RESET}")
                print(f"  Latência RPC: {BOLD}{latency_rpc:.2f} ms{RESET}")
                rpc_ok = True
            else:
                log_warn(f"RPC respondeu com formato inválido: {data}")
        else:
            log_warn(f"RPC respondeu com status código: {resp.status_code}")
    except Exception as e:
        log_error(f"Falha de conexão com BNB RPC: {e}")

    # 3. Auditoria BscScan (balancemulti) em carteira ativa
    log_section("3. Auditoria de Funções de Saldo (balancemulti)")
    
    bscscan_balance_ok = False
    # Binance Hot Wallet (Binance 8)
    binance_addr = "0xF977814e90dA44bFA03b6295A0616a897441aceC"
    
    if bscscan_ok:
        try:
            params = {
                "chainid": 56,
                "module": "account",
                "action": "balancemulti",
                "address": binance_addr,
                "tag": "latest",
                "apikey": bscscan_key
            }
            
            resp = requests.get(bscscan_url, params=params, timeout=5)
            data = resp.json()
            
            if resp.status_code == 200 and data.get("status") == "1" and isinstance(data.get("result"), list):
                result_list = data["result"]
                if len(result_list) > 0:
                    item = result_list[0]
                    balance_wei = int(item.get("balance", "0"))
                    balance_bnb = balance_wei / 1e18
                    log_success("balancemulti: Sucesso!")
                    print(f"  Carteira Teste (Binance 8): {binance_addr}")
                    print(f"  Saldo Encontrado: {BOLD}{balance_bnb:.4f} BNB{RESET}")
                    bscscan_balance_ok = True
                else:
                    log_warn("balancemulti retornou lista vazia de resultados")
            else:
                msg = data.get("message", "Sem mensagem de erro")
                res = data.get("result", "Sem detalhes")
                log_error(f"balancemulti falhou: {msg} - {res}")
                if "rate limit" in str(res).lower() or "rate limit" in str(msg).lower():
                    log_warn("API BscScan atingiu limite de taxa (Rate Limit)")
        except Exception as e:
            log_error(f"Erro ao testar balancemulti: {e}")
    else:
        log_warn("Pulando auditoria de saldo do BscScan porque a conexão inicial falhou.")

    # 4. Auditoria de Saldos dos Targets (Puzzles)
    log_section("4. Verificação de Saldo dos Endereços dos Puzzles (BscScan)")
    
    if bscscan_balance_ok:
        try:
            target_addresses = [target_71, target_72, target_73]
            address_str = ",".join(target_addresses)
            
            params = {
                "chainid": 56,
                "module": "account",
                "action": "balancemulti",
                "address": address_str,
                "tag": "latest",
                "apikey": bscscan_key
            }
            
            resp = requests.get(bscscan_url, params=params, timeout=5)
            data = resp.json()
            
            if resp.status_code == 200 and data.get("status") == "1" and isinstance(data.get("result"), list):
                results = data["result"]
                for i, item in enumerate(results):
                    addr = item.get("account")
                    balance_wei = int(item.get("balance", "0"))
                    balance_bnb = balance_wei / 1e18
                    status_color = GREEN if balance_bnb > 0 else RESET
                    print(f"  Puzzle {71+i} ({addr[:10]}...): {BOLD}{status_color}{balance_bnb:.8f} BNB{RESET}")
            else:
                log_error(f"Falha ao consultar saldos dos puzzles: {data.get('result')}")
        except Exception as e:
            log_error(f"Erro ao verificar saldos em lote: {e}")
    else:
        log_warn("Pulando verificação de puzzles via BscScan porque o teste de saldo falhou.")

    # Auditoria extra via RPC caso ativo
    if rpc_ok:
        log_section("4b. Verificação de Saldo dos Puzzles via BNB RPC (Batch)")
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
            
            resp = requests.post(bnb_rpc, json=payloads, headers={"Content-Type": "application/json"}, timeout=5)
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
                            balance_bnb = balance_wei / 1e18
                            status_color = GREEN if balance_bnb > 0 else RESET
                            print(f"  Puzzle {71+i} ({addr[:10]}...): {BOLD}{status_color}{balance_bnb:.8f} BNB{RESET}")
                        else:
                            log_error(f"Erro no retorno RPC para o Puzzle {71+i}: {item.get('error')}")
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
    print(f"  • Latência BscScan: " + (f"{BOLD}{latency_bscscan:.2f} ms{RESET}" if bscscan_ok else f"{RED}FALHA{RESET}"))
    print(f"  • Latência BNB RPC: " + (f"{BOLD}{latency_rpc:.2f} ms{RESET}" if rpc_ok else f"{RED}FALHA{RESET}"))
    print(f"  • API BscScan Key: {GREEN}OPERACIONAL{RESET}" if bscscan_balance_ok else f"  • API BscScan Key: {RED}FALHA/Rejeitada{RESET}")
    print(f"  • BNB RPC Node: {GREEN}OPERACIONAL{RESET}" if rpc_ok else f"  • BNB RPC Node: {RED}FALHA/Inativo{RESET}")
    print(f"\n{BOLD}{GREEN}✓ Auditoria de Rede BNB concluída com sucesso!{RESET}\n")

if __name__ == "__main__":
    main()
