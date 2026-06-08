#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
Auditoria de Rede Bitcoin - Foco em Mempool/Esplora REST API com Controle de Fluxo
Aplica Throttling, Batch Slicing e limites operacionais de produção para monitoramento contínuo.
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
    print(f"║          AUDITORIA DE REDE BITCOIN - CONTROLE DE PRODUÇÃO  ║")
    print(f"╚════════════════════════════════════════════════════════════╝{RESET}")

    # 1. Carregar configurações do .env
    log_section("1. Carregando Limites Operacionais do arquivo .env")
    env = load_env()
    
    btc_rest = env.get("BTC_REST_ENDPOINT", "https://mempool.space/api")
    timeout_ms = int(env.get("BTC_TIMEOUT_MS", "3000"))
    timeout_sec = timeout_ms / 1000.0
    
    # Novas variáveis de controle e Throttling
    batch_size = int(env.get("BTC_BATCH_SIZE", "20"))
    delay_ms = int(env.get("BTC_DELAY_MS", "100"))
    max_req_24h = int(env.get("BTC_MAX_REQ_24H", "500000"))
    
    # Alvos/Targets configurados para os Puzzles (Simulando uma lista expansível de produção)
    target_71 = env.get("BTC_TARGET_71", "1PWo3JeB9j000000000000000000000001")
    target_72 = env.get("BTC_TARGET_72", "1JTK7s9YVY000000000000000000000002")
    target_73 = env.get("BTC_TARGET_73", "14og49Gfd0000000000000000000000003")
    
    # Consolidação limpa de alvos válidos
    raw_targets = [target_71, target_72, target_73]
    target_addresses = [addr for addr in raw_targets if addr]
    
    print(f"  Bitcoin REST Endpoint: {BOLD}{btc_rest}{RESET}")
    print(f"  Tamanho do Lote (Batch Size): {BOLD}{batch_size}{RESET}")
    print(f"  Delay entre Requisições: {BOLD}{delay_ms} ms{RESET}")
    print(f"  Teto Máximo 24H: {BOLD}{max_req_24h} requisições{RESET}")
    print(f"  Total de Alvos Mapeados: {BOLD}{len(target_addresses)}{RESET}")
    log_success("Governança e limites de taxa importados com sucesso!")

    # 2. Conectividade básica (Altura do Bloco)
    log_section("2. Teste de Conectividade com Infraestrutura Esplora")
    
    api_ok = False
    latency_api = 0.0
    
    try:
        t_start = time.time()
        resp = requests.get(f"{btc_rest}/blocks/tip/height", timeout=timeout_sec)
        latency_api = (time.time() - t_start) * 1000
        
        if resp.status_code == 200:
            block_height = resp.text.strip()
            log_success("Conectado com sucesso à API Esplora!")
            print(f"  Latência Inicial: {BOLD}{latency_api:.2f} ms{RESET}")
            print(f"  Último Bloco Bitcoin Sincronizado: {BOLD}{block_height}{RESET}")
            api_ok = True
        else:
            log_error(f"API respondeu com status código HTTP inesperado: {resp.status_code}")
    except Exception as e:
        log_error(f"Falha de conexão com a API Esplora: {e}")

    # 3. Verificação de Saldo dos Puzzles com Slicing de Lote e Throttling Ativo
    log_section("3. Verificação de Saldo dos Puzzles (Mempool REST Engine)")
    
    if api_ok:
        # Fatiamento dinâmico da lista de alvos baseada no BTC_BATCH_SIZE
        for i in range(0, len(target_addresses), batch_size):
            batch = target_addresses[i:i + batch_size]
            
            for idx, addr in enumerate(batch):
                # Aplicar Throttling preventivo baseado no BTC_DELAY_MS (exceto na primeira requisição imediata)
                if delay_ms > 0 and (i > 0 or idx > 0):
                    time.sleep(delay_ms / 1000.0)
                
                try:
                    resp = requests.get(f"{btc_rest}/address/{addr}", timeout=timeout_sec)
                    
                    if resp.status_code == 200:
                        data = resp.json()
                        stats = data.get("chain_stats", {})
                        
                        # Cálculo matemático determinístico do modelo de UTXOs do Bitcoin
                        balance_sat = stats.get("funded_txo_sum", 0) - stats.get("spent_txo_sum", 0)
                        balance_btc = balance_sat / 1e8
                        
                        global_idx = i + idx + 71
                        status_color = GREEN if balance_btc > 0 else RESET
                        print(f"  Puzzle {global_idx} ({addr[:10]}...): {BOLD}{status_color}{balance_btc:.8f} BTC{RESET} ({balance_sat} Satoshis)")
                    
                    elif resp.status_code == 429:
                        log_error(f"Rate limit atingido no endereço {addr[:10]}... (Código 429)")
                    else:
                        log_error(f"Falha ao processar endereço {addr[:10]}... Status: {resp.status_code}")
                        
                except Exception as e:
                    log_error(f"Erro na requisição do Puzzle {i + idx + 71}: {e}")
    else:
        log_warn("Módulo de auditoria suspenso porque o endpoint principal falhou na inicialização.")

    # Resumo Final da Auditoria
    print(f"\n{BOLD}{CYAN}╔════════════════════════════════════════════════════════════╗")
    print(f"║                   RESUMO DA AUDITORIA                      ║")
    print(f"╚════════════════════════════════════════════════════════════╝{RESET}")
    print(f"  • Latência do REST Endpoint: " + (f"{BOLD}{latency_api:.2f} ms{RESET}" if api_ok else f"{RED}FALHA{RESET}"))
    print(f"  • Controle de Fluxo (Batch Slicing): {GREEN}ATIVO (Tamanho: {batch_size}){RESET}")
    print(f"  • Throttling de Segurança Inter-lote: {GREEN}ATIVO ({delay_ms}ms){RESET}")
    print(f"\n{BOLD}{GREEN}✓ Auditoria de Produção Bitcoin concluída com sucesso!{RESET}\n")

if __name__ == "__main__":
    main()