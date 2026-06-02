#!/usr/bin/env python3
"""Autonomous/manual bridge for Bounty Reality Check GitHub issue orders.

Polls scan-request issues, checks for a payment tx field, and posts either:
- payment instructions if missing; or
- a compact scan report if payment proof is present and no report was posted yet.

This deliberately does not custody funds or sign transactions. Payment verification is
best-effort against public RPCs; unverified proofs are labeled honestly.
"""
from __future__ import annotations

import json
import os
import re
import sys
import time
import urllib.parse
import urllib.request
from dataclasses import dataclass
from pathlib import Path
from typing import Any

OWNER = "tolga-tom-nook"
REPO = "bounty-reality-check"
SOLANA_USDC = "HREkUcMpeRp4nxtix92pAZVcgyENt7RbTna9ReovYyap"
EVM_ADDR = "0x4a76c7E64C08cF29B59eFC640b4ada97A270d428".lower()
BASE_USDC = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913".lower()
REPORT_MARKER = "<!-- bounty-reality-check-report-v1 -->"
PAYMENT_MARKER = "<!-- bounty-reality-check-payment-instructions-v1 -->"

LIQUID = ["USDC", "USDT", "USD", "ETH", "SOL", "BTC", "XMR", "DAI"]
RED_FLAGS = ["follow us", "star this repo", "like and retweet", "airdrop farming", "trading bot", "gambling", "casino", "private key", "seed phrase"]
GATES = ["kyc", "discord", "telegram dm", "apply", "form", "sign up", "login", "wallet connect", "prior contributor"]


def token() -> str:
    if os.environ.get("GITHUB_TOKEN"):
        return os.environ["GITHUB_TOKEN"]
    cred = Path.home() / ".git-credentials"
    if cred.exists():
        for line in cred.read_text(errors="ignore").splitlines():
            if "github.com" in line:
                u = urllib.parse.urlparse(line.strip())
                return urllib.parse.unquote(u.password or u.username or "")
    return ""

GITHUB_TOKEN = token()


def request_json(url: str, *, method="GET", body: Any | None = None, headers: dict[str, str] | None = None) -> Any:
    h = {"Accept": "application/vnd.github+json", "User-Agent": "bounty-reality-check-fulfiller"}
    if GITHUB_TOKEN and "api.github.com" in url:
        h["Authorization"] = f"Bearer {GITHUB_TOKEN}"
    if headers:
        h.update(headers)
    data = None
    if body is not None:
        data = json.dumps(body).encode()
        h["Content-Type"] = "application/json"
    req = urllib.request.Request(url, data=data, method=method, headers=h)
    with urllib.request.urlopen(req, timeout=30) as r:
        raw = r.read()
        if not raw:
            return None
        return json.loads(raw)


def post_comment(issue_number: int, body: str) -> None:
    if os.environ.get("DRY_RUN") == "1":
        print(f"DRY_RUN would comment on #{issue_number}: {body[:180].replace(chr(10), ' ')}")
        return
    request_json(
        f"https://api.github.com/repos/{OWNER}/{REPO}/issues/{issue_number}/comments",
        method="POST",
        body={"body": body},
    )


def section(body: str, label: str) -> str:
    # GitHub issue forms render as: ### Label\n\nvalue\n\n### Next
    m = re.search(rf"###\s+{re.escape(label)}\s*\n+(.*?)(?=\n###\s+|\Z)", body or "", re.I | re.S)
    return (m.group(1).strip() if m else "").strip()


def first_url(text: str) -> str:
    m = re.search(r"https?://[^\s>)]+", text or "")
    return m.group(0).rstrip(".,") if m else ""


def tx_hash(text: str) -> str:
    # EVM 0x + 64 hex, or broad Solana/base58-ish signature 80-100 chars.
    m = re.search(r"0x[a-fA-F0-9]{64}", text or "")
    if m:
        return m.group(0)
    m = re.search(r"\b[1-9A-HJ-NP-Za-km-z]{80,100}\b", text or "")
    return m.group(0) if m else ""


