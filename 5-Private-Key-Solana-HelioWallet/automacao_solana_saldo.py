#!/usr/bin/env python3
# -*- coding: utf-8 -*-
# /// script
# requires-python = ">=3.11"
# dependencies = [
#     "playwright>=1.40.0",
# ]
# ///
"""
Nome do Script  : automacao_solana_saldo.py
Descrição       : Automação HelioWallet com captura de saldo Solana.
                  Garante o salvamento individual e vinculado de cada frase aos seus dados.
                  Reutiliza os arquivos de saída (append) se já existirem.
Autor           : recifecrypto
Versão          : 3.8.2
"""

import sys
import logging
from datetime import datetime
from pathlib import Path
import json

from playwright.sync_api import sync_playwright, Page


# ─────────────────────────────────────────────
# CONSTANTES E DIRETÓRIOS
# ─────────────────────────────────────────────
SCRIPT_DIR  = Path(__file__).resolve().parent
PROJECT_ROOT = SCRIPT_DIR  # Script na raiz do projeto
LOG_DIR     = SCRIPT_DIR / "logs"
OUTPUT_DIR  = SCRIPT_DIR / "Feito"
LOG_FILE    = LOG_DIR / f"contador_{datetime.now().strftime('%Y%m%d_%H%M%S')}.log"
SUCESSO_OUT = LOG_DIR / "linhas_sucesso_heliowallet.txt"
FALHA_OUT   = LOG_DIR / "linhas_falha_heliowallet.txt"
DADOS_OUT   = LOG_DIR / "dados_completos_heliowallet.jsonl"
CHECKPOINT  = LOG_DIR / "checkpoint.json"  # Rastreia progresso

URL = "https://heliowallet.com/access"
URL_DASHBOARD = "https://heliowallet.com/dashboard"

# Seletores Precisos baseados no DOM atualizado
SELETOR_BOTAO_SOL = "button:has-text('SOL')"
SELETOR_RECOVERY_PHRASE = "text='Private Key'"
SELETOR_TEXTAREA_FRASE = "textarea"
SELETOR_BOTAO_ACCESS = "#access-wallet-btn"
SELETOR_ACCOUNT_BALANCE = "div:has-text('Account Balance')"

TEXTO_ERRO_FRASE = "Invalid mnemonic phrase (must be 12, 15, 18, 21, or 24 words)"

# Timeouts e Delays
TIMEOUT_PAGINA = 30_000
ESPERA_PADRAO = 2_000  # 2 segundos entre passos
ESPERA_CAPTURA = 10_000  # 10 segundos para carregamento do dashboard


# ─────────────────────────────────────────────
# CONFIGURAÇÃO DE CORES E LOG
# ─────────────────────────────────────────────
class Color:
    G, B, Y, R, C, N = "\033[1;32m", "\033[1;34m", "\033[1;33m", "\033[1;31m", "\033[1;36m", "\033[0m"

def _setup_logging() -> logging.Logger:
    LOG_DIR.mkdir(parents=True, exist_ok=True)
    logger = logging.getLogger("contador")
    logger.setLevel(logging.DEBUG)
    fh = logging.FileHandler(LOG_FILE, encoding="utf-8")
    fh.setFormatter(logging.Formatter("[%(levelname)s] %(asctime)s — %(message)s"))
    ch = logging.StreamHandler(sys.stdout)
    ch.setFormatter(logging.Formatter("%(message)s"))
    logger.addHandler(fh)
    logger.addHandler(ch)
    return logger

logger = _setup_logging()
def log(msg): logger.info(f"{Color.B}[INFO]{Color.N}   {msg}")
def success(msg): logger.info(f"{Color.G}[OK]{Color.N}     {msg}")
def warn(msg): logger.warning(f"{Color.Y}[AVISO]{Color.N} {msg}")
def error(msg): logger.error(f"{Color.R}[ERRO]{Color.N}  {msg}")
def debug(msg): logger.debug(f"{Color.C}[DEBUG]{Color.N} {msg}")


def bootstrap_dirs():
    for d in (LOG_DIR, OUTPUT_DIR): d.mkdir(parents=True, exist_ok=True)

def ler_linhas(arquivo: Path) -> list[str]:
    if not arquivo.exists():
        error(f"Arquivo não encontrado: {arquivo}"); sys.exit(1)
    linhas = [l for l in arquivo.read_text(encoding="utf-8").splitlines() if l.strip()]
    log(f"{len(linhas)} linha(s) carregada(s) [Solana]")
    return linhas

