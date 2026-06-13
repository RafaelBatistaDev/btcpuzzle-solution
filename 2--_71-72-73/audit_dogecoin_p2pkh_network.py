#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Auditoria Dogecoin P2PKH — espelha dogecoin_p2pkh/config/solver.js"""

import sys
import time

from audit_common import (
    AuditResult,
    audit_cache_files,
    audit_env_keys,
    audit_puzzle_targets,
    banner,
    detect_dogecoin_provider,
    env_int,
    err,
    info,
    load_env,
    ok,
    print_dogecoin_result,
    print_summary,
    project_root,
    query_dogecoin_balance,
    run_rate_limit_probe,
    section,
    warn,
)

DOGE_P2PKH_DEFAULTS = {
    71: "D6X5ogrzSKT3S4bhYHoWGuNATqBX9oCUYL",
    72: "DCqCy2tAVsSodAAkAcHAhT2j7aqjrk4ezo",
    73: "D8dcAmiSURMLozKLMKCr3VYQEWYFLPpQWA",
}


def main() -> int:
    banner("AUDITORIA DOGECOIN P2PKH — STACK REAL DO PROJETO")
    result = AuditResult(network="dogecoin_p2pkh")
    env = load_env()
    root = project_root()

    base_url = (
        env.get("DOGE_BLOCKCHAIN_INFO_BASE_URL")
        or "https://dogecoin.atomicwallet.io/api/v2/address"
    ).rstrip("/")
    timeout = env_int(env, "DOGE_P2PKH_TIMEOUT_MS", "DOGE_TIMEOUT_MS", "TIMEOUT_MS", default=3000) / 1000.0
    delay_ms = env_int(
        env, "DOGE_P2PKH_DELAY_MS", "DOGE_DELAY_MS", "DELAY_MS", default=1200
    )
    batch_size = env_int(env, "DOGE_P2PKH_BATCH_SIZE", "BATCH_SIZE", default=20)
    provider = detect_dogecoin_provider(base_url)

    info(f"Provedor detectado: {provider}")
    info(f"Endpoint: {base_url}")
    info(f"Timeout:  {timeout * 1000:.0f}ms  |  Delay: {delay_ms}ms  |  Batch: {batch_size}")

    audit_env_keys(
        result,
        env,
        required=[
            "DOGE_BLOCKCHAIN_INFO_BASE_URL",
            "DOGE_P2PKH_TARGET_71",
            "DOGE_P2PKH_TARGET_72",
            "DOGE_P2PKH_TARGET_73",
        ],
        optional=[
            "DOGE_P2PKH_DELAY_MS", "DOGE_P2PKH_BATCH_SIZE", "DOGE_P2PKH_TIMEOUT_MS",
            "DOGE_P2PKH_MAX_REQ_24H", "DOGE_DELAY_MS",
        ],
    )

    audit_cache_files(result, root / "dogecoin_p2pkh")
    targets = audit_puzzle_targets(result, env, "DOGE_P2PKH", DOGE_P2PKH_DEFAULTS)

    section("CONECTIVIDADE COM A API")
    probe_addr = targets[71] or DOGE_P2PKH_DEFAULTS[71]
    r = query_dogecoin_balance(base_url, probe_addr, timeout, env)
    if r["ok"]:
        result.ok(f"conectividade via {provider}")
        ok(f"API respondeu em {r['ms']:.0f}ms  (probe P2PKH)")
    else:
        result.fail(f"conectividade falhou: HTTP {r['status']}")
        err(f"Falha ao consultar probe: HTTP {r['status']}")
        return print_summary(result)

    section("VALIDAÇÃO DO FORMATO DE RESPOSTA (solver.js)")
    if provider == "blockcypher":
        ok("Campos esperados: balance, final_balance, n_tx")
    elif provider == "atomicwallet":
        ok("Campos esperados: balance, unconfirmedBalance")
    elif provider == "alchemy":
        ok("Campos esperados: balance, unconfirmedBalance, txs (Blockbook v2)")

    section("SALDOS DOS PUZZLES 71, 72, 73 (API REAL)")
    latencies: list[float] = []
    for i, (pid, addr) in enumerate(targets.items()):
        if not addr:
            continue
        if i > 0 and delay_ms > 0:
            time.sleep(delay_ms / 1000.0)
        r = query_dogecoin_balance(base_url, addr, timeout, env)
        print_dogecoin_result(f"Puzzle #{pid}", r)
        if r["ok"]:
            result.ok(f"puzzle #{pid}")
            latencies.append(r["ms"])
        else:
            result.fail(f"puzzle #{pid}: HTTP {r['status']}")

    if latencies:
        info(f"Latência média: {sum(latencies) / len(latencies):.0f}ms")

    section(f"SIMULAÇÃO DE BATCH ({batch_size} endereços)")
    probe = DOGE_P2PKH_DEFAULTS[71]
    batch_addrs = [targets.get(p) or DOGE_P2PKH_DEFAULTS[p] for p in (71, 72, 73)]
    while len(batch_addrs) < batch_size:
        batch_addrs.append(probe)

    t0 = time.time()
    batch_ok = 0
    for i, addr in enumerate(batch_addrs[:batch_size]):
        if i > 0 and delay_ms > 0:
            time.sleep(delay_ms / 1000.0)
        r = query_dogecoin_balance(base_url, addr, timeout, env)
        if r["ok"]:
            batch_ok += 1
        if r["status"] == 429:
            warn(f"Rate limit no endereço {i + 1} — interrompendo batch")
            result.warn("rate limit no batch simulado")
            break
    elapsed = (time.time() - t0) * 1000
    ok(f"Processados: {batch_ok}/{batch_size}  em {elapsed:.0f}ms")
    if batch_ok == batch_size:
        result.ok("batch simulado")

    def _probe() -> tuple[int, object]:
        r = query_dogecoin_balance(base_url, probe_addr, timeout, env)
        status = 200 if r["ok"] else (r["status"] if isinstance(r["status"], int) else 0)
        return (status, r)

    run_rate_limit_probe(_probe, bursts=5, result=result)

    return print_summary(result)


if __name__ == "__main__":
    sys.exit(main())
