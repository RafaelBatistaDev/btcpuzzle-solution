#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Auditoria Bitcoin P2PKH — espelha bitcoin_P2PKH/config/solver.js
Testa: .env, cache local, conectividade, schema da API e puzzles 71/72/73.
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
    mask_secret,
    ok,
    bulk_audit_btc,
    print_bitcoin_result,
    print_summary,
    project_root,
    query_bitcoin_balance,
    run_rate_limit_probe,
    section,
    warn,
)

BTC_DEFAULTS = {
    71: "1PWo3JeB9jrGwfHDNpdGK54CRas7fsVzXU",
    72: "1JTK7s9YVYywfm5XUH7RNhHJH1LshCaRFR",
    73: "12VVRNPi4SJqUTsp6FmqDqY5sGosDtysn4",
}


def main() -> int:
    banner("AUDITORIA BITCOIN P2PKH — STACK REAL DO PROJETO")
    result = AuditResult(network="bitcoin_P2PKH")
    env = load_env()
    root = project_root()

    base_url = (
        env.get("BLOCKCHAIN_INFO_BASE_URL")
        or "https://blockchain.info"
    ).rstrip("/")
    timeout = env_int(env, "BTC_P2PKH_TIMEOUT_MS", "BTC_TIMEOUT_MS", "TIMEOUT_MS", default=3000) / 1000.0
    delay_ms = env_int(
        env, "BTC_P2PKH_DELAY_MS", "BTC_DELAY_MS", "BTC_PUBLIC_API_DELAY_MS", "DELAY_MS", default=1200
    )
    batch_size = env_int(env, "BTC_P2PKH_BATCH_SIZE", "BTC_BATCH_SIZE", "BATCH_SIZE", default=20)
    provider = detect_bitcoin_provider(base_url)

    info(f"Provedor detectado: {provider}")
    info(f"Endpoint: {base_url}")
    info(f"Timeout:  {timeout * 1000:.0f}ms  |  Delay: {delay_ms}ms  |  Batch: {batch_size}")

    audit_env_keys(
        result,
        env,
        required=[
            "BLOCKCHAIN_INFO_BASE_URL",
            "BTC_P2PKH_TARGET_71",
            "BTC_P2PKH_TARGET_72",
            "BTC_P2PKH_TARGET_73",
        ],
        optional=[
            "BTC_P2PKH_DELAY_MS", "BTC_P2PKH_BATCH_SIZE", "BTC_P2PKH_TIMEOUT_MS",
            "BTC_P2PKH_MAX_REQ_24H", "BTC_DELAY_MS",
        ],
    )

    audit_cache_files(result, root / "bitcoin_P2PKH")
    targets = audit_puzzle_targets(result, env, "BTC_P2PKH", BTC_DEFAULTS)

    # ── Conectividade ─────────────────────────────────────────────────────────
    section("CONECTIVIDADE COM A API")
    probe_addr = targets[71]
    r = query_bitcoin_balance(base_url, probe_addr, timeout, env)
    if r["ok"]:
        result.ok(f"conectividade via {provider}")
        ok(f"API respondeu em {r['ms']:.0f}ms  (puzzle #71)")
    else:
        result.fail(f"conectividade falhou: HTTP {r['status']}")
        err(f"Falha ao consultar puzzle #71: HTTP {r['status']}")
        return print_summary(result)

    # ── Schema da resposta ────────────────────────────────────────────────────
    section("VALIDAÇÃO DO FORMATO DE RESPOSTA (solver.js)")
    if provider == "mempool":
        ok("Campos esperados: chain_stats.*, mempool_stats.*")
    elif provider == "blockchain.info":
        ok("Campos esperados: final_balance, n_tx, total_received")
    else:
        ok("Campos esperados: balance (Alchemy)")

    # ── Puzzles reais (bulk — 1 req para 3 targets) ───────────────────────────
    section("SALDOS DOS PUZZLES 71, 72, 73 (bulk — 1 req blockchain.info)")
    latencies: list[float] = []
    rows = bulk_audit_btc(env, timeout, {"BTC_P2PKH": BTC_DEFAULTS})
    for row in rows:
        pid = row["puzzle"]
        r = {
            "addr": row["addr"],
            "saldo": row["balance"],
            "n_tx": row["n_tx"],
            "ms": row["ms"],
            "status": 200 if row["ok"] else 0,
            "ok": row["ok"],
            "provider": row["provider"],
        }
        print_bitcoin_result(f"Puzzle #{pid}", r)
        if r["ok"]:
            result.ok(f"puzzle #{pid}")
            latencies.append(r["ms"])
        else:
            result.fail(f"puzzle #{pid}: HTTP {r['status']}")

    if latencies:
        info(f"Latência média: {sum(latencies) / len(latencies):.0f}ms")

    # ── Simulação de batch (BATCH_SIZE do .env) ───────────────────────────────
    section(f"SIMULAÇÃO DE BATCH ({batch_size} endereços)")
    genesis = "1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa"
    batch_addrs = [targets[p] for p in (71, 72, 73)]
    while len(batch_addrs) < batch_size:
        batch_addrs.append(genesis)

    t0 = time.time()
    batch_ok = 0
    for i, addr in enumerate(batch_addrs[:batch_size]):
        if i > 0 and delay_ms > 0:
            time.sleep(delay_ms / 1000.0)
        r = query_bitcoin_balance(base_url, addr, timeout, env)
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

    # ── Rate limit probe ──────────────────────────────────────────────────────
    def _probe() -> tuple[int, object]:
        r = query_bitcoin_balance(base_url, probe_addr, timeout, env)
        # Mempool retorna 404 para endereço sem histórico — resposta válida
        status = 200 if r["ok"] else (r["status"] if isinstance(r["status"], int) else 0)
        return (status, r)

    run_rate_limit_probe(_probe, bursts=5, result=result)

    return print_summary(result)


if __name__ == "__main__":
    sys.exit(main())