def classify_payout(text: str) -> tuple[str, str]:
    hits = re.findall(r"(?:[$€£]\s?\d[\d,]*(?:\.\d+)?|\d[\d,]*(?:\.\d+)?\s?(?:USDC|USDT|USD|ETH|SOL|BTC|XMR|DAI|tokens?|points?|credits?))", text, flags=re.I)
    joined = " ".join(hits).upper()
    cur = next((c for c in LIQUID if c in joined), "USD" if any(h.strip().startswith("$") for h in hits) else "unknown")
    return (", ".join(hits[:6]) or "none found", cur)


def github_scan(url: str) -> dict[str, Any]:
    evidence = []
    text = ""
    status = "unknown"
    pr_count = None
    parts = re.search(r"github\.com/([^/]+)/([^/]+)/issues/(\d+)", url)
    if parts:
        owner, repo, num = parts.groups()
        issue = request_json(f"https://api.github.com/repos/{owner}/{repo}/issues/{num}")
        text = f"{issue.get('title','')}\n\n{issue.get('body','')}"
        status = issue.get("state", "unknown")
        evidence += [f"GitHub issue state: {status}", f"Canonical issue: {issue.get('html_url', url)}"]
        q = urllib.parse.urlencode({"q": f"repo:{owner}/{repo} is:pr {num}"})
        prs = request_json(f"https://api.github.com/search/issues?{q}")
        pr_count = prs.get("total_count")
        evidence.append(f"Related PR search count: {pr_count}")
    else:
        evidence.append("Non-GitHub URL: public metadata scan only; deep scan requires manual source review.")

    payout_raw, currency = classify_payout(text)
    lower = text.lower()
    red = [x for x in RED_FLAGS if x in lower]
    gates = [x for x in GATES if x in lower]
    competition = "unknown" if pr_count is None else ("low" if pr_count == 0 else "medium" if pr_count <= 3 else "high")
    if status == "closed" or red or competition == "high":
        verdict = "SKIP"
    elif status == "open" and currency != "unknown" and competition == "low" and not gates:
        verdict = "GO"
    else:
        verdict = "MAYBE"
    return {"verdict": verdict, "status": status, "payout_raw": payout_raw, "currency": currency, "competition": competition, "pr_count": pr_count, "gates": gates, "red": red, "evidence": evidence}


def verify_payment(tx: str, tier: str) -> str:
    # Honest best-effort: verify simple Base USDC transfer or Solana tx existence.
    if not tx:
        return "missing"
    try:
        if tx.startswith("0x"):
            payload = {"jsonrpc":"2.0","id":1,"method":"eth_getTransactionByHash","params":[tx]}
            req = urllib.request.Request("https://mainnet.base.org", data=json.dumps(payload).encode(), headers={"Content-Type":"application/json", "User-Agent":"bounty-reality-check"})
            with urllib.request.urlopen(req, timeout=20) as r:
                data=json.load(r).get("result")
            if not data:
                return "unverified: tx not found on Base public RPC"
            to=(data.get("to") or "").lower(); inp=(data.get("input") or "").lower()
            if to == EVM_ADDR:
                return "verified: native EVM transfer to listed address (amount not price-checked)"
            if to == BASE_USDC and inp.startswith("0xa9059cbb") and EVM_ADDR[2:].rjust(64,"0") in inp:
                return "verified: Base USDC transfer to listed address (amount not price-checked)"
            return "unverified: tx found but recipient/asset did not match listed Base/EVM rails"
        else:
            payload = {"jsonrpc":"2.0","id":1,"method":"getTransaction","params":[tx,{"encoding":"jsonParsed","maxSupportedTransactionVersion":0}]}
            req = urllib.request.Request("https://api.mainnet-beta.solana.com", data=json.dumps(payload).encode(), headers={"Content-Type":"application/json", "User-Agent":"bounty-reality-check"})
            with urllib.request.urlopen(req, timeout=20) as r:
                result=json.load(r).get("result")
            if not result:
                return "unverified: tx not found on Solana public RPC"
            blob=json.dumps(result)
            if SOLANA_USDC in blob:
                return "verified: Solana transaction references listed Solana USDC address (amount not price-checked)"
            return "unverified: Solana tx found but listed Solana USDC address not detected"
    except Exception as e:
        return f"unverified: public RPC check failed ({type(e).__name__})"


