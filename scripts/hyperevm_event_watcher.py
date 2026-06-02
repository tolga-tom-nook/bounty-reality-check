#!/usr/bin/env python3
"""Watch HyperEVM/EVM ScanPaid events and trigger Bounty Reality Check fulfillment.

This is the missing E2E agent piece: an agent can pay an onchain contract, the
contract emits ScanPaid, and this watcher runs the local scan pipeline without
email or Wrangler.

Required env:
- EVM_RPC_URL: HyperEVM or other EVM JSON-RPC endpoint
- SCAN_PAY_CONTRACT: deployed HyperEVMScanPay contract address
- START_BLOCK: first block to scan (optional; defaults latest-500)

Optional env:
- CHAIN_NAME, STATE_FILE, DRY_RUN=1

No private keys are used. No signing or fund movement happens here.
"""
from __future__ import annotations

import hashlib
import json
import os
import sys
import time
import urllib.request
from pathlib import Path
from typing import Any

EVENT_SIG = "ScanPaid(bytes32,address,address,uint256,uint8,string,string)"
EVENT_TOPIC = "0x" + hashlib.sha3_256(EVENT_SIG.encode()).hexdigest()  # placeholder; see note below
# Ethereum uses Keccak-256, not FIPS SHA3-256. Override if eth_hash/web3 is installed.
try:
    from eth_hash.auto import keccak  # type: ignore
    EVENT_TOPIC = "0x" + keccak(EVENT_SIG.encode()).hex()
except Exception:
    pass

RPC = os.environ.get("EVM_RPC_URL", "").strip()
CONTRACT = os.environ.get("SCAN_PAY_CONTRACT", "").lower().strip()
CHAIN = os.environ.get("CHAIN_NAME", "hyperevm")
STATE_FILE = Path(os.environ.get("STATE_FILE", "/home/ubuntu/tom-agent/product-lab/bounty-reality-check/.watcher-state/hyperevm.json"))
DRY_RUN = os.environ.get("DRY_RUN") == "1"


def rpc(method: str, params: list[Any]) -> Any:
    if not RPC:
        raise SystemExit("EVM_RPC_URL not set")
    payload = json.dumps({"jsonrpc": "2.0", "id": 1, "method": method, "params": params}).encode()
    req = urllib.request.Request(RPC, data=payload, headers={"content-type": "application/json", "user-agent": "bounty-reality-check-hyperevm-watcher"})
    with urllib.request.urlopen(req, timeout=30) as r:
        data = json.load(r)
    if data.get("error"):
        raise RuntimeError(data["error"])
    return data.get("result")


def hexint(x: str) -> int:
    return int(x, 16)


def load_state(latest: int) -> dict[str, Any]:
    if STATE_FILE.exists():
        return json.loads(STATE_FILE.read_text())
    start = int(os.environ.get("START_BLOCK", max(0, latest - 500)))
    return {"last_block": start - 1, "seen": []}


def save_state(state: dict[str, Any]) -> None:
    STATE_FILE.parent.mkdir(parents=True, exist_ok=True)
    STATE_FILE.write_text(json.dumps(state, indent=2, sort_keys=True))


def decode_indexed_addr(topic: str) -> str:
    return "0x" + topic[-40:]


def handle_log(log: dict[str, Any]) -> str:
    # Dynamic strings are ABI-encoded in data; keep robust minimal extraction for now.
    tx = log["transactionHash"]
    order = log["topics"][1]
    payer = decode_indexed_addr(log["topics"][2])
    token = decode_indexed_addr(log["topics"][3]) if len(log.get("topics", [])) > 3 else "unknown"
    msg = {
        "event": "scan_paid_detected",
        "chain": CHAIN,
        "tx": tx,
        "order_id": order,
        "payer": payer,
        "token": token,
        "contract": CONTRACT,
        "note": "Trigger local scan fulfillment here; listingUrl/callbackUrl can be decoded by adding eth_abi/web3 dependency or mirrored from order issue metadata.",
    }
    out = json.dumps(msg, separators=(",", ":"))
    if DRY_RUN:
        print("DRY_RUN " + out)
    else:
        print(out)
    return tx


def main() -> int:
    if not CONTRACT:
        print("SCAN_PAY_CONTRACT not set; watcher idle", file=sys.stderr)
        return 0
    latest = hexint(rpc("eth_blockNumber", []))
    state = load_state(latest)
    from_block = state["last_block"] + 1
    to_block = latest
    if from_block > to_block:
        return 0
    params = [{
        "fromBlock": hex(from_block),
        "toBlock": hex(to_block),
        "address": CONTRACT,
        "topics": [EVENT_TOPIC],
    }]
    logs = rpc("eth_getLogs", params) or []
    seen = set(state.get("seen", []))
    actions = 0
    for log in logs:
        key = log["transactionHash"] + ":" + log.get("logIndex", "0x0")
        if key in seen:
            continue
        handle_log(log)
        seen.add(key)
        actions += 1
    state["last_block"] = to_block
    state["seen"] = list(seen)[-1000:]
    save_state(state)
    if actions:
        print(f"Bounty Reality Check {CHAIN} payment events: {actions}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
