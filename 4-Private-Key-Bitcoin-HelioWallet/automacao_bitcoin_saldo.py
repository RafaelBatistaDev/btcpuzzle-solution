#!/usr/bin/env python3
# -*- coding: utf-8 -*-
# /// script
# requires-python = ">=3.11"
# dependencies = [
#     "playwright>=1.40.0",
# ]
# ///
"""
Nome do Script  : automacao_bitcoin_saldo.py
Descrição       : Automação HelioWallet com captura de saldo Bitcoin.
                  Dois modos de execução: headless (automação) e visual (debug).
                  Reutiliza arquivos de saída (append) se já existirem.
Autor           : recifecrypto
Versão          : 4.0.0
Compatibilidade : Fedora Kinoite / Silverblue / COSMIC (Atomic)
"""

# ─────────────────────────────────────────────
# 1. IMPORTS
# ─────────────────────────────────────────────
import sys
import json
import logging
import argparse
from datetime import datetime
from pathlib import Path

from playwright.sync_api import sync_playwright, Page, BrowserContext


# ─────────────────────────────────────────────
# 2. CONSTANTES E DIRETÓRIOS
# ─────────────────────────────────────────────
SCRIPT_DIR  = Path(__file__).resolve().parent
LOG_DIR     = SCRIPT_DIR / "logs"
OUTPUT_DIR  = SCRIPT_DIR / "Feito"
LOG_FILE    = LOG_DIR / f"contador_{datetime.now().strftime('%Y%m%d_%H%M%S')}.log"
SUCESSO_OUT = LOG_DIR / "linhas_sucesso_heliowallet.txt"
FALHA_OUT   = LOG_DIR / "linhas_falha_heliowallet.txt"
DADOS_OUT   = LOG_DIR / "dados_completos_heliowallet.jsonl"
CHECKPOINT  = LOG_DIR / "checkpoint.json"  # Rastreia progresso

URL           = "https://heliowallet.com/access"
URL_DASHBOARD = "https://heliowallet.com/dashboard"

# Seletores DOM
SELETOR_BOTAO_BTC       = "button:has-text('BTC')"
SELETOR_RECOVERY_PHRASE = "text='Private Key'"
SELETOR_TEXTAREA_FRASE  = "textarea"
SELETOR_BOTAO_ACCESS    = "#access-wallet-btn"
SELETOR_BITCOIN_BALANCE = "div:has-text('Bitcoin Balance')"

TEXTO_ERRO_FRASE = "Invalid mnemonic phrase (must be 12, 15, 18, 21, or 24 words)"

# Timeouts e Delays
TIMEOUT_PAGINA  = 30_000
ESPERA_PADRAO   = 2_000
ESPERA_CAPTURA  = 10_000


# ─────────────────────────────────────────────
# 3. CORES ANSI
# ─────────────────────────────────────────────
class Color:
    G = "\033[1;32m"
    B = "\033[1;34m"
    Y = "\033[1;33m"
    R = "\033[1;31m"
    C = "\033[1;36m"
    N = "\033[0m"


# ─────────────────────────────────────────────
# 4. LOG (Console + Arquivo)
# ─────────────────────────────────────────────
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


logger  = _setup_logging()

def log(msg: str)     -> None: logger.info(f"{Color.B}[INFO]{Color.N}   {msg}")
def success(msg: str) -> None: logger.info(f"{Color.G}[OK]{Color.N}     {msg}")
def warn(msg: str)    -> None: logger.warning(f"{Color.Y}[AVISO]{Color.N} {msg}")
def error(msg: str)   -> None: logger.error(f"{Color.R}[ERRO]{Color.N}  {msg}")
def debug(msg: str)   -> None: logger.debug(f"{Color.C}[DEBUG]{Color.N} {msg}")


# ─────────────────────────────────────────────
# 5. VALIDAÇÃO INICIAL
# ─────────────────────────────────────────────
def bootstrap_dirs() -> None:
    """Cria estrutura de diretórios de forma idempotente."""
    for d in (LOG_DIR, OUTPUT_DIR):
        d.mkdir(parents=True, exist_ok=True)


# ─────────────────────────────────────────────
# HELPERS DE I/O
# ─────────────────────────────────────────────
def ler_linhas(arquivo: Path) -> list[str]:
    """Lê e retorna linhas não vazias do arquivo de entrada."""
    if not arquivo.exists():
        error(f"Arquivo não encontrado: {arquivo}")
        sys.exit(1)
    linhas = [l for l in arquivo.read_text(encoding="utf-8").splitlines() if l.strip()]
    log(f"{len(linhas)} linha(s) carregada(s) [Bitcoin]")
    return linhas