def report_comment(issue: dict[str, Any], listing_url: str, tier: str, tx: str) -> str:
    scan = github_scan(listing_url)
    pay = verify_payment(tx, tier)
    return f"""{REPORT_MARKER}
## Bounty Reality Check report

**Tier:** {tier or 'unspecified'}  
**Listing:** {listing_url}  
**Payment proof:** `{tx}`  
**Payment verification:** {pay}

**Verdict:** **{scan['verdict']}**

**Payout detected:** {scan['payout_raw']}  
**Liquidity/currency bucket:** {scan['currency']}  
**Status:** {scan['status']}  
**Competition:** {scan['competition']} (related PR count: {scan['pr_count']})

**Gates:** {', '.join(scan['gates']) if scan['gates'] else 'none detected'}  
**Red flags:** {', '.join(scan['red']) if scan['red'] else 'none detected'}

**Evidence:**
""" + "\n".join(f"- {e}" for e in scan["evidence"]) + f"""

**Next action:** {'Proceed to deeper repo/source inspection before building.' if scan['verdict'] == 'GO' else 'Do not build until payout, eligibility, and crowding are clarified.' if scan['verdict'] == 'MAYBE' else 'Skip unless sponsor gives new written payment/eligibility confirmation.'}

_Boundary: this is due-diligence intelligence, not a guarantee that any bounty will pay._
"""


def payment_instructions(issue: dict[str, Any], listing_url: str, tier: str) -> str:
    return f"""{PAYMENT_MARKER}
## Payment needed to start scan

Detected listing URL: {listing_url or '(missing)'}  
Selected tier: {tier or '(missing)'}

Pay the selected tier, then edit this issue with the transaction hash:
- $5 quick scan
- $25 deep scan
- $99 weekly shortlist

Payment rails:
- Solana USDC: `{SOLANA_USDC}`
- EVM/BSC stablecoin: `{EVM_ADDR}`

After a tx hash is present, the Hermes monitor will post the scan report here. Do not paste secrets, private keys, or seed phrases.
"""


def main() -> int:
    if not GITHUB_TOKEN:
        print("missing GitHub token", file=sys.stderr)
        return 2
    issues = request_json(f"https://api.github.com/repos/{OWNER}/{REPO}/issues?state=open&labels=scan-request&per_page=20")
    actions = 0
    for issue in issues:
        if "pull_request" in issue:
            continue
        number = issue["number"]
        comments = request_json(issue["comments_url"])
        joined_comments = "\n".join(c.get("body", "") for c in comments)
        if REPORT_MARKER in joined_comments:
            continue
        body = issue.get("body") or ""
        listing_url = first_url(section(body, "Public bounty/listing URL") or body)
        tier = section(body, "Tier")
        tx = tx_hash(section(body, "Payment transaction hash") or body)
        if not listing_url:
            if PAYMENT_MARKER not in joined_comments:
                post_comment(number, "Please edit the issue with a public bounty/listing URL so the scan can run.")
                actions += 1
            continue
        if not tx:
            if PAYMENT_MARKER not in joined_comments:
                post_comment(number, payment_instructions(issue, listing_url, tier))
                actions += 1
            continue
        post_comment(number, report_comment(issue, listing_url, tier, tx))
        actions += 1
    if actions:
        print(f"Bounty Reality Check monitor actions: {actions}")
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
