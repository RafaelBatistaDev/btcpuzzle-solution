#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Auditoria Ethereum — espelha ethereum/config/solver.js
Suporta Etherscan balancemulti e Alchemy/dRPC eth_getBalance batch.
"""

import sys
import time

from audit_common import (
    AuditResult,
    audit_cache_files,
    audit_env_keys,
    audit_puzzle_targets,
    banner,
    detect_evm_provider,
    env_int,
    err,
    info,
    load_env,
    mask_secret,
    ok,
    print_summary,
    probe_rpc_health,
    project_root,
    query_ethereum_balances,
    run_rate_limit_probe,
    section,
    warn,
    W,
    G,
    RS,
)

ETH_DEFAULTS = {
    71: "0x00000000219ab540356cBB839Cbe05303d7705Fa",
    72: "0xBE0eB53F46cd790Cd13851d5EFf43D12404d33E8",
    73: "0x40B38765696e3d5d8d9d834D8AaD4bB6e418E489",
}


def main() -> int:
    banner("AUDITORIA ETHEREUM — STACK REAL DO PROJETO")
    result = AuditResult(network="ethereum")
    env = load_env()
    root = project_root()

    rpc_url = env.get("ETH_RPC_ENDPOINT", "https://api.etherscan.io/v2/api")
    api_key = env.get("ETHERSCAN_KEY", "")
    timeout = env_int(env, "ETH_TIMEOUT_MS", "TIMEOUT_MS", default=10000) / 1000.0
    delay_ms = env_int(env, "ETH_DELAY_MS", "DELAY_MS", default=200)
    provider = detect_evm_provider(rpc_url)

    info(f"Provedor: {provider}")
    info(f"Endpoint: {mask_secret(rpc_url)}")
    info(f"Timeout: {timeout * 1000:.0f}ms  |  Delay: {delay_ms}ms")

    audit_env_keys(
        result,
        env,
        required=["ETH_RPC_ENDPOINT", "ETH_TARGET_71", "ETH_TARGET_72", "ETH_TARGET_73"],
        optional=["ETHERSCAN_KEY", "ETH_DELAY_MS", "ETH_BATCH_SIZE", "ETH_TIMEOUT_MS"],
    )

    if provider == "etherscan" and not api_key:
        result.fail("ETHERSCAN_KEY obrigatória para endpoint Etherscan")
        err("ETHERSCAN_KEY ausente")

    audit_cache_files(result, root / "ethereum")
    targets = audit_puzzle_targets(result, env, "ETH", ETH_DEFAULTS)
    addresses = [targets[p] for p in (71, 72, 73)]

    # ── Conectividade ─────────────────────────────────────────────────────────
    section("CONECTIVIDADE")
    if provider == "etherscan":
        balances = query_ethereum_balances(rpc_url, api_key, [addresses[0]], timeout)
        if balances and balances[0].get("ok"):
            result.ok("Etherscan API V2")
            ok(f"Etherscan respondeu em {balances[0].get('ms', 0):.0f}ms")
        else:
            result.fail("Etherscan inacessível")
            err("Falha na API Etherscan")
            return print_summary(result)
    else:
        healthy, ms, block = probe_rpc_health(rpc_url, timeout, "eth_blockNumber")
        if healthy:
            block_num = int(block, 16) if isinstance(block, str) else block
            result.ok(f"RPC {provider}")
            ok(f"eth_blockNumber: bloco {block_num}  [{ms:.0f}ms]")
        else:
            result.fail(f"RPC {provider} inacessível")
            err(f"Falha RPC: {block}")
            return print_summary(result)

    # ── Puzzles ───────────────────────────────────────────────────────────────
    section(f"SALDOS DOS PUZZLES via {provider.upper()} (solver.js)")
    if delay_ms > 0:
        time.sleep(delay_ms / 1000.0)

    balances = query_ethereum_balances(rpc_url, api_key, addresses, timeout)
    for i, bal in enumerate(balances):
        pid = 71 + i
        addr = bal.get("address", addresses[i])
        if bal.get("ok"):
            eth = bal.get("balance_eth", 0)
            cor = G if eth > 0 else RS
            print(
                f"  {W}Puzzle #{pid}{RS}  {addr[:14]}...  "
                f"{cor}{eth:.8f} ETH{RS}  [{bal.get('ms', 0):.0f}ms]"
            )
            result.ok(f"puzzle #{pid}")
        else:
            err(f"Puzzle #{pid}: {bal.get('error', 'erro desconhecido')}")
            result.fail(f"puzzle #{pid}")

    # ── Rate limit ────────────────────────────────────────────────────────────
    if provider != "etherscan":
        def _probe() -> tuple[int, object]:
            ok_flag, _, _ = probe_rpc_health(rpc_url, timeout, "eth_blockNumber")
            return (200 if ok_flag else 0, None)

        run_rate_limit_probe(_probe, bursts=5, result=result)
    else:
        warn("Probe de rate limit omitido para Etherscan (evita gastar quota)")

    return print_summary(result)


if __name__ == "__main__":
    sys.exit(main())
