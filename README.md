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

Payment rails are staged in `PAYMENT.md` but should not be publicly advertised until Tolga/RFDY approves deployment/outreach.

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

## Deployment boundary

Do **not** deploy, advertise, collect payments, DM buyers, or post publicly without explicit approval. Paste-ready approval phrase:

> APPROVE: deploy/advertise Bounty Reality Check manual paid scans at $5/$25/$99 using the listed PAYMENT.md rails.

## Safety boundary

No custody, trading, token swaps, gambling, wallet signing, fake engagement, or private-key handling. The tool is read-only opportunity intelligence plus manual/package fulfillment.
