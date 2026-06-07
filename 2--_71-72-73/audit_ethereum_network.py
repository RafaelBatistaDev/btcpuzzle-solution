#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
Auditoria de Rede Ethereum - Foco em Etherscan API V2
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
    print(f"═" * 70 + f"{RESET}")

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
    print(f"║          AUDITORIA DE REDE ETHEREUM - ETHERSCAN V2         ║")
    print(f"╚════════════════════════════════════════════════════════════╝{RESET}")

    # 1. Carregar configurações
    log_section("1. Carregando Configurações do arquivo .env")
    env = load_env()
    
    etherscan_key = env.get("ETHERSCAN_KEY")
    target_71 = env.get("ETH_TARGET_71", "0x00000000219ab540356cBB839Cbe05303d7705Fa")
    target_72 = env.get("ETH_TARGET_72", "0xBE0eB53F46cd790Cd13851d5EFf43D12404d33E8")
    target_73 = env.get("ETH_TARGET_73", "0x40B38765696e3d5d8d9d834D8AaD4bB6e418E489")
    
    etherscan_url = "https://api.etherscan.io/v2/api"
    
    if not etherscan_key or etherscan_key == "YourApiKeyToken":
        log_error("ETHERSCAN_KEY está faltando ou é um placeholder padrão no .env")
        sys.exit(1)
        
    print(f"  API Url: {BOLD}{etherscan_url}{RESET}")
    print(f"  Etherscan Key: {BOLD}{etherscan_key[:6]}... (Tamanho: {len(etherscan_key)}){RESET}")
    print(f"  Alvos (Targets):")
    print(f"    - Puzzle 71: {target_71}")
    print(f"    - Puzzle 72: {target_72}")
    print(f"    - Puzzle 73: {target_73}")
    log_success("Configurações importadas com sucesso!")

    # 2. Conectividade básica (Ping e Latência com Etherscan V2)
    log_section("2. Teste de Conectividade com Etherscan API V2")
    try:
        t_start = time.time()
        # Requisição simples de teste de conexão
        resp = requests.get(
            etherscan_url,
            params={"chainid": 1, "module": "block", "action": "getblocknobytime", "timestamp": int(time.time()), "closest": "before", "apikey": etherscan_key},
            timeout=5
        )
        latency = (time.time() - t_start) * 1000
        
        if resp.status_code == 200:
            log_success(f"Conectado com sucesso à API Etherscan V2!")
            print(f"  Latência de Resposta: {BOLD}{latency:.2f} ms{RESET}")
        else:
            log_warn(f"Conexão HTTP respondeu com status código: {resp.status_code}")
    except Exception as e:
        log_error(f"Falha de conexão com a Etherscan API: {e}")
        sys.exit(1)

    # 3. Auditoria Etherscan V2 (balancemulti) em carteira ativa
    log_section("3. Auditoria de Funções de Saldo (balancemulti)")
    
    etherscan_ok = False
    vitalik_addr = "0xd8da6bf26964af9d7eed9e03e53415d37aa96045"
    try:
        params = {
            "chainid": 1,
            "module": "account",
            "action": "balancemulti",
            "address": vitalik_addr,
            "tag": "latest",
            "apikey": etherscan_key
        }
        
        resp = requests.get(etherscan_url, params=params, timeout=5)
        data = resp.json()
        
        if resp.status_code == 200 and data.get("status") == "1" and isinstance(data.get("result"), list):
            result_list = data["result"]
            if len(result_list) > 0:
                item = result_list[0]
                balance_wei = int(item.get("balance", "0"))
                balance_eth = balance_wei / 1e18
                log_success("balancemulti: Sucesso!")
                print(f"  Carteira Teste (Vitalik): {vitalik_addr}")
                print(f"  Saldo Encontrado: {BOLD}{balance_eth:.4f} ETH{RESET}")
                etherscan_ok = True
            else:
                log_warn("balancemulti retornou lista vazia de resultados")
        else:
            msg = data.get("message", "Sem mensagem de erro")
            res = data.get("result", "Sem detalhes")
            log_error(f"balancemulti falhou: {msg} - {res}")
            if "rate limit" in str(res).lower() or "rate limit" in str(msg).lower():
                log_warn("API Etherscan atingiu limite de taxa (Rate Limit)")
    except Exception as e:
        log_error(f"Erro ao testar balancemulti: {e}")

    # 4. Auditoria de Saldos dos Targets (Puzzles)
    log_section("4. Verificação de Saldo dos Endereços dos Puzzles (V2)")
    
    if etherscan_ok:
        try:
            target_addresses = [target_71, target_72, target_73]
            address_str = ",".join(target_addresses)
            
            params = {
                "chainid": 1,
                "module": "account",
                "action": "balancemulti",
                "address": address_str,
                "tag": "latest",
                "apikey": etherscan_key
            }
            
            resp = requests.get(etherscan_url, params=params, timeout=5)
            data = resp.json()
            
            if resp.status_code == 200 and data.get("status") == "1" and isinstance(data.get("result"), list):
                results = data["result"]
                for i, item in enumerate(results):
                    addr = item.get("account")
                    balance_wei = int(item.get("balance", "0"))
                    balance_eth = balance_wei / 1e18
                    status_color = GREEN if balance_eth > 0 else RESET
                    print(f"  Puzzle {71+i} ({addr[:10]}...): {BOLD}{status_color}{balance_eth:.8f} ETH{RESET}")
            else:
                log_error(f"Falha ao consultar saldos dos puzzles: {data.get('result')}")
        except Exception as e:
            log_error(f"Erro ao verificar saldos em lote: {e}")
    else:
        log_warn("Pulando verificação de lote de puzzles porque a API da Etherscan não respondeu corretamente no teste anterior.")

    # Resumo Final da Auditoria
    print(f"\n{BOLD}{CYAN}╔════════════════════════════════════════════════════════════╗")
    print(f"║                   RESUMO DA AUDITORIA                      ║")
    print(f"╚════════════════════════════════════════════════════════════╝{RESET}")
    print(f"  • Latência da Etherscan: {BOLD}{latency:.2f} ms{RESET}")
    print(f"  • API Etherscan V2: {GREEN}OPERACIONAL{RESET}" if etherscan_ok else f"  • API Etherscan V2: {RED}FALHA/NÃO OPERACIONAL{RESET}")
    print(f"  • Chave Etherscan: {GREEN}AUTENTICADA{RESET}" if etherscan_ok else f"  • Chave Etherscan: {RED}REJEITADA/Placeholder{RESET}")
    print(f"\n{BOLD}{GREEN}✓ Auditoria de Rede Ethereum concluída com sucesso!{RESET}\n")

if __name__ == "__main__":
    main()
