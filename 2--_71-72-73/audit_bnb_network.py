#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Auditoria BNB Chain — espelha bnb/config/solver.js
Usa eth_getBalance batch via BSC RPC (mesmo método do solver).
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

BNB_DEFAULTS = {
    71: "0x00000000219ab540356cBB839Cbe05303d7705Fa",
    72: "0xBE0eB53F46cd790Cd13851d5EFf43D12404d33E8",
    73: "0x40B38765696e3d5d8d9d834D8AaD4bB6e418E489",
}


def main() -> int:
    banner("AUDITORIA BNB CHAIN — STACK REAL DO PROJETO")
    result = AuditResult(network="bnb")
    env = load_env()
    root = project_root()

    rpc_url = env.get("BNB_RPC_ENDPOINT", "https://bsc-dataseed.binance.org")
    timeout = env_int(env, "BNB_TIMEOUT_MS", "TIMEOUT_MS", default=10000) / 1000.0
    delay_ms = env_int(env, "BNB_DELAY_MS", "DELAY_MS", default=200)
    initial_delay = env_int(env, "BNB_INITIAL_DELAY_MS", default=0)
    batch_size = env_int(env, "BNB_BATCH_SIZE", "BATCH_SIZE", default=20)

    info(f"Endpoint: {mask_secret(rpc_url)}")
    info(f"Timeout: {timeout * 1000:.0f}ms  |  Delay: {delay_ms}ms  |  Batch: {batch_size}")

    audit_env_keys(
        result,
        env,
        required=["BNB_RPC_ENDPOINT", "BNB_TARGET_71", "BNB_TARGET_72", "BNB_TARGET_73"],
        optional=["BSCSCAN_KEY", "BNB_DELAY_MS", "BNB_BATCH_SIZE", "BNB_TIMEOUT_MS"],
    )

    audit_cache_files(result, root / "bnb")
    targets = audit_puzzle_targets(result, env, "BNB", BNB_DEFAULTS)
    addresses = [targets[p] for p in (71, 72, 73)]

    if initial_delay > 0:
        time.sleep(initial_delay / 1000.0)

    section("CONECTIVIDADE (eth_blockNumber)")
    healthy, ms, block = probe_rpc_health(rpc_url, timeout, "eth_blockNumber")
    if healthy:
        block_num = int(block, 16) if isinstance(block, str) else block
        result.ok("BSC RPC")
        ok(f"Bloco: {block_num}  [{ms:.0f}ms]")
    else:
        result.fail("BNB RPC inacessível")
        err(f"Falha: {block}")
        return print_summary(result)

    section("SALDOS DOS PUZZLES via eth_getBalance batch (solver.js)")
    if delay_ms > 0:
        time.sleep(delay_ms / 1000.0)

    balances = query_evm_batch_balances(rpc_url, addresses, timeout, "bsc-dataseed")
    for i, bal in enumerate(balances):
        pid = 71 + i
        addr = bal.get("address", addresses[i])
        if bal.get("ok"):
            bnb = bal.get("balance_native", 0)
            cor = G if bnb > 0 else RS
            print(
                f"  {W}Puzzle #{pid}{RS}  {addr[:14]}...  "
                f"{cor}{bnb:.8f} BNB{RS}  [{bal.get('ms', 0):.0f}ms]"
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