def ler_processadas() -> set[str]:
    """Retorna conjunto de frases já processadas (sucesso ou falha)."""
    processadas: set[str] = set()
    for arquivo in (SUCESSO_OUT, FALHA_OUT):
        if arquivo.exists():
            processadas.update(
                line.strip()
                for line in arquivo.read_text(encoding="utf-8").splitlines()
                if line.strip()
            )
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


def salvar_sucesso(linha: str, dados: dict) -> None:
    """Persiste frase e dados de saldo nos arquivos de saída."""
    with open(SUCESSO_OUT, "a", encoding="utf-8") as f:
        f.write(f"{linha}\n")

    registro = {
        "frase":      linha,
        "timestamp":  datetime.now().isoformat(),
        "saldo_btc":  dados.get("btcValue", ""),
        "saldo_usd":  dados.get("usdValue", ""),
    }
    with open(DADOS_OUT, "a", encoding="utf-8") as f:
        f.write(json.dumps(registro, ensure_ascii=False) + "\n")


def salvar_falha(linha: str) -> None:
    """Persiste frase com falha no arquivo de falhas."""
    with open(FALHA_OUT, "a", encoding="utf-8") as f:
        f.write(f"{linha}\n")


# ─────────────────────────────────────────────
# NÚCLEO DA AUTOMAÇÃO (compartilhado pelos dois modos)
# ─────────────────────────────────────────────
def processar_linha(page: Page, linha: str) -> tuple[bool, dict | None]:
    """
    Executa o fluxo completo de automação para uma frase seed.

    Passos:
        1. Carrega a página e seleciona BTC
        2. Clica em Recovery Phrase
        3. Insere a frase no textarea
        4. Clica em Access Wallet e valida erro de frase inválida
        5. Aguarda renderização do dashboard
        6. Captura e retorna os dados de saldo

    Args:
        page: Instância da página Playwright.
        linha: Frase seed a ser testada.

    Returns:
        Tupla (sucesso: bool, dados: dict | None).
    """
    try:
        # Passo 1 — Carrega página e clica no botão BTC
        page.goto(URL, wait_until="networkidle", timeout=TIMEOUT_PAGINA)
        debug("Página carregada.")

        botao_btc = page.locator(SELETOR_BOTAO_BTC).first
        botao_btc.wait_for(state="visible", timeout=10_000)
        botao_btc.click()
        debug("Botão BTC clicado.")
        page.wait_for_timeout(ESPERA_PADRAO)

        # Passo 2 — Clica em Recovery Phrase
        recovery_div = page.locator(SELETOR_RECOVERY_PHRASE).first
        recovery_div.wait_for(state="visible", timeout=10_000)
        recovery_div.click(force=True)
        debug("Recovery Phrase selecionado.")
        page.wait_for_timeout(ESPERA_PADRAO)

        # Passo 3 — Insere a frase seed
        campo = page.locator(SELETOR_TEXTAREA_FRASE).first
        campo.wait_for(state="visible", timeout=10_000)
        campo.fill(linha)
        debug("Frase inserida.")
        page.wait_for_timeout(1_000)

        # Passo 4 — Clica em Access Wallet e verifica erro de frase inválida
        botao_access = page.locator(SELETOR_BOTAO_ACCESS).first
        if not botao_access.is_enabled():
            warn("Botão 'Access Wallet' não disponível.")
            return (False, None)

        botao_access.click()
        debug(f"Botão 'Access Wallet' clicado. Aguardando {ESPERA_PADRAO / 1000:.0f}s...")
        page.wait_for_timeout(ESPERA_PADRAO)

        if page.get_by_text(TEXTO_ERRO_FRASE, exact=False).is_visible(timeout=1_000):
            warn("Frase inválida detectada.")
            return (False, None)

        # Passo 5 — Aguarda renderização do dashboard
        debug(f"Aguardando {ESPERA_CAPTURA / 1000:.0f}s para o dashboard carregar...")
        page.wait_for_timeout(ESPERA_CAPTURA)

        # Passo 6 — Captura saldo Bitcoin
        balance_container = page.locator(SELETOR_BITCOIN_BALANCE).first
        balance_container.wait_for(state="visible", timeout=15_000)

        if not balance_container.is_visible():
            warn("Container de Bitcoin Balance não encontrado.")
            return (False, None)

        dados: dict = balance_container.evaluate("""(el) => ({
            btcValue: el.querySelector('.text-3xl')?.innerText || '',
            usdValue: el.querySelector('.text-2xl')?.innerText || ''
        })""")

        if dados and dados.get("btcValue"):
            return (True, dados)

        warn("Dados de saldo não encontrados no DOM.")
        return (False, None)

    except Exception as exc:
        warn(f"Exceção durante processamento: {exc}")
        return (False, None)


