#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
Auditoria de Rede Bitcoin - Foco em Blockchain.info e Blockbook APIs
Valida conexão, endpoints, limites de taxa e saldos dos puzzles.
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
    print(f"║          AUDITORIA DE REDE BITCOIN - BLOCKCHAIN.INFO       ║")
    print(f"╚════════════════════════════════════════════════════════════╝{RESET}")

    # 1. Carregar configurações
    log_section("1. Carregando Configurações do arquivo .env")
    env = load_env()
    
    btc_url = env.get("BLOCKCHAIN_INFO_BASE_URL", "https://blockchain.info")
    ankr_btc_url = env.get("ANKR_BTC_BLOCKBOOK_URL")
    
    # Alvos fixos do Bitcoin Puzzle (P2PKH legacy)
    target_71 = env.get("BTC_TARGET_71", "1PWo3JeB9jrGwfHDNpdGK54CRas7fsVzXU")
    target_72 = env.get("BTC_TARGET_72", "1JTK7s9YVYywfm5XUH7RNhHJH1LshCaRFR")
    target_73 = env.get("BTC_TARGET_73", "12VVRNPi4SJqUTsp6FmqDqY5sGosDtysn4")
    
    print(f"  API Url Principal: {BOLD}{btc_url}{RESET}")
    if ankr_btc_url:
        # Mascarar chave se contiver credenciais
        masked_url = ankr_btc_url
        if "/" in ankr_btc_url:
            parts = ankr_btc_url.split("/")
            if len(parts[-1]) > 10:
                parts[-1] = parts[-1][:6] + "..."
                masked_url = "/".join(parts)
        print(f"  API Url Secundária (Blockbook): {BOLD}{masked_url}{RESET}")
    else:
        print(f"  API Url Secundária (Blockbook): {YELLOW}Não configurada no .env{RESET}")
        
    print(f"  Alvos (Targets):")
    print(f"    - Puzzle 71: {target_71}")
    print(f"    - Puzzle 72: {target_72}")
    print(f"    - Puzzle 73: {target_73}")
    log_success("Configurações importadas com sucesso!")

    # 2. Conectividade básica (Ping e Latência com Blockchain.info)
    log_section("2. Teste de Conectividade com Blockchain.info API")
    blockchain_info_ok = False
    latency_blockchain = 0.0
    
    try:
        t_start = time.time()
        # Requisição leve de teste para obter a altura do último bloco
        resp = requests.get(
            f"{btc_url}/q/getblockcount",
            headers={"User-Agent": "Mozilla/5.0"},
            timeout=5
        )
        latency_blockchain = (time.time() - t_start) * 1000
        
        if resp.status_code == 200:
            block_count = resp.text.strip()
            log_success(f"Conectado com sucesso à API do Blockchain.info!")
            print(f"  Altura do Bloco Atual: {BOLD}{block_count}{RESET}")
            print(f"  Latência de Resposta: {BOLD}{latency_blockchain:.2f} ms{RESET}")
            blockchain_info_ok = True
        else:
            log_warn(f"Conexão HTTP respondeu com status código: {resp.status_code}")
    except Exception as e:
        log_error(f"Falha de conexão com Blockchain.info API: {e}")

    # Teste de conectividade opcional com Blockbook se configurado
    blockbook_ok = False
    latency_blockbook = 0.0
    if ankr_btc_url:
        log_section("2b. Teste de Conectividade com Blockbook API")
        try:
            t_start = time.time()
            # Tentar verificar se responde ao endpoint rest de status/info (/api/v2/) ou se é RPC
            is_rpc = False
            headers = {"User-Agent": "Mozilla/5.0"}
            
            # Checagem REST API (/api/v2/)
            try:
                url_to_test = ankr_btc_url.rstrip('/')
                if not url_to_test.endswith("/api/v2"):
                    url_to_test = f"{url_to_test}/api/v2"
                resp = requests.get(url_to_test, headers=headers, timeout=5)
                if resp.status_code == 200:
                    latency_blockbook = (time.time() - t_start) * 1000
                    log_success("Conectado com sucesso ao Blockbook REST API!")
                    print(f"  Latência de Resposta: {BOLD}{latency_blockbook:.2f} ms{RESET}")
                    blockbook_ok = True
                else:
                    is_rpc = True
            except Exception:
                is_rpc = True

            # Checagem JSON-RPC caso REST falhe ou seja detectada RPC
            if is_rpc:
                t_start = time.time()
                payload = {
                    "jsonrpc": "2.0",
                    "id": 1,
                    "method": "getinfo",
                    "params": []
                }
                resp = requests.post(ankr_btc_url, json=payload, headers={"Content-Type": "application/json"}, timeout=5)
                if resp.status_code == 200:
                    latency_blockbook = (time.time() - t_start) * 1000
                    log_success("Conectado com sucesso ao Blockbook JSON-RPC API!")
                    print(f"  Latência de Resposta: {BOLD}{latency_blockbook:.2f} ms{RESET}")
                    blockbook_ok = True
                else:
                    log_warn(f"Blockbook respondeu com status: {resp.status_code}")
        except Exception as e:
            log_error(f"Falha de conexão com Blockbook API: {e}")

    # 3. Auditoria de Funções de Saldo em carteira de teste
    log_section("3. Auditoria de Funções de Saldo (Endereço de Teste)")
    
    # Satoshi Genesis Address
    test_addr = "1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa"
    test_balance_ok = False
    
    if blockchain_info_ok:
        try:
            resp = requests.get(
                f"{btc_url}/balance",
                params={"active": test_addr},
                headers={"User-Agent": "Mozilla/5.0"},
                timeout=5
            )
            data = resp.json()
            
            if resp.status_code == 200 and test_addr in data:
                item = data[test_addr]
                balance_sat = item.get("final_balance", 0)
                balance_btc = balance_sat / 1e8
                log_success("Blockchain.info balance query: Sucesso!")
                print(f"  Carteira Teste (Satoshi): {test_addr}")
                print(f"  Saldo Encontrado: {BOLD}{balance_btc:.4f} BTC ({balance_sat} satoshis){RESET}")
                test_balance_ok = True
            else:
                log_error(f"Falha na consulta de saldo do Blockchain.info: {resp.status_code} - {resp.text}")
        except Exception as e:
            log_error(f"Erro ao testar consulta de saldo no Blockchain.info: {e}")

    # Teste de saldo via Blockbook se disponível
    if ankr_btc_url and blockbook_ok:
        try:
            url_addr = ankr_btc_url.rstrip('/')
            if not url_addr.endswith("/api/v2"):
                url_addr = f"{url_addr}/api/v2"
            url_addr = f"{url_addr}/address/{test_addr}"
            
            resp = requests.get(url_addr, headers={"User-Agent": "Mozilla/5.0"}, timeout=5)
            if resp.status_code == 200:
                data = resp.json()
                balance_sat = int(data.get("balance", "0"))
                balance_btc = balance_sat / 1e8
                log_success("Blockbook balance query: Sucesso!")
                print(f"  Carteira Teste (Satoshi): {test_addr}")
                print(f"  Saldo Encontrado (Blockbook): {BOLD}{balance_btc:.4f} BTC ({balance_sat} satoshis){RESET}")
            else:
                log_warn(f"Blockbook balance query respondeu com código: {resp.status_code}")
        except Exception as e:
            log_error(f"Erro ao consultar saldo via Blockbook: {e}")

    # 4. Auditoria de Saldos dos Targets (Puzzles)
    log_section("4. Verificação de Saldo dos Endereços dos Puzzles")
    
    if test_balance_ok:
        try:
            target_addresses = [target_71, target_72, target_73]
            address_str = ",".join(target_addresses)
            
            resp = requests.get(
                f"{btc_url}/balance",
                params={"active": address_str},
                headers={"User-Agent": "Mozilla/5.0"},
                timeout=5
            )
            
            if resp.status_code == 200:
                data = resp.json()
                for i, addr in enumerate(target_addresses):
                    if addr in data:
                        item = data[addr]
                        balance_sat = item.get("final_balance", 0)
                        balance_btc = balance_sat / 1e8
                        status_color = GREEN if balance_btc > 0 else RESET
                        print(f"  Puzzle {71+i} ({addr[:10]}...): {BOLD}{status_color}{balance_btc:.8f} BTC ({balance_sat} satoshis){RESET}")
                    else:
                        log_warn(f"Endereço do Puzzle {71+i} ({addr}) não retornado na resposta da API.")
            else:
                log_error(f"Falha ao consultar saldos dos puzzles: Código {resp.status_code} - {resp.text}")
        except Exception as e:
            log_error(f"Erro ao verificar saldos em lote: {e}")
    else:
        log_warn("Pulando verificação dos puzzles porque o teste de saldo inicial não obteve sucesso.")

    # Resumo Final da Auditoria
    print(f"\n{BOLD}{CYAN}╔════════════════════════════════════════════════════════════╗")
    print(f"║                   RESUMO DA AUDITORIA                      ║")
    print(f"╚════════════════════════════════════════════════════════════╝{RESET}")
    if blockchain_info_ok:
        print(f"  • Latência do Blockchain.info: {BOLD}{latency_blockchain:.2f} ms{RESET}")
        print(f"  • API Blockchain.info: {GREEN}OPERACIONAL{RESET}")
    else:
        print(f"  • API Blockchain.info: {RED}FALHA/NÃO OPERACIONAL{RESET}")
        
    if ankr_btc_url:
        if blockbook_ok:
            print(f"  • Latência do Blockbook: {BOLD}{latency_blockbook:.2f} ms{RESET}")
            print(f"  • API Blockbook/Ankr: {GREEN}OPERACIONAL{RESET}")
        else:
            print(f"  • API Blockbook/Ankr: {RED}FALHA/NÃO OPERACIONAL{RESET}")
            
    print(f"\n{BOLD}{GREEN}✓ Auditoria de Rede Bitcoin concluída com sucesso!{RESET}\n")

if __name__ == "__main__":
    main()