def ler_processadas() -> set[str]:
    """Lê todas as frases já processadas (sucesso ou falha)"""
    processadas = set()
    if SUCESSO_OUT.exists():
        processadas.update(line.strip() for line in SUCESSO_OUT.read_text(encoding="utf-8").splitlines() if line.strip())
    if FALHA_OUT.exists():
        processadas.update(line.strip() for line in FALHA_OUT.read_text(encoding="utf-8").splitlines() if line.strip())
    return processadas

def ler_checkpoint() -> dict:
    """Lê o checkpoint do último processamento"""
    if CHECKPOINT.exists():
        return json.loads(CHECKPOINT.read_text(encoding="utf-8"))
    return {"ultima_frase": None, "total_sucesso": 0, "total_falha": 0, "data": None}

def salvar_checkpoint(ultima_frase: str, total_sucesso: int, total_falha: int):
    """Salva o checkpoint do processamento"""
    dados = {
        "ultima_frase": ultima_frase,
        "total_sucesso": total_sucesso,
        "total_falha": total_falha,
        "data": datetime.now().isoformat()
    }
    CHECKPOINT.write_text(json.dumps(dados, ensure_ascii=False, indent=2), encoding="utf-8")

def mostrar_progresso(linhas_total: int, processadas: set):
    """Mostra resumo do progresso"""
    sucesso = len([l for l in SUCESSO_OUT.read_text(encoding="utf-8").splitlines() if l.strip()]) if SUCESSO_OUT.exists() else 0
    falha = len([l for l in FALHA_OUT.read_text(encoding="utf-8").splitlines() if l.strip()]) if FALHA_OUT.exists() else 0
    
    log(f"\n{'═'*60}")
    log(f"📊 PROGRESSO DO PROCESSAMENTO")
    log(f"{'═'*60}")
    log(f"  Total de frases:        {linhas_total}")
    log(f"  Já processadas:         {len(processadas)}")
    log(f"    ✅ Com sucesso:       {sucesso}")
    log(f"    ❌ Com falha:         {falha}")
    log(f"  Faltam processar:       {linhas_total - len(processadas)}")
    log(f"{'═'*60}\n")


# ─────────────────────────────────────────────
# LÓGICA DE PROCESSAMENTO
# ─────────────────────────────────────────────
def processar_linha(page: Page, linha: str) -> tuple[bool, dict | None]:
    try:
        # 🔄 Passo 1: Carrega a página e clica no botão SOL
        page.goto(URL, wait_until="networkidle", timeout=TIMEOUT_PAGINA)
        debug("Página carregada.")
        
        botao_sol = page.locator(SELETOR_BOTAO_SOL).first
        if botao_sol.is_visible():
            botao_sol.click()
            debug("Botão SOL clicado.")
            # Passo 1: Espera 1,5 segundo
            page.wait_for_timeout(ESPERA_PADRAO)
        else:
            warn("Botão SOL não encontrado.")
            return (False, None)

        # 🔄 Passo 2: Clica em "Recovery Phrase"
        recovery_div = page.locator(SELETOR_RECOVERY_PHRASE).first
        recovery_div.wait_for(state="visible", timeout=10_000)
        recovery_div.click(force=True)
        debug("Recovery Phrase clicado (Passo 2).")
        # Passo 2: Espera 1,5 segundo
        page.wait_for_timeout(ESPERA_PADRAO)

        # 🔄 Passo 3: Insere a frase e aguarda validação
        campo = page.locator(SELETOR_TEXTAREA_FRASE).first
        campo.wait_for(state="visible", timeout=10_000)
        campo.fill(linha)
        debug("Frase inserida (Passo 3).")
        # Pequena pausa para garantir que o botão de acesso seja habilitado
        page.wait_for_timeout(1000)

        # 🔄 Passo 4: Clica no botão "Access Wallet"
        botao_access = page.locator(SELETOR_BOTAO_ACCESS).first
        if botao_access.is_enabled():
            botao_access.click()
            debug(f"Botão 'Access Wallet' clicado. Aguardando {ESPERA_PADRAO/1000}s para validar erro...")
            
            # Aguarda 2 segundos após o clique para o erro aparecer no DOM
            page.wait_for_timeout(ESPERA_PADRAO)

            # Verifica se a mensagem de erro apareceu após a tentativa de acesso
            if page.get_by_text(TEXTO_ERRO_FRASE, exact=False).is_visible(timeout=1000):
                warn("Frase inválida detectada após o clique de acesso.")
                return (False, None)
        else:
            warn("Botão 'Access Wallet' não disponível.")
            return (False, None)
