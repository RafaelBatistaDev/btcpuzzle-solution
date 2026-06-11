#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Auditoria Bitcoin P2WPKH (SegWit) — espelha bitcoin_P2WPKH/config/solver.js
Mesma API do P2PKH, targets bech32 (bc1...) do .env.
"""

import sys
import time

from audit_common import (
    AuditResult,
    audit_cache_files,
    audit_env_keys,
    audit_puzzle_targets,
    banner,
    detect_bitcoin_provider,
    env_int,
    err,
    info,
    load_env,
    ok,
    print_bitcoin_result,
    print_summary,
    project_root,
    query_bitcoin_balance,
    run_rate_limit_probe,
    section,
)

BTC_WPKH_DEFAULTS = {
    71: "bc1q0j55cut9nd2c88tnnsfultdx696c8lt6n4n0su",
    72: "bc1ql49ydapnjafl5t2cp9zqpjwe6pdgmxy98859v2",
    73: "bc1qazcm763858nkj2dj986etajv6wquslv8uxwczt",
}


def main() -> int:
    banner("AUDITORIA BITCOIN P2WPKH (SegWit) — STACK REAL DO PROJETO")
    result = AuditResult(network="bitcoin_P2WPKH")
    env = load_env()
    root = project_root()

    base_url = (
        env.get("BLOCKCHAIN_INFO_BASE_URL")
        or "https://blockchain.info"
    ).rstrip("/")
    timeout = env_int(env, "BTC_P2WPKH_TIMEOUT_MS", "BTC_TIMEOUT_MS", "TIMEOUT_MS", default=3000) / 1000.0
    delay_ms = env_int(
        env, "BTC_P2WPKH_DELAY_MS", "BTC_DELAY_MS", "BTC_PUBLIC_API_DELAY_MS", "DELAY_MS", default=1200
    )
    provider = detect_bitcoin_provider(base_url)

    info(f"Provedor: {provider}  |  Endpoint: {base_url}")
    info(f"Timeout: {timeout * 1000:.0f}ms  |  Delay: {delay_ms}ms")

    audit_env_keys(
        result,
        env,
        required=[
            "BLOCKCHAIN_INFO_BASE_URL",
            "BTC_P2WPKH_TARGET_71",
            "BTC_P2WPKH_TARGET_72",
            "BTC_P2WPKH_TARGET_73",
        ],
        optional=[
            "BTC_P2WPKH_DELAY_MS", "BTC_P2WPKH_BATCH_SIZE", "BTC_P2WPKH_TIMEOUT_MS",
            "BTC_DELAY_MS",
        ],
    )

    audit_cache_files(result, root / "bitcoin_P2WPKH")
    targets = audit_puzzle_targets(result, env, "BTC_P2WPKH", BTC_WPKH_DEFAULTS)

    section("CONECTIVIDADE E SALDOS DOS PUZZLES (bc1...)")
    probe_addr = targets[71]
    latencies: list[float] = []

    for i, (pid, addr) in enumerate(targets.items()):
        if i > 0 and delay_ms > 0:
            time.sleep(delay_ms / 1000.0)
        r = query_bitcoin_balance(base_url, addr, timeout, env)
        print_bitcoin_result(f"Puzzle #{pid}", r)
        if r["ok"]:
            result.ok(f"puzzle #{pid}")
            latencies.append(r["ms"])
        else:
            result.fail(f"puzzle #{pid}: HTTP {r['status']}")
            err(f"Puzzle #{pid} falhou: HTTP {r['status']}")

    if not latencies:
        return print_summary(result)

    info(f"Latência média: {sum(latencies) / len(latencies):.0f}ms")

    def _probe() -> tuple[int, object]:
        r = query_bitcoin_balance(base_url, probe_addr, timeout, env)
        status = 200 if r["ok"] else (r["status"] if isinstance(r["status"], int) else 0)
        return (status, r)

    run_rate_limit_probe(_probe, bursts=5, result=result)
    return print_summary(result)


if __name__ == "__main__":
    sys.exit(main())