# ─────────────────────────────────────────────
# MODO 1 — HEADLESS (automação silenciosa)
# ─────────────────────────────────────────────
def executar_headless(arquivo_entrada: Path, reset: bool = False) -> None:
    """
    Executa a automação em modo headless (sem janela visível).
    Ideal para produção e execuções longas em background.

    Args:
        arquivo_entrada: Path para o arquivo com as frases seed.
        reset: Se True, limpa o histórico e começa do zero.
    """
    log("Modo: HEADLESS (sem janela do browser)")
    _executar(arquivo_entrada, headless=True, reset=reset)


# ─────────────────────────────────────────────
# MODO 2 — VISUAL (com janela do browser)
# ─────────────────────────────────────────────
def executar_visual(arquivo_entrada: Path, reset: bool = False) -> None:
    """
    Executa a automação com janela do browser visível.
    Ideal para debug, validação de seletores e desenvolvimento.

    Args:
        arquivo_entrada: Path para o arquivo com as frases seed.
        reset: Se True, limpa o histórico e começa do zero.
    """
    log("Modo: VISUAL (browser visível para debug)")
    _executar(arquivo_entrada, headless=False, reset=reset)


# ─────────────────────────────────────────────
# ORQUESTRADOR INTERNO (compartilhado)
# ─────────────────────────────────────────────
def _executar(arquivo_entrada: Path, headless: bool, reset: bool = False) -> None:
    """
    Lógica principal de orquestração compartilhada entre os dois modos.

    Args:
        arquivo_entrada: Path para o arquivo de frases.
        headless:        True = sem janela; False = com janela visível.
        reset:           Se True, limpa todo o histórico e começa do zero.
    """
    bootstrap_dirs()

    # Se reset, limpa os arquivos de progresso
    if reset:
        for f in [SUCESSO_OUT, FALHA_OUT, CHECKPOINT]:
            f.unlink(missing_ok=True)
        success("✓ Histórico de progresso limpo. Iniciando do zero...")

    linhas      = ler_linhas(arquivo_entrada)
    processadas = ler_processadas()
    novas       = [l for l in linhas if l.strip() not in processadas]

    # Mostra progresso antes de começar
    mostrar_progresso(len(linhas), processadas)

    if not novas:
        log("✓ Todas as frases já foram processadas. Nada a fazer.")
        return

    total = len(novas)
    log(f"Iniciando — {total} frase(s) nova(s) para processar.")

    # Lê contadores existentes
    total_sucesso = len([l for l in SUCESSO_OUT.read_text(encoding="utf-8").splitlines() if l.strip()]) if SUCESSO_OUT.exists() else 0
    total_falha = len([l for l in FALHA_OUT.read_text(encoding="utf-8").splitlines() if l.strip()]) if FALHA_OUT.exists() else 0

    with sync_playwright() as pw:
        browser = pw.firefox.launch(headless=headless)

        for idx, linha in enumerate(novas, start=1):
            log(f"[{idx}/{total}] Processando frase...")

            context: BrowserContext = browser.new_context(
                viewport={"width": 1280, "height": 720}
            )
            page = context.new_page()

            ok, dados = processar_linha(page, linha)

            if ok and dados:
                salvar_sucesso(linha, dados)
                total_sucesso += 1
                success(f"Saldo capturado → BTC: {dados.get('btcValue', 'N/A')} | USD: {dados.get('usdValue', 'N/A')}")
            else:
                salvar_falha(linha)
                total_falha += 1
                warn("Frase marcada como falha.")

            # Atualiza checkpoint a cada linha
            salvar_checkpoint(linha, total_sucesso, total_falha)

            context.close()

        browser.close()

    success("═══ Automação concluída ═══")
    success(f"Resultados em: {LOG_DIR}")


# ─────────────────────────────────────────────
# ENTRY POINT
# ─────────────────────────────────────────────
def main() -> None:
    parser = argparse.ArgumentParser(
        description="Automação HelioWallet — captura de saldo Bitcoin",
        formatter_class=argparse.RawTextHelpFormatter,
    )
    parser.add_argument(
        "arquivo",
        type=Path,
        help="Arquivo .txt com as frases seed (uma por linha)",
    )
    parser.add_argument(
        "--show",
        action="store_true",
        default=False,
        help=(
            "Abre o browser com janela visível (modo debug).\n"
            "Sem esta flag: executa em modo headless (automação silenciosa)."
        ),
    )
    parser.add_argument(
        "--reset",
        action="store_true",
        default=False,
        help="Limpa todo o histórico de progresso e começa do zero",
    )

    args = parser.parse_args()

    if args.show:
        executar_visual(args.arquivo, reset=args.reset)
    else:
        executar_headless(args.arquivo, reset=args.reset)


if __name__ == "__main__":
    main()