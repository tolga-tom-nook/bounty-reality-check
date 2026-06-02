# Payment / Access Gate Plan

Goal: sell Bounty Reality Check before full x402 automation.

## Phase 0 — manual paid scans

Offer:
- $5 quick scan: one URL, automated report + short agent note.
- $25 deep scan: source verification, existing PRs, payout path, gates, recommendation.
- $99 weekly shortlist: 5-10 agent-friendly opportunities.

Payment rails to advertise after user approval:
- Solana USDC: HREkUcMpeRp4nxtix92pAZVcgyENt7RbTna9ReovYyap
- EVM/BSC: 0x4a76c7E64C08cF29B59eFC640b4ada97A270d428

No custody, no trading, no private-key handling.

## Phase 1 — API key gate

Cloudflare secret:
- `SCAN_API_KEY`

Client calls:
```bash
curl -X POST https://<worker>/scan \
  -H 'content-type: application/json' \
  -H 'x-api-key: <paid-key>' \
  --data '{"url":"https://github.com/org/repo/issues/123"}'
```

Use manual payment -> issue API key -> revoke/rotate as needed.

## Phase 2 — x402-style boundary

Add middleware:
1. Unpaid request returns `402 Payment Required` with accepted chains/assets, price, memo, and verification URL.
2. Paid request includes proof header.
3. Worker verifies payment/proof or calls verifier service.
4. Worker executes `/scan`.

Do not custody funds. Prefer stablecoin receipt verification.

## Phase 3 — Telegram bot

Telegram bot receives URL, checks entitlement/payment, returns scan report. Risky external actions remain human-approved.