, reset: bool = False) -> None:
    bootstrap_dirs()
    
    # Se reset, limpa os arquivos de progresso
    if reset:
        for f in [SUCESSO_OUT, FALHA_OUT, CHECKPOINT]:
            f.unlink(missing_ok=True)
        success("✓ Histórico de progresso limpo. Iniciando do zero...")
    
    linhas = ler_linhas(arquivo_entrada)
    processadas = ler_processadas()
    
    # Filtra apenas as frases que ainda não foram processadas
    linhas_novas = [l for l in linhas if l.strip() not in processadas]
    
    # Mostra progresso antes de começar
    mostrar_progresso(len(linhas), processadas)t
        balance_container.wait_for(state="visible", timeout=15_000)
        if not balance_container.is_visible():
            warn("Container de Account Balance não encontrado.")
            return (False, None)

        # Extrai dados estruturados do saldo
        dados = balance_container.evaluate("""(el) => {
            const solValue = el.querySelector('.text-3xl')?.innerText || '';
            const usdValue = el.querySelector('.text-2xl')?.innerText || '';
            
            return { solValue, usdValue };
        }""")

        if dados and dados.get('solValue'):
            return (True, dados)
        else:
            warn("Dados de saldo não encontrados.")
            return (False, None)

    except Exception as exc:
        warn(f"Erro: {exc}")
        return (False, None)


def executar_automacao(arquivo_entrada: Path, headless: bool = True) -> None:
    bootstrap_dirs()
    linhas = ler_linhas(arquivo_entrada)
    processadas = ler_processadas()
    
    # Filtra apenas as frases que ainda não foram processadas
    linhas_novas = [l for l in linhas if l.strip() not in processadas]
    total_sucesso = len([l for l in SUCESSO_OUT.read_text(encoding="utf-8").splitlines() if l.strip()]) if SUCESSO_OUT.exists() else 0
        total_falha = len([l for l in FALHA_OUT.read_text(encoding="utf-8").splitlines() if l.strip()]) if FALHA_OUT.exists() else 0
        
        for idx, linha in enumerate(linhas_novas, start=1):
            log(f"[{idx}/{len(linhas_novas)}] Processando frase...")
            
            context = browser.new_context(viewport={'width': 1280, 'height': 720})
            page = context.new_page()
            
            ok, dados = processar_linha(page, linha)

            if ok:
                # ✅ Salva APENAS em sucesso se completou o ciclo
                with open(SUCESSO_OUT, "a", encoding="utf-8") as f:
                    f.write(f"{linha}\n")
                
                registro = {
                    "frase": linha,
                    "timestamp": datetime.now().isoformat(),
                    "saldo_sol": dados.get('solValue', ''),
                    "saldo_usd": dados.get('usdValue', '')
                }
                with open(DADOS_OUT, "a", encoding="utf-8") as f:
                    f.write(json.dumps(registro, ensure_ascii=False) + "\n")
                
                total_sucesso += 1
                success(f"Frase e saldo capturado: {dados.get('solValue', 'N/A')}")
            else:
                # ❌ Salva APENAS em falha se não completou o ciclo
                with open(FALHA_OUT, "a", encoding="utf-8") as f:
                    f.write(f"{linha}\n")
                total_falha += 1
                warn(f"Frase marcada como falha.")
            
            # Atualiza checkpoint a cada linha
            salvar_checkpoint(linha, total_sucesso, total_falha)    }
                with open(DADOS_OUT, "a", encoding="utf-8") as f:
                    f.write(json.dumps(registro, ensure_ascii=False) + "\n")
                
                success(f"Frase e sal
        description="Automação HelioWallet - Processa frases mnemônicas e captura saldos Solana"
    )
    parser.add_argument("arquivo", type=Path, help="Arquivo com frases para processar")
    parser.add_argument("--show", action="store_true", help="Exibe browser (modo não-headless)")
    parser.add_argument("--reset", action="store_true", help="Limpa progresso e começa do zero")
    args = parser.parse_args()
    executar_automacao(args.arquivo, headless=not args.show, reset=args.reset
                warn(f"Frase marcada como falha.")
            
            context.close()

        browser.close()

    success(f"═══ Concluído ═══")
    success(f"Arquivos atualizados em: {OUTPUT_DIR}")


def main():
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument("arquivo", type=Path)
    parser.add_argument("--show", action="store_true")
    args = parser.parse_args()
    executar_automacao(args.arquivo, headless=not args.show)

if __name__ == "__main__":
    main()
