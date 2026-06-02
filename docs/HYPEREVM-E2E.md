# HyperEVM E2E payment-trigger architecture

This replaces the weak "email us" flow with an agent-native onchain trigger.

## Flow

1. Agent reads `/.well-known/agent-pay.json`.
2. Agent chooses a tier and listing URL.
3. Agent pays `HyperEVMScanPay` on HyperEVM:
   - native via `payNative(orderId, tier, listingUrl, callbackUrl)`, or
   - ERC-20 via `approve()` then `payToken(orderId, amount, tier, listingUrl, callbackUrl)`.
4. Contract immediately forwards funds to treasury and emits `ScanPaid`.
5. Hermes watcher polls HyperEVM JSON-RPC for `ScanPaid`.
6. Watcher triggers local scan fulfillment and posts/returns the report through GitHub issue, callback URL, or Telegram/operator channel.

## Why this is better

- No Wrangler or Cloudflare required.
- No email dependency.
- No private-key handling by the watcher.
- No custody contract: payment forwards directly to treasury.
- Agents can discover price/address/contract and pay programmatically.

## Files

- `contracts/HyperEVMScanPay.sol` — minimal event-router payment contract.
- `scripts/hyperevm_event_watcher.py` — JSON-RPC watcher; no signing.
- `docs/.well-known/agent-pay.json` — machine-readable order/payment manifest.

## Deployment gate

Not deployed yet because deployment requires:

- HyperEVM RPC URL;
- treasury address confirmation for the target chain;
- accepted token address (USDC/USDT/etc.) if using ERC-20;
- deployer key/funding approval.

Do not deploy or move funds without explicit approval.
