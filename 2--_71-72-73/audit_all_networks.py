#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Auditoria mestre — executa todos os scripts de rede em sequência.
"""

import subprocess
import sys
from pathlib import Path

from audit_common import W, C, RS, G, R, Y

AUDITS = [
    ("Bitcoin P2PKH",       "audit_bitcoin_network.py"),
    ("Bitcoin P2WPKH",      "audit_bitcoin2_network.py"),
    ("Bitcoin P2SH-P2WPKH", "audit_bitcoin3_network.py"),
    ("Litecoin P2PKH",      "audit_litecoin_p2pkh_network.py"),
    ("Litecoin P2SH-P2WPKH","audit_litecoin_p2sh_network.py"),
    ("Dogecoin P2PKH",      "audit_dogecoin_p2pkh_network.py"),
    ("Dogecoin P2SH-P2WPKH","audit_dogecoin_p2sh_network.py"),
    ("Ethereum",            "audit_ethereum_network.py"),
    ("Solana",         "audit_solana_network.py"),
    ("Polygon",        "audit_polygon_network.py"),
    ("BNB Chain",      "audit_bnb_network.py"),
]


def main() -> int:
    root = Path(__file__).parent.resolve()
    print(f"\n{W}{C}╔══════════════════════════════════════════════════════════════╗")
    print(f"║       AUDITORIA MESTRE — TODAS AS REDES DO PROJETO           ║")
    print(f"╚══════════════════════════════════════════════════════════════╝{RS}\n")

    results: list[tuple[str, int]] = []

    for label, script in AUDITS:
        script_path = root / script
        print(f"\n{W}▶ Iniciando: {label}{RS} ({script})")
        proc = subprocess.run(
            [sys.executable, str(script_path)],
            cwd=str(root),
        )
        results.append((label, proc.returncode))

    print(f"\n{W}{C}{'═' * 68}")
    print(f"  RESUMO CONSOLIDADO")
    print(f"{'═' * 68}{RS}")

    failures = 0
    for label, code in results:
        if code == 0:
            print(f"  {G}✔{RS}  {label}")
        else:
            print(f"  {R}✘{RS}  {label}  (exit {code})")
            failures += 1

    print(f"\n  Total: {len(results) - failures}/{len(results)} redes aprovadas")
    if failures:
        print(f"  {R}{failures} rede(s) com falhas{RS}\n")
        return 1
    print(f"  {G}Todas as auditorias passaram{RS}\n")
    return 0


if __name__ == "__main__":
    sys.exit(main())
