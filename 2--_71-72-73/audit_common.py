#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Utilitários compartilhados para auditoria das redes do Puzzle Solver.
Espelha as chamadas reais de solver.js / balance_verifier.js.
"""

from __future__ import annotations

import json
import sys
import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Callable

import requests

# ─── Cores ────────────────────────────────────────────────────────────────────
G = "\033[92m"
Y = "\033[93m"
R = "\033[91m"
B = "\033[94m"
C = "\033[96m"
W = "\033[1m"
RS = "\033[0m"

PLACEHOLDERS = {
    "YOUR_API_KEY", "your_api_key", "YOUR_KEY", "YourApiKeyToken",
    "SUBSTITUIR", "COLOQUE", "CONFIGURE", "Sua Chave",
}

USER_AGENT = "Puzzle-Solver-Audit/2.0"


@dataclass
class AuditResult:
    """Resultado consolidado de uma auditoria de rede."""

    network: str
    passed: int = 0
    failed: int = 0
    warnings: int = 0
    checks: list[str] = field(default_factory=list)

    def ok(self, msg: str) -> None:
        self.passed += 1
        self.checks.append(f"OK: {msg}")

    def fail(self, msg: str) -> None:
        self.failed += 1
        self.checks.append(f"FAIL: {msg}")

    def warn(self, msg: str) -> None:
        self.warnings += 1
        self.checks.append(f"WARN: {msg}")

    @property
    def success(self) -> bool:
        return self.failed == 0


def project_root() -> Path:
    """Retorna o diretório raiz do projeto."""
    return Path(__file__).parent.resolve()


def load_env() -> dict[str, str]:
    """Carrega variáveis do arquivo .env na raiz do projeto."""
    env_path = project_root() / ".env"
    env: dict[str, str] = {}
    if not env_path.exists():
        return env
    with env_path.open(encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, val = line.split("=", 1)
            env[key.strip()] = val.strip().strip('"').strip("'")
    return env


def env_int(env: dict[str, str], *keys: str, default: int = 0) -> int:
    """Lê inteiro do .env tentando múltiplas chaves em ordem."""
    for key in keys:
        raw = env.get(key)
        if raw is not None and str(raw).strip() != "":
            try:
                return int(raw)
            except ValueError:
                pass
    return default


def mask_secret(value: str, visible: int = 6) -> str:
    """Mascara URLs e chaves para exibição segura em logs."""
    if not value:
        return "(vazio)"
    if "api-key=" in value:
        base, key = value.split("api-key=", 1)
        return f"{base}api-key={key[:visible]}..."
    if "dkey=" in value:
        base, key = value.split("dkey=", 1)
        return f"{base}dkey={key[:visible]}..."
    if value.startswith("http"):
        return value if len(value) <= 48 else f"{value[:48]}..."
    if len(value) <= visible + 2:
        return value
    return f"{value[:visible]}..."


def is_placeholder(value: str | None) -> bool:
    """Verifica se valor de configuração é placeholder inválido."""
    if not value or not str(value).strip():
        return True
    val = str(value).strip()
    return any(p in val for p in PLACEHOLDERS)


def section(title: str) -> None:
    """Imprime cabeçalho de seção."""
    print(f"\n{W}{B}{'═' * 68}")
    print(f"  {title}")
    print(f"{'═' * 68}{RS}")


def ok(msg: str) -> None:
    print(f"  {G}✔  {msg}{RS}")


def warn(msg: str) -> None:
    print(f"  {Y}⚠  {msg}{RS}")


def err(msg: str) -> None:
    print(f"  {R}✘  {msg}{RS}")


def info(msg: str) -> None:
    print(f"  {B}→  {msg}{RS}")


def banner(title: str) -> None:
    """Imprime banner inicial da auditoria."""
    print(f"\n{W}{C}╔══════════════════════════════════════════════════════════════╗")
    print(f"║  {title:<60}║")
    print(f"╚══════════════════════════════════════════════════════════════╝{RS}")


def http_get(
    url: str,
    timeout: float,
    params: dict | None = None,
    headers: dict | None = None,
) -> tuple[int, Any, float]:
    """Executa GET e retorna status, corpo parseado e latência em ms."""
    t0 = time.time()
    req_headers = {"User-Agent": USER_AGENT}
    if headers:
        req_headers.update(headers)
    resp = requests.get(
        url,
        params=params,
        timeout=timeout,
        headers=req_headers,
    )
    ms = (time.time() - t0) * 1000
    try:
        body = resp.json()
    except ValueError:
        body = resp.text
    return resp.status_code, body, ms


def http_post(url: str, timeout: float, payload: Any) -> tuple[int, Any, float]:
    """Executa POST JSON-RPC e retorna status, corpo e latência em ms."""
    t0 = time.time()
    resp = requests.post(
        url,
        json=payload,
        timeout=timeout,
        headers={
            "Content-Type": "application/json",
            "User-Agent": USER_AGENT,
            "Connection": "keep-alive",
        },
    )
    ms = (time.time() - t0) * 1000
    try:
        body = resp.json()
    except ValueError:
        body = resp.text
    return resp.status_code, body, ms


def audit_env_keys(
    result: AuditResult,
    env: dict[str, str],
    required: list[str],
    optional: list[str] | None = None,
) -> None:
    """Valida presença das chaves esperadas no .env."""
    section("INTEGRIDADE DO .env")
    if not env:
        result.fail(".env não encontrado ou vazio")
        warn(".env ausente — usando defaults do config.js")
        return

    if env.get("SEARCH_MODE", "sequential") != "sequential":
        result.fail(f"SEARCH_MODE={env.get('SEARCH_MODE')} — deve ser 'sequential'")
        err("SEARCH_MODE deve ser 'sequential'")
    else:
        result.ok("SEARCH_MODE=sequential")
        ok("SEARCH_MODE=sequential")

    for key in required:
        val = env.get(key)
        if not val:
            result.warn(f"{key} ausente")
            warn(f"{key}: ausente (default do config.js)")
        elif is_placeholder(val):
            result.fail(f"{key} contém placeholder")
            err(f"{key}: placeholder inválido")
        else:
            result.ok(key)
            ok(f"{key} = {W}{mask_secret(val)}{RS}")

    for key in optional or []:
        val = env.get(key)
        if val and not is_placeholder(val):
            ok(f"{key} = {W}{mask_secret(val)}{RS}")


def audit_cache_files(result: AuditResult, network_dir: Path) -> None:
    """Verifica checkpoints e progresso local do solver."""
    section("ESTADO LOCAL DO PROJETO (cache/)")
    cache_dir = network_dir / "cache"
    if not cache_dir.exists():
        result.warn(f"cache/ ausente em {network_dir.name}")
        warn(f"Sem pasta cache em {network_dir.name}")
        return

    for puzzle_id in (71, 72, 73):
        cache_file = cache_dir / f"puzzle_{puzzle_id}.json"
        if not cache_file.exists():
            result.warn(f"puzzle_{puzzle_id}.json ausente")
            warn(f"puzzle_{puzzle_id}.json: não criado ainda")
            continue
        try:
            data = json.loads(cache_file.read_text(encoding="utf-8"))
            last = data.get("lastPrivkey", "?")
            checked = data.get("totalChecked", 0)
            daily = data.get("dailyRequests", {})
            result.ok(f"cache puzzle_{puzzle_id}")
            ok(
                f"puzzle_{puzzle_id}: lastPrivkey={last}  "
                f"totalChecked={checked}  "
                f"reqs_hoje={daily.get('count', '?')}"
            )
        except (json.JSONDecodeError, OSError) as exc:
            result.fail(f"cache puzzle_{puzzle_id} inválido: {exc}")
            err(f"puzzle_{puzzle_id}.json corrompido: {exc}")


def audit_puzzle_targets(
    result: AuditResult,
    env: dict[str, str],
    prefix: str,
    defaults: dict[int, str],
) -> dict[int, str]:
    """Carrega targets dos puzzles 71-73 com fallback para defaults."""
    targets: dict[int, str] = {}
    section("TARGETS DOS PUZZLES")
    for pid in (71, 72, 73):
        key = f"{prefix}_TARGET_{pid}"
        addr = env.get(key) or defaults.get(pid, "")
        targets[pid] = addr
        if addr:
            ok(f"Puzzle #{pid}: {addr}")
        else:
            result.warn(f"{key} ausente")
            warn(f"Puzzle #{pid}: target não configurado")
    return targets


def print_summary(result: AuditResult) -> int:
    """Imprime resumo e retorna exit code."""
    section("RESUMO FINAL")
    status = G + "APROVADO" + RS if result.success else R + "COM FALHAS" + RS
    print(f"  Rede:      {W}{result.network}{RS}")
    print(f"  Status:    {status}")
    print(f"  Passou:    {G}{result.passed}{RS}")
    print(f"  Falhas:    {R}{result.failed}{RS}")
    print(f"  Avisos:    {Y}{result.warnings}{RS}")
    return 0 if result.success else 1


# ─── Bitcoin (espelha bitcoin_P2PKH/config/solver.js) ─────────────────────────

def detect_bitcoin_provider(base_url: str) -> str:
    """Detecta provedor Bitcoin pela URL configurada."""
    url = base_url.lower()
    if "alchemy.com" in url:
        return "alchemy"
    if "mempool.space" in url:
        return "mempool"
    return "blockchain.info"


def mempool_address_url(base_url: str, addr: str) -> str:
    """Monta URL /api/address/{addr} aceitando base com ou sem sufixo /api."""
    root = base_url.rstrip("/")
    if root.endswith("/api"):
        return f"{root}/address/{addr}"
    return f"{root}/api/address/{addr}"


def query_bitcoin_balance(
    base_url: str,
    addr: str,
    timeout: float,
    env: dict[str, str] | None = None,
) -> dict[str, Any]:
    """
    Consulta saldo Bitcoin usando a mesma lógica do solver.js.

    Returns:
        Dict com addr, saldo (sat), n_tx, ms, status, ok, provider.
    """
    base = base_url.rstrip("/")
    provider = detect_bitcoin_provider(base)
    t0 = time.time()

    try:
        if provider == "alchemy":
            status, body, _ = http_get(f"{base}/v1/addresses/{addr}/balance", timeout)
            ms = (time.time() - t0) * 1000
            if status == 429:
                return {"addr": addr, "saldo": None, "n_tx": 0, "ms": ms, "status": 429, "ok": False, "provider": provider}
            if status != 200:
                return {"addr": addr, "saldo": None, "n_tx": 0, "ms": ms, "status": status, "ok": False, "provider": provider}
            saldo = int(body.get("balance", body) if isinstance(body, dict) else body or 0)
            return {"addr": addr, "saldo": saldo, "n_tx": 0, "ms": ms, "status": 200, "ok": True, "provider": provider}

        if provider == "mempool":
            status, body, _ = http_get(mempool_address_url(base, addr), timeout)
            ms = (time.time() - t0) * 1000
            if status == 429:
                return {"addr": addr, "saldo": None, "n_tx": 0, "ms": ms, "status": 429, "ok": False, "provider": provider}
            if status == 404:
                body_text = body if isinstance(body, str) else json.dumps(body)
                if "endpoint does not exist" in body_text:
                    return {"addr": addr, "saldo": None, "n_tx": 0, "ms": ms, "status": 404, "ok": False, "provider": provider}
                return {"addr": addr, "saldo": 0, "n_tx": 0, "ms": ms, "status": 404, "ok": True, "provider": provider}
            if status != 200 or not isinstance(body, dict):
                return {"addr": addr, "saldo": None, "n_tx": 0, "ms": ms, "status": status, "ok": False, "provider": provider}
            cs = body.get("chain_stats", {})
            mp = body.get("mempool_stats", {})
            saldo = (
                cs.get("funded_txo_sum", 0) - cs.get("spent_txo_sum", 0)
                + mp.get("funded_txo_sum", 0) - mp.get("spent_txo_sum", 0)
            )
            n_tx = cs.get("tx_count", 0) + mp.get("tx_count", 0)
            return {"addr": addr, "saldo": saldo, "n_tx": n_tx, "ms": ms, "status": 200, "ok": True, "provider": provider}

        # blockchain.info
        status, body, _ = http_get(f"{base}/balance", timeout, params={"active": addr})
        ms = (time.time() - t0) * 1000
        if status == 429:
            return {"addr": addr, "saldo": None, "n_tx": 0, "ms": ms, "status": 429, "ok": False, "provider": provider}
        if status != 200 or not isinstance(body, dict) or addr not in body:
            return {"addr": addr, "saldo": None, "n_tx": 0, "ms": ms, "status": status, "ok": False, "provider": provider}
        entry = body[addr]
        saldo = int(entry.get("final_balance", 0))
        n_tx = int(entry.get("n_tx", 0))
        return {"addr": addr, "saldo": saldo, "n_tx": n_tx, "ms": ms, "status": 200, "ok": True, "provider": provider}

    except Exception as exc:
        ms = (time.time() - t0) * 1000
        return {"addr": addr, "saldo": None, "n_tx": 0, "ms": ms, "status": str(exc), "ok": False, "provider": provider}


def query_bitcoin_balances_bulk(
    base_url: str,
    addresses: list[str],
    timeout: float,
    env: dict[str, str] | None = None,
) -> dict[str, dict[str, Any]]:
    """
    Bulk blockchain.info — ?active=addr1|addr2|...
    Retorna { addr: { balance, n_tx, ok, ms } }.
    """
    base = base_url.rstrip("/")
    provider = detect_bitcoin_provider(base)
    unique = [a for a in dict.fromkeys(addresses) if a]
    if not unique:
        return {}

    t0 = time.time()
    if provider != "blockchain.info":
        out: dict[str, dict[str, Any]] = {}
        for addr in unique:
            r = query_bitcoin_balance(base_url, addr, timeout, env)
            out[addr] = {
                "balance": r.get("saldo") or 0,
                "n_tx": r.get("n_tx", 0),
                "ok": r.get("ok", False),
                "ms": r.get("ms", 0),
                "provider": provider,
            }
        return out

    active = "|".join(unique)
    status, body, _ = http_get(f"{base}/balance", timeout, params={"active": active})
    ms = (time.time() - t0) * 1000
    out: dict[str, dict[str, Any]] = {}

    if status == 429 or status != 200 or not isinstance(body, dict):
        for addr in unique:
            out[addr] = {"balance": 0, "n_tx": 0, "ok": False, "ms": ms, "provider": provider, "status": status}
        return out

    for addr in unique:
        entry = body.get(addr)
        if entry:
            out[addr] = {
                "balance": int(entry.get("final_balance", 0)),
                "n_tx": int(entry.get("n_tx", 0)),
                "ok": True,
                "ms": ms,
                "provider": provider,
            }
        else:
            out[addr] = {"balance": 0, "n_tx": 0, "ok": False, "ms": ms, "provider": provider}

    return out


BTC_BULK_DEFAULTS: dict[str, dict[int, str]] = {
    "BTC_P2PKH": {
        71: "1PWo3JeB9jrGwfHDNpdGK54CRas7fsVzXU",
        72: "1JTK7s9YVYywfm5XUH7RNhHJH1LshCaRFR",
        73: "12VVRNPi4SJqUTsp6FmqDqY5sGosDtysn4",
    },
    "BTC_P2WPKH": {
        71: "bc1q0j55cut9nd2c88tnnsfultdx696c8lt6n4n0su",
        72: "bc1ql49ydapnjafl5t2cp9zqpjwe6pdgmxy98859v2",
        73: "bc1qazcm763858nkj2dj986etajv6wquslv8uxwczt",
    },
    "BTC_P2SH": {
        71: "36rRUPzhHyrkyNq9PD2B8WpTikki459JRn",
        72: "323Wf631NrQ7MAfdJ1cB6k5kaTfKAK1c7C",
        73: "3Ji9Q4ZX8uKVawfsarpck3RSzaA8rj8R4r",
    },
}


def bulk_audit_btc(
    env: dict[str, str],
    timeout: float,
    defaults: dict[str, dict[int, str]] | None = None,
) -> list[dict[str, Any]]:
    """
    Unifica 9 targets (3 tipos × 3 puzzles) em 1 req blockchain.info bulk.
    Retorna lista com { type, puzzle, addr, balance, n_tx, ok }.
    """
    defs = defaults or BTC_BULK_DEFAULTS
    base_url = (env.get("BLOCKCHAIN_INFO_BASE_URL") or "https://blockchain.info").rstrip("/")
    meta: list[tuple[str, int, str]] = []
    addresses: list[str] = []

    for type_prefix, puzzle_defaults in defs.items():
        for pid in (71, 72, 73):
            key = f"{type_prefix}_TARGET_{pid}"
            addr = env.get(key) or puzzle_defaults.get(pid, "")
            if addr:
                meta.append((type_prefix, pid, addr))
                addresses.append(addr)

    bulk = query_bitcoin_balances_bulk(base_url, addresses, timeout, env)
    rows: list[dict[str, Any]] = []
    for type_prefix, pid, addr in meta:
        entry = bulk.get(addr, {})
        rows.append({
            "type": type_prefix,
            "puzzle": pid,
            "addr": addr,
            "balance": entry.get("balance", 0),
            "n_tx": entry.get("n_tx", 0),
            "ok": entry.get("ok", False),
            "ms": entry.get("ms", 0),
            "provider": entry.get("provider", detect_bitcoin_provider(base_url)),
        })
    return rows


def detect_litecoin_provider(base_url: str) -> str:
    """Detecta provedor Litecoin pela URL configurada."""
    url = base_url.lower()
    if "alchemy.com" in url:
        return "alchemy"
    if "litecoinspace.org" in url:
        return "litecoinspace"
    if "blockcypher.com" in url:
        return "blockcypher"
    if "atomicwallet.io" in url:
        return "atomicwallet"
    return "unknown"


def query_litecoin_balance(
    base_url: str,
    addr: str,
    timeout: float,
    env: dict[str, str] | None = None,
) -> dict[str, Any]:
    """Consulta saldo Litecoin (Litecoinspace, Alchemy, AtomicWallet ou Blockcypher)."""
    base = base_url.rstrip("/")
    provider = detect_litecoin_provider(base)
    t0 = time.time()

    try:
        if provider == "alchemy":
            status, body, _ = http_get(f"{base.rstrip('/')}/api/v2/address/{addr}?details=basic", timeout)
            ms = (time.time() - t0) * 1000
            if status in (401, 429):
                return {"addr": addr, "saldo": None, "n_tx": 0, "ms": ms, "status": status, "ok": False, "provider": provider}
            if status == 404:
                return {"addr": addr, "saldo": 0, "n_tx": 0, "ms": ms, "status": 404, "ok": True, "provider": provider}
            if status != 200 or not isinstance(body, dict) or body.get("error"):
                return {"addr": addr, "saldo": None, "n_tx": 0, "ms": ms, "status": status, "ok": False, "provider": provider}
            saldo = _parse_doge_balance(body.get("balance", 0)) + _parse_doge_balance(body.get("unconfirmedBalance", 0))
            n_tx = int(body.get("txs", 0)) or (1 if saldo > 0 else 0)
            return {"addr": addr, "saldo": saldo, "n_tx": n_tx, "ms": ms, "status": 200, "ok": True, "provider": provider}

        if provider == "litecoinspace":
            status, body, _ = http_get(mempool_address_url(base, addr), timeout)
            ms = (time.time() - t0) * 1000
            if status == 429:
                return {"addr": addr, "saldo": None, "n_tx": 0, "ms": ms, "status": 429, "ok": False, "provider": provider}
            if status == 404:
                return {"addr": addr, "saldo": 0, "n_tx": 0, "ms": ms, "status": 404, "ok": True, "provider": provider}
            if status != 200 or not isinstance(body, dict):
                return {"addr": addr, "saldo": None, "n_tx": 0, "ms": ms, "status": status, "ok": False, "provider": provider}
            cs = body.get("chain_stats", {})
            mp = body.get("mempool_stats", {})
            saldo = (
                cs.get("funded_txo_sum", 0) - cs.get("spent_txo_sum", 0)
                + mp.get("funded_txo_sum", 0) - mp.get("spent_txo_sum", 0)
            )
            n_tx = cs.get("tx_count", 0) + mp.get("tx_count", 0)
            return {"addr": addr, "saldo": saldo, "n_tx": n_tx, "ms": ms, "status": 200, "ok": True, "provider": provider}

        if provider == "blockcypher":
            status, body, _ = http_get(f"{base}/{addr}/balance", timeout)
            ms = (time.time() - t0) * 1000
            if status == 429:
                return {"addr": addr, "saldo": None, "n_tx": 0, "ms": ms, "status": 429, "ok": False, "provider": provider}
            if status == 404:
                return {"addr": addr, "saldo": 0, "n_tx": 0, "ms": ms, "status": 404, "ok": True, "provider": provider}
            if status != 200 or not isinstance(body, dict):
                return {"addr": addr, "saldo": None, "n_tx": 0, "ms": ms, "status": status, "ok": False, "provider": provider}
            saldo = int(body.get("final_balance", body.get("balance", 0)))
            n_tx = int(body.get("n_tx", 0))
            return {"addr": addr, "saldo": saldo, "n_tx": n_tx, "ms": ms, "status": 200, "ok": True, "provider": provider}

        if provider == "atomicwallet":
            root = base.rstrip("/")
            if not root.endswith("/address"):
                root = "https://litecoin.atomicwallet.io/api/v1/address"
            status, body, _ = http_get(f"{root}/{addr}", timeout)
            ms = (time.time() - t0) * 1000
            if status == 429:
                return {"addr": addr, "saldo": None, "n_tx": 0, "ms": ms, "status": 429, "ok": False, "provider": provider}
            if status == 404:
                return {"addr": addr, "saldo": 0, "n_tx": 0, "ms": ms, "status": 404, "ok": True, "provider": provider}
            if status != 200 or not isinstance(body, dict) or body.get("error"):
                return {"addr": addr, "saldo": None, "n_tx": 0, "ms": ms, "status": status, "ok": False, "provider": provider}
            saldo = int(body.get("balance", 0)) + int(body.get("unconfirmedBalance", 0))
            n_tx = int(body.get("txApperances", body.get("txAppearances", 0)))
            return {"addr": addr, "saldo": saldo, "n_tx": n_tx, "ms": ms, "status": 200, "ok": True, "provider": provider}

        return {"addr": addr, "saldo": None, "n_tx": 0, "ms": (time.time() - t0) * 1000, "status": "unknown_provider", "ok": False, "provider": provider}

    except Exception as exc:
        ms = (time.time() - t0) * 1000
        return {"addr": addr, "saldo": None, "n_tx": 0, "ms": ms, "status": str(exc), "ok": False, "provider": provider}


def print_litecoin_result(label: str, r: dict[str, Any]) -> None:
    """Imprime resultado formatado de consulta Litecoin."""
    if not r["ok"]:
        cor = Y if r["status"] == 429 else R
        err(f"{label}  {r['addr'][:16]}...  HTTP {cor}{r['status']}{RS}  [{r['ms']:.0f}ms]")
        return
    saldo = r["saldo"] or 0
    cor = G if saldo > 0 else RS
    tx = f"  {r['n_tx']} tx" if r.get("n_tx") else ""
    print(
        f"  {W}{label}{RS}  {r['addr'][:16]}...  "
        f"{cor}{saldo / 1e8:.8f} LTC{RS} ({saldo} litoshi){tx}  "
        f"[{r['ms']:.0f}ms]  via {r['provider']}"
    )


def detect_dogecoin_provider(base_url: str) -> str:
    """Detecta provedor Dogecoin pela URL configurada."""
    url = base_url.lower()
    if "alchemy.com" in url:
        return "alchemy"
    if "atomicwallet.io" in url:
        return "atomicwallet"
    if "blockcypher.com" in url:
        return "blockcypher"
    return "unknown"


def _atomicwallet_address_url(base_url: str, addr: str) -> str:
    root = base_url.rstrip("/")
    if "/v2/" in root:
        return f"{root}/{addr}?details=basic"
    return f"{root}/{addr}"


def _parse_doge_balance(value: object) -> int:
    """Converte koinu inteiros ou strings decimais DOGE para koinu."""
    if value is None or value == "":
        return 0
    text = str(value).strip()
    if "." in text:
        whole, _, frac = text.partition(".")
        padded = (frac + "00000000")[:8]
        return int(whole or "0") * 100_000_000 + int(padded)
    return int(text)


def query_dogecoin_balance(
    base_url: str,
    addr: str,
    timeout: float,
    env: dict[str, str] | None = None,
) -> dict[str, Any]:
    """Consulta saldo Dogecoin (Alchemy, AtomicWallet/Blockbook ou Blockcypher)."""
    base = base_url.rstrip("/")
    provider = detect_dogecoin_provider(base)
    t0 = time.time()

    try:
        if provider == "blockcypher":
            status, body, _ = http_get(f"{base}/{addr}/balance", timeout)
            ms = (time.time() - t0) * 1000
            if status == 429:
                return {"addr": addr, "saldo": None, "n_tx": 0, "ms": ms, "status": 429, "ok": False, "provider": provider}
            if status == 404:
                return {"addr": addr, "saldo": 0, "n_tx": 0, "ms": ms, "status": 404, "ok": True, "provider": provider}
            if status != 200 or not isinstance(body, dict) or body.get("error"):
                return {"addr": addr, "saldo": None, "n_tx": 0, "ms": ms, "status": status, "ok": False, "provider": provider}
            saldo = int(body.get("final_balance", body.get("balance", 0)))
            n_tx = int(body.get("final_n_tx", body.get("n_tx", 0)))
            return {"addr": addr, "saldo": saldo, "n_tx": n_tx, "ms": ms, "status": 200, "ok": True, "provider": provider}

        if provider == "alchemy":
            status, body, _ = http_get(f"{base.rstrip('/')}/api/v2/address/{addr}?details=basic", timeout)
            ms = (time.time() - t0) * 1000
            if status in (401, 429):
                return {"addr": addr, "saldo": None, "n_tx": 0, "ms": ms, "status": status, "ok": False, "provider": provider}
            if status == 404:
                return {"addr": addr, "saldo": 0, "n_tx": 0, "ms": ms, "status": 404, "ok": True, "provider": provider}
            if status != 200 or not isinstance(body, dict) or body.get("error"):
                return {"addr": addr, "saldo": None, "n_tx": 0, "ms": ms, "status": status, "ok": False, "provider": provider}
            saldo = _parse_doge_balance(body.get("balance", 0)) + _parse_doge_balance(body.get("unconfirmedBalance", 0))
            n_tx = int(body.get("txs", 0)) or (1 if saldo > 0 else 0)
            return {"addr": addr, "saldo": saldo, "n_tx": n_tx, "ms": ms, "status": 200, "ok": True, "provider": provider}

        if provider == "atomicwallet":
            root = base if "atomicwallet.io" in base else "https://dogecoin.atomicwallet.io/api/v2/address"
            status, body, _ = http_get(_atomicwallet_address_url(root, addr), timeout)
            ms = (time.time() - t0) * 1000
            if status == 429:
                return {"addr": addr, "saldo": None, "n_tx": 0, "ms": ms, "status": 429, "ok": False, "provider": provider}
            if status == 404:
                return {"addr": addr, "saldo": 0, "n_tx": 0, "ms": ms, "status": 404, "ok": True, "provider": provider}
            if status != 200 or not isinstance(body, dict) or body.get("error"):
                return {"addr": addr, "saldo": None, "n_tx": 0, "ms": ms, "status": status, "ok": False, "provider": provider}
            saldo = _parse_doge_balance(body.get("balance", 0)) + _parse_doge_balance(body.get("unconfirmedBalance", 0))
            n_tx = int(body.get("txs", 0)) or (1 if saldo > 0 else 0)
            return {"addr": addr, "saldo": saldo, "n_tx": n_tx, "ms": ms, "status": 200, "ok": True, "provider": provider}

        return {"addr": addr, "saldo": None, "n_tx": 0, "ms": (time.time() - t0) * 1000, "status": "unknown_provider", "ok": False, "provider": provider}

    except Exception as exc:
        ms = (time.time() - t0) * 1000
        return {"addr": addr, "saldo": None, "n_tx": 0, "ms": ms, "status": str(exc), "ok": False, "provider": provider}


def print_dogecoin_result(label: str, r: dict[str, Any]) -> None:
    """Imprime resultado formatado de consulta Dogecoin."""
    if not r["ok"]:
        cor = Y if r["status"] == 429 else R
        err(f"{label}  {r['addr'][:16]}...  HTTP {cor}{r['status']}{RS}  [{r['ms']:.0f}ms]")
        return
    saldo = r["saldo"] or 0
    cor = G if saldo > 0 else RS
    tx = f"  {r['n_tx']} tx" if r.get("n_tx") else ""
    print(
        f"  {W}{label}{RS}  {r['addr'][:16]}...  "
        f"{cor}{saldo / 1e8:.8f} DOGE{RS} ({saldo} koinu){tx}  "
        f"[{r['ms']:.0f}ms]  via {r['provider']}"
    )


def print_bitcoin_result(label: str, r: dict[str, Any]) -> None:
    """Imprime resultado formatado de consulta Bitcoin."""
    if not r["ok"]:
        cor = Y if r["status"] == 429 else R
        err(f"{label}  {r['addr'][:16]}...  HTTP {cor}{r['status']}{RS}  [{r['ms']:.0f}ms]")
        return
    saldo = r["saldo"] or 0
    cor = G if saldo > 0 else RS
    tx = f"  {r['n_tx']} tx" if r.get("n_tx") else ""
    print(
        f"  {W}{label}{RS}  {r['addr'][:16]}...  "
        f"{cor}{saldo / 1e8:.8f} BTC{RS} ({saldo} sat){tx}  "
        f"[{r['ms']:.0f}ms]  via {r['provider']}"
    )


# ─── Ethereum (espelha ethereum/config/solver.js) ───────────────────────────────

def detect_evm_provider(rpc_url: str) -> str:
    """Detecta provedor EVM pela URL."""
    url = rpc_url.lower()
    if "etherscan.io" in url:
        return "etherscan"
    if "alchemy.com" in url:
        return "alchemy"
    return "drpc"


def query_ethereum_balances(
    rpc_url: str,
    api_key: str,
    addresses: list[str],
    timeout: float,
) -> list[dict[str, Any]]:
    """Consulta saldos Ethereum com a mesma lógica do solver.js."""
    provider = detect_evm_provider(rpc_url)
    results: list[dict[str, Any]] = []

    if provider == "etherscan":
        addresses_str = ",".join(a.lower() for a in addresses)
        status, body, ms = http_get(
            rpc_url,
            timeout,
            params={
                "chainid": 1,
                "module": "account",
                "action": "balancemulti",
                "address": addresses_str,
                "tag": "latest",
                "apikey": api_key,
            },
        )
        if status == 200 and isinstance(body, dict) and body.get("status") == "1":
            for item in body.get("result", []):
                wei = int(item.get("balance", "0"))
                results.append({
                    "address": item.get("account", ""),
                    "balance_wei": wei,
                    "balance_eth": wei / 1e18,
                    "ms": ms,
                    "ok": True,
                    "provider": "etherscan",
                })
        else:
            msg = body.get("message", status) if isinstance(body, dict) else status
            for addr in addresses:
                results.append({"address": addr, "ok": False, "error": msg, "provider": "etherscan"})
        return results

    payload = [
        {
            "jsonrpc": "2.0",
            "method": "eth_getBalance",
            "params": [addr.lower(), "latest"],
            "id": idx + 1,
        }
        for idx, addr in enumerate(addresses)
    ]
    status, body, ms = http_post(rpc_url, timeout, payload)
    if status == 200 and isinstance(body, list):
        for idx, item in enumerate(body):
            addr = addresses[idx]
            if "result" in item:
                wei = int(item["result"], 16)
                results.append({
                    "address": addr,
                    "balance_wei": wei,
                    "balance_eth": wei / 1e18,
                    "ms": ms,
                    "ok": True,
                    "provider": provider,
                })
            else:
                results.append({
                    "address": addr,
                    "ok": False,
                    "error": item.get("error"),
                    "provider": provider,
                })
    else:
        for addr in addresses:
            results.append({"address": addr, "ok": False, "error": status, "provider": provider})
    return results


# ─── EVM genérico (Polygon / BNB — eth_getBalance batch) ──────────────────────

def query_evm_batch_balances(
    rpc_url: str,
    addresses: list[str],
    timeout: float,
    provider_label: str,
) -> list[dict[str, Any]]:
    """Consulta saldos via eth_getBalance em lote (polygon/bnb solver.js)."""
    payload = [
        {
            "jsonrpc": "2.0",
            "method": "eth_getBalance",
            "params": [addr.lower(), "latest"],
            "id": idx + 1,
        }
        for idx, addr in enumerate(addresses)
    ]
    status, body, ms = http_post(rpc_url, timeout, payload)
    results: list[dict[str, Any]] = []

    if status == 200 and isinstance(body, list):
        for idx, item in enumerate(body):
            addr = addresses[idx]
            if "result" in item:
                wei = int(item["result"], 16)
                results.append({
                    "address": addr,
                    "balance_wei": wei,
                    "balance_native": wei / 1e18,
                    "ms": ms,
                    "ok": True,
                    "provider": provider_label,
                })
            else:
                results.append({
                    "address": addr,
                    "ok": False,
                    "error": item.get("error"),
                    "provider": provider_label,
                })
    elif status == 200 and isinstance(body, dict) and "result" in body:
        wei = int(body["result"], 16)
        results.append({
            "address": addresses[0],
            "balance_wei": wei,
            "balance_native": wei / 1e18,
            "ms": ms,
            "ok": True,
            "provider": provider_label,
        })
    else:
        for addr in addresses:
            results.append({"address": addr, "ok": False, "error": status, "provider": provider_label})
    return results


# ─── Solana (espelha solana/config/solver.js) ─────────────────────────────────

def query_solana_wallet_balance(rpc_url: str, addr: str, timeout: float) -> dict[str, Any]:
    """Consulta saldo nativo SOL via getBalance (endereço de carteira)."""
    t0 = time.time()
    payload = {"jsonrpc": "2.0", "id": 1, "method": "getBalance", "params": [addr]}
    try:
        status, body, _ = http_post(rpc_url, timeout, payload)
        ms = (time.time() - t0) * 1000
        if status == 429:
            return {"addr": addr, "ok": False, "status": 429, "ms": ms, "method": "getBalance"}
        if isinstance(body, dict) and "result" in body:
            lamports = int(body["result"].get("value", 0))
            return {
                "addr": addr,
                "ok": True,
                "lamports": lamports,
                "sol": lamports / 1e9,
                "ms": ms,
                "method": "getBalance",
            }
        return {
            "addr": addr,
            "ok": False,
            "error": body.get("error") if isinstance(body, dict) else body,
            "ms": ms,
            "method": "getBalance",
        }
    except Exception as exc:
        ms = (time.time() - t0) * 1000
        return {"addr": addr, "ok": False, "error": str(exc), "ms": ms, "method": "getBalance"}


def query_solana_batch_balances(
    rpc_url: str,
    addresses: list[str],
    timeout: float,
) -> list[dict[str, Any]]:
    """Consulta saldos Solana via getBalance JSON-RPC batch (1 req)."""
    unique = [a for a in dict.fromkeys(addresses) if a]
    if not unique:
        return []

    t0 = time.time()
    payload = [
        {"jsonrpc": "2.0", "id": idx + 1, "method": "getBalance", "params": [addr]}
        for idx, addr in enumerate(unique)
    ]
    status, body, _ = http_post(rpc_url, timeout, payload)
    ms = (time.time() - t0) * 1000
    results: list[dict[str, Any]] = []

    if status == 429:
        for addr in unique:
            results.append({"addr": addr, "ok": False, "status": 429, "ms": ms, "method": "getBalance"})
        return results

    if isinstance(body, list):
        for idx, item in enumerate(body):
            addr = unique[idx] if idx < len(unique) else ""
            if isinstance(item, dict) and "result" in item:
                lamports = int(item["result"].get("value", 0))
                results.append({
                    "addr": addr,
                    "ok": True,
                    "lamports": lamports,
                    "sol": lamports / 1e9,
                    "ms": ms,
                    "method": "getBalance",
                })
            else:
                results.append({
                    "addr": addr,
                    "ok": False,
                    "error": item.get("error") if isinstance(item, dict) else item,
                    "ms": ms,
                    "method": "getBalance",
                })
    return results


def query_solana_solver_balance(rpc_url: str, addr: str, timeout: float) -> dict[str, Any]:
    """
    Consulta via getTokenAccountBalance — mesmo método do solver.js.
    """
    t0 = time.time()
    payload = {
        "jsonrpc": "2.0",
        "id": 1,
        "method": "getTokenAccountBalance",
        "params": [addr],
    }
    try:
        status, body, _ = http_post(rpc_url, timeout, payload)
        ms = (time.time() - t0) * 1000
        if status == 429:
            return {"addr": addr, "ok": False, "status": 429, "ms": ms, "method": "getTokenAccountBalance"}
        if not isinstance(body, dict):
            return {"addr": addr, "ok": False, "status": status, "ms": ms, "method": "getTokenAccountBalance"}
        if "result" in body:
            amount = int(body["result"].get("amount", "0"))
            ui = body["result"].get("uiAmount", 0) or 0
            return {
                "addr": addr,
                "ok": True,
                "lamports": amount,
                "sol": ui,
                "ms": ms,
                "method": "getTokenAccountBalance",
                "note": "token account",
            }
        error = body.get("error", {})
        msg = str(error.get("message", ""))
        if error.get("code") == -32602 and "could not find account" in msg:
            return {
                "addr": addr,
                "ok": True,
                "lamports": 0,
                "sol": 0.0,
                "ms": ms,
                "method": "getTokenAccountBalance",
                "note": "conta não inicializada (saldo zero)",
            }
        if error.get("code") == -32602 and "not a Token account" in msg:
            return {
                "addr": addr,
                "ok": False,
                "error": error,
                "ms": ms,
                "method": "getTokenAccountBalance",
                "note": "endereço é carteira, não token account — solver pode falhar",
            }
        return {"addr": addr, "ok": False, "error": error, "ms": ms, "method": "getTokenAccountBalance"}
    except Exception as exc:
        ms = (time.time() - t0) * 1000
        return {"addr": addr, "ok": False, "error": str(exc), "ms": ms, "method": "getTokenAccountBalance"}


def probe_rpc_health(
    rpc_url: str,
    timeout: float,
    method: str,
    params: list | None = None,
) -> tuple[bool, float, Any]:
    """Testa conectividade RPC com método leve."""
    payload = {"jsonrpc": "2.0", "id": 1, "method": method, "params": params or []}
    try:
        status, body, ms = http_post(rpc_url, timeout, payload)
        if status == 200 and isinstance(body, dict) and "result" in body:
            return True, ms, body["result"]
        return False, ms, body
    except Exception as exc:
        return False, 0.0, str(exc)


def run_rate_limit_probe(
    probe_fn: Callable[[], tuple[int, Any]],
    bursts: int = 5,
    result: AuditResult | None = None,
) -> bool:
    """Envia rajada de requisições para detectar rate limit."""
    section("PROBE DE RATE LIMIT")
    hit_limit = False
    for i in range(bursts):
        try:
            status, _ = probe_fn()
            cor = G if status == 200 else (Y if status == 429 else R)
            print(f"  [{i + 1}/{bursts}] HTTP {cor}{status}{RS}")
            if status == 429:
                hit_limit = True
                warn("Rate limit detectado — aumente DELAY_MS no .env")
                if result:
                    result.warn("rate limit detectado no probe")
                break
        except Exception as exc:
            err(f"  [{i + 1}/{bursts}] Erro: {exc}")
    if not hit_limit and result:
        result.ok("probe rate limit sem bloqueio")
    return not hit_limit
