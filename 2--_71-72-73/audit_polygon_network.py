#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Auditoria Polygon — espelha polygon/config/solver.js
Usa eth_getBalance batch via dRPC (mesmo método do solver).
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
    query_evm_batch_balances,
    run_rate_limit_probe,
    section,
    W,
    G,
    RS,
)

POLYGON_DEFAULTS = {
    71: "0x00000000219ab540356cBB839Cbe05303d7705Fa",
    72: "0xBE0eB53F46cd790Cd13851d5EFf43D12404d33E8",
    73: "0x40B38765696e3d5d8d9d834D8AaD4bB6e418E489",
}


def main() -> int:
    banner("AUDITORIA POLYGON — STACK REAL DO PROJETO")
    result = AuditResult(network="polygon")
    env = load_env()
    root = project_root()

    rpc_url = env.get("POLYGON_RPC_ENDPOINT", "https://polygon-rpc.com")
    timeout = env_int(env, "POLYGON_TIMEOUT_MS", "TIMEOUT_MS", default=5000) / 1000.0
    delay_ms = env_int(env, "POLYGON_DELAY_MS", "DELAY_MS", default=300)
    initial_delay = env_int(env, "POLYGON_INITIAL_DELAY_MS", default=0)

    info(f"Endpoint: {mask_secret(rpc_url)}")
    info(f"Timeout: {timeout * 1000:.0f}ms  |  Delay: {delay_ms}ms")

    audit_env_keys(
        result,
        env,
        required=[
            "POLYGON_RPC_ENDPOINT",
            "POLYGON_TARGET_71",
            "POLYGON_TARGET_72",
            "POLYGON_TARGET_73",
        ],
        optional=["POLYGON_DELAY_MS", "POLYGON_BATCH_SIZE", "POLYGON_TIMEOUT_MS"],
    )

    audit_cache_files(result, root / "polygon")
    targets = audit_puzzle_targets(result, env, "POLYGON", POLYGON_DEFAULTS)
    addresses = [targets[p] for p in (71, 72, 73)]

    if initial_delay > 0:
        time.sleep(initial_delay / 1000.0)

    section("CONECTIVIDADE (eth_blockNumber)")
    healthy, ms, block = probe_rpc_health(rpc_url, timeout, "eth_blockNumber")
    if healthy:
        block_num = int(block, 16) if isinstance(block, str) else block
        result.ok("Polygon dRPC")
        ok(f"Bloco: {block_num}  [{ms:.0f}ms]")
    else:
        result.fail("Polygon RPC inacessível")
        err(f"Falha: {block}")
        return print_summary(result)

    section("SALDOS DOS PUZZLES via eth_getBalance batch (solver.js)")
    if delay_ms > 0:
        time.sleep(delay_ms / 1000.0)

    balances = query_evm_batch_balances(rpc_url, addresses, timeout, "polygon-drpc")
    for i, bal in enumerate(balances):
        pid = 71 + i
        addr = bal.get("address", addresses[i])
        if bal.get("ok"):
            matic = bal.get("balance_native", 0)
            cor = G if matic > 0 else RS
            print(
                f"  {W}Puzzle #{pid}{RS}  {addr[:14]}...  "
                f"{cor}{matic:.8f} POL{RS}  [{bal.get('ms', 0):.0f}ms]"
            )
            result.ok(f"puzzle #{pid}")
        else:
            err(f"Puzzle #{pid}: {bal.get('error', 'erro')}")
            result.fail(f"puzzle #{pid}")

    def _probe() -> tuple[int, object]:
        ok_flag, _, _ = probe_rpc_health(rpc_url, timeout, "eth_blockNumber")
        return (200 if ok_flag else 0, None)

    run_rate_limit_probe(_probe, bursts=5, result=result)
    return print_summary(result)


if __name__ == "__main__":
    sys.exit(main())
