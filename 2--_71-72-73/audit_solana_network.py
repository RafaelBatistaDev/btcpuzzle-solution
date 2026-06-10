#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Auditoria Solana — espelha solana/config/solver.js + verifica saldo real (getBalance).
"""

import sys
import time

from audit_common import (
    AuditResult,
    audit_cache_files,
    audit_env_keys,
    audit_puzzle_targets,
    banner,
    env_int,
    err,
    info,
    load_env,
    mask_secret,
    ok,
    print_summary,
    probe_rpc_health,
    project_root,
    query_solana_wallet_balance,
    run_rate_limit_probe,
    section,
    warn,
    W,
    G,
    RS,
)

SOL_DEFAULTS = {
    71: "4ZJhPQAgUseCsWhKvJLTmmRRUV74fdoTpQLNfKoekbPY",
    72: "9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM",
    73: "7mhcgF1DVsj5iv4CxZDgp51H6MBBwqamsH1KnqXhSRc5",
}


def main() -> int:
    banner("AUDITORIA SOLANA — STACK REAL DO PROJETO")
    result = AuditResult(network="solana")
    env = load_env()
    root = project_root()

    rpc_url = env.get("SOL_RPC_ENDPOINT", "https://api.mainnet-beta.solana.com")
    timeout = env_int(env, "SOL_TIMEOUT_MS", "TIMEOUT_MS", default=3000) / 1000.0
    delay_ms = env_int(env, "SOL_DELAY_MS", "DELAY_MS", default=110)

    info(f"Endpoint: {mask_secret(rpc_url)}")
    info(f"Timeout: {timeout * 1000:.0f}ms  |  Delay: {delay_ms}ms")

    audit_env_keys(
        result,
        env,
        required=["SOL_RPC_ENDPOINT", "SOL_TARGET_71", "SOL_TARGET_72", "SOL_TARGET_73"],
        optional=["SOL_DELAY_MS", "SOL_BATCH_SIZE", "SOL_TIMEOUT_MS"],
    )

    audit_cache_files(result, root / "solana")
    targets = audit_puzzle_targets(result, env, "SOL", SOL_DEFAULTS)

    section("CONECTIVIDADE (getEpochInfo)")
    healthy, ms, epoch_info = probe_rpc_health(rpc_url, timeout, "getEpochInfo")
    if healthy:
        result.ok("Helius/Solana RPC")
        ok(f"Slot: {epoch_info.get('absoluteSlot', '?')}  [{ms:.0f}ms]")
    else:
        result.fail("RPC Solana inacessível")
        err(f"Falha: {epoch_info}")
        return print_summary(result)

    section("SALDO REAL DOS PUZZLES (getBalance — carteira nativa)")
    for i, (pid, addr) in enumerate(targets.items()):
        if i > 0 and delay_ms > 0:
            time.sleep(delay_ms / 1000.0)
        r = query_solana_wallet_balance(rpc_url, addr, timeout)
        if r.get("ok"):
            sol = r.get("sol", 0)
            cor = G if sol > 0 else RS
            print(
                f"  {W}Puzzle #{pid}{RS}  {addr[:14]}...  "
                f"{cor}{sol:.9f} SOL{RS}  [{r.get('ms', 0):.0f}ms]"
            )
            result.ok(f"getBalance puzzle #{pid}")
        else:
            err(f"Puzzle #{pid}: {r.get('error', r.get('status', 'erro'))}")
            result.fail(f"getBalance puzzle #{pid}")

    section("COMPATIBILIDADE COM SOLVER (getBalance — solver.js)")
    for i, (pid, addr) in enumerate(targets.items()):
        if i > 0 and delay_ms > 0:
            time.sleep(delay_ms / 1000.0)
        r = query_solana_wallet_balance(rpc_url, addr, timeout)
        if r.get("ok"):
            ok(f"Puzzle #{pid}: solver method OK  [{r.get('ms', 0):.0f}ms]")
            result.ok(f"solver method puzzle #{pid}")
        else:
            err(f"Puzzle #{pid}: {r.get('error', r.get('status', 'erro'))}")
            result.fail(f"solver method puzzle #{pid}")

    def _probe() -> tuple[int, object]:
        healthy, _, _ = probe_rpc_health(rpc_url, timeout, "getEpochInfo")
        return (200 if healthy else 0, None)

    run_rate_limit_probe(_probe, bursts=5, result=result)
    return print_summary(result)


if __name__ == "__main__":
    sys.exit(main())
