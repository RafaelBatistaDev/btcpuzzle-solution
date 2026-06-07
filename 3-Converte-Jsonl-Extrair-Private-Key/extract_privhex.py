#!/usr/bin/env python3
# /// script
# requires-python = ">=3.11"
# ///
# -*- coding: utf-8 -*-
"""
Extrator de privHex — batch_history.jsonl
Lê o arquivo JSONL e extrai o campo privHex de cada linha válida,
gravando um endereço por linha no arquivo de saída.
"""

# ─────────────────────────────────────────────
# 1. IMPORTS
# ─────────────────────────────────────────────
import sys
import json
import logging
import argparse
from pathlib import Path
from datetime import datetime

# ─────────────────────────────────────────────
# 2. CONSTANTES
# ─────────────────────────────────────────────
USER_HOME   = Path.home()
LOG_DIR     = USER_HOME / ".local" / "log"
LOG_FILE    = LOG_DIR / f"extract_privhex_{datetime.now().strftime('%Y%m%d_%H%M%S')}.log"
DEFAULT_IN  = Path("batch_history.jsonl")
DEFAULT_OUT = Path("privhex_output.txt")

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
# 4. LOGGING (console + arquivo)
# ─────────────────────────────────────────────
def _setup_logging() -> logging.Logger:
    LOG_DIR.mkdir(parents=True, exist_ok=True)
    logger = logging.getLogger("extract_privhex")
    logger.setLevel(logging.DEBUG)

    fh = logging.FileHandler(LOG_FILE, encoding="utf-8")
    fh.setFormatter(logging.Formatter("[%(levelname)s] %(asctime)s — %(message)s"))

    ch = logging.StreamHandler(sys.stdout)
    ch.setFormatter(logging.Formatter("%(message)s"))

    logger.addHandler(fh)
    logger.addHandler(ch)
    return logger

logger = _setup_logging()

def log(msg: str)     -> None: logger.info(f"{Color.B}[INFO]{Color.N}   {msg}")
def success(msg: str) -> None: logger.info(f"{Color.G}[OK]{Color.N}     {msg}")
def warn(msg: str)    -> None: logger.warning(f"{Color.Y}[AVISO]{Color.N} {msg}")
def error(msg: str)   -> None: logger.error(f"{Color.R}[ERRO]{Color.N}  {msg}")

# ─────────────────────────────────────────────
# 5. VALIDAÇÃO
# ─────────────────────────────────────────────
def validar_entrada(path: Path) -> None:
    """
    Valida que o arquivo de entrada existe e não está vazio.

    Args:
        path: Caminho para o arquivo JSONL de entrada.

    Raises:
        SystemExit: Se o arquivo não existir ou estiver vazio.
    """
    if not path.exists():
        error(f"Arquivo não encontrado: {path}")
        sys.exit(1)
    if path.stat().st_size == 0:
        error(f"Arquivo vazio: {path}")
        sys.exit(1)
    log(f"Arquivo de entrada validado: {path}")


# ─────────────────────────────────────────────
# FUNÇÕES PRINCIPAIS
# ─────────────────────────────────────────────
def extrair_privhex(input_path: Path, output_path: Path) -> None:
    """
    Extrai o campo privHex de cada linha do JSONL e salva no arquivo de saída.

    Args:
        input_path:  Caminho para o arquivo batch_history.jsonl.
        output_path: Caminho para o arquivo de saída .txt.
    """
    total = 0
    extraidos = 0
    erros = 0

    log(f"Iniciando extração: {input_path} → {output_path}")

    with (
        input_path.open("r", encoding="utf-8") as fin,
        output_path.open("w", encoding="utf-8") as fout,
    ):
        for num_linha, linha in enumerate(fin, start=1):
            linha = linha.strip()
            if not linha:
                continue

            total += 1

            try:
                registro = json.loads(linha)
            except json.JSONDecodeError as e:
                warn(f"Linha {num_linha}: JSON inválido — {e}")
                erros += 1
                continue

            priv_hex = registro.get("privHex")

            if priv_hex is None:
                warn(f"Linha {num_linha}: campo 'privHex' ausente — pulando.")
                erros += 1
                continue

            fout.write(priv_hex + "\n")
            extraidos += 1

    success(f"Extração concluída.")
    log(f"  Linhas processadas : {total}")
    log(f"  privHex extraídos  : {extraidos}")
    log(f"  Erros/ignorados    : {erros}")
    log(f"  Saída gravada em   : {output_path}")
    log(f"  Log em             : {LOG_FILE}")


# ─────────────────────────────────────────────
# ENTRY POINT
# ─────────────────────────────────────────────
def main() -> None:
    parser = argparse.ArgumentParser(
        description="Extrai campo privHex de batch_history.jsonl para arquivo .txt"
    )
    parser.add_argument(
        "-i", "--input",
        type=Path,
        default=DEFAULT_IN,
        help=f"Arquivo JSONL de entrada (padrão: {DEFAULT_IN})",
    )
    parser.add_argument(
        "-o", "--output",
        type=Path,
        default=DEFAULT_OUT,
        help=f"Arquivo TXT de saída (padrão: {DEFAULT_OUT})",
    )
    args = parser.parse_args()

    validar_entrada(args.input)
    extrair_privhex(args.input, args.output)


if __name__ == "__main__":
    main()
