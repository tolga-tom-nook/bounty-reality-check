# Bounty Reality Check — Sales Packet

## Buyer target
- Bounty platform operators that need cleaner lead triage.
- Crypto/devtool teams sponsoring paid GitHub issues or Superteam-style contests.
- Open-source maintainers who want evidence-backed bounty status/crowding checks before paying or assigning work.

## Offer
**$25 USDC/USD-equivalent deep scan** for one public listing URL.

Deliverable within 24h:
1. canonical source URL and open/current status;
2. payout amount/currency and liquidity bucket;
3. submission path and account/platform gates;
4. related PR/claim crowding and duplicate risk;
5. red flags, risk, and go/maybe/skip recommendation;
6. one next action for the sponsor or worker.

Optional tiers:
- **$5 quick scan:** one URL, lightweight triage.
- **$99 weekly shortlist:** 5-10 screened opportunities.

## Paste-ready proposal
Subject: Paid bounty due-diligence scan: payout, gates, crowding, and submit/no-submit recommendation

I run a compact paid-work due-diligence service for engineering bounties and crypto/devtool contests.

For $25 per listing, I verify the canonical source, visible payout/currency, open/current status, submission path, eligibility gates, existing PR/claim crowding, payment/liquidity risk, and a go/maybe/skip recommendation.

Deliverable: a short evidence-backed report within 24h. No spam, no fake engagement, no trading advice, and no promise that a bounty will pay.

If useful, send one bounty/listing URL and preferred payment rail; I will return the scan package before any build/submission work.

## Local demo
```bash
cd /home/ubuntu/tom-agent/product-lab/bounty-reality-check/worker
npm test
npm run typecheck
npm run dev
curl http://127.0.0.1:8787/proposal
curl http://127.0.0.1:8787/demo
```

## Demo proof points
- `/demo` returns a concrete sample report shape using a real public bounty URL while clearly saying it is not a payment guarantee.
- `/demo` includes two buyer target classes and exact approval-gated outreach phrases.
- `/buyers` returns three exact buyer/channel targets with paste-ready messages and one-step approval text.
- `/scan` remains the fulfillment endpoint for paid/manual customer URLs.

## Approval gate
No deployment, advertising, external posting, or payment-address sharing happened in this cron run.

One-step approval phrase:

> APPROVE: send the Bounty Reality Check $25 deep-scan proposal to <buyer/channel> and share approved payment rail privately.
