# Bounty Reality Check

A sellable micro-service/package that triages paid engineering opportunities before Tolga/RFDY spends build time.

## What it does

Given a bounty/listing URL, it classifies:

- visible payout amount/currency and liquidity bucket;
- open/closed/unknown status;
- GitHub-native vs platform/form workflow;
- related-PR crowding risk;
- obvious gates and red flags;
- go/maybe/skip recommendation and next action.

This is meant to convert Tom Nook's bounty due-diligence workflow into paid scans, not to guarantee bounty payment.

## Sellable offer

- **$5 quick scan** — one URL, automated report + short agent note.
- **$25 deep scan** — source verification, existing PR/claim sweep, payout path, gates, and submit/no-submit recommendation.
- **$99 weekly shortlist** — 5-10 agent-friendly opportunities with eligibility and liquidity notes.

Payment rails are public in `PAYMENT.md` after Tolga/RFDY approved static/manual advertising. Cloudflare/Wrangler is not required for the current sales flow.

## Local usage

```bash
cd /home/ubuntu/tom-agent/product-lab/bounty-reality-check/worker
npm test
npm run typecheck
npm run dev
```

Example scan request:

```bash
curl -X POST http://127.0.0.1:8787/scan \
  -H 'content-type: application/json' \
  --data '{"url":"https://github.com/BitgesellOfficial/bitgesell/issues/81"}'
```

Offer endpoint:

```bash
curl http://127.0.0.1:8787/offer
```

Paste-ready proposal endpoint:

```bash
curl http://127.0.0.1:8787/proposal
```

Buyer demo endpoint:

```bash
curl http://127.0.0.1:8787/demo
```

Sales packet: `SALES_PACKET.md`.

## Static/manual intake

Current live flow requires no Wrangler or Cloudflare:

1. Buyer/agent opens a GitHub scan request issue.
2. Buyer/agent pays via the listed rails in `PAYMENT.md`.
3. Buyer/agent pastes the transaction hash in the issue.
4. A local Hermes cron monitor runs `scripts/fulfill_scan_requests.py`, checks the issue, performs best-effort public-RPC payment proof verification, scans the listing, and posts the report back to the GitHub issue.

Machine-readable order instructions are published at `docs/.well-known/agent-pay.json` and served on GitHub Pages at `/.well-known/agent-pay.json`.

HyperEVM E2E trigger architecture is scaffolded in `contracts/HyperEVMScanPay.sol` and `scripts/hyperevm_event_watcher.py`: agent pays contract -> contract emits `ScanPaid` -> Hermes watcher triggers fulfillment. It is not deployed until RPC/token/treasury/deployer approval exists.

No automated custody, swaps, wallet signing, or private-key handling are part of this flow.

## Safety boundary

No custody, trading, token swaps, gambling, wallet signing, fake engagement, or private-key handling. The tool is read-only opportunity intelligence plus manual/package fulfillment.
