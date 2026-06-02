import { describe, expect, it } from 'vitest';
import worker from '../src/index';

describe('bounty reality check worker', () => {
  it('serves health', async () => {
    const res = await worker.fetch(new Request('https://example.com/health'), {}, {} as ExecutionContext);
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true });
  });

  it('returns a scan shell', async () => {
    const res = await worker.fetch(new Request('https://example.com/scan', {
      method: 'POST', body: JSON.stringify({ url: 'https://github.com/foo/bar/issues/1' })
    }), {}, {} as ExecutionContext);
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.url).toContain('github.com');
    expect(body.evidence).toContain('github-native workflow possible');
  });

  it('serves a sellable offer without exposing payment addresses', async () => {
    const res = await worker.fetch(new Request('https://example.com/offer'), {}, {} as ExecutionContext);
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.service).toBe('Bounty Reality Check');
    expect(body.tiers.map((tier: any) => tier.price_usd)).toEqual([5, 25, 99]);
    expect(body.payment.note).toContain('omitted');
    expect(body.approval_text).toContain('APPROVE: deploy/advertise');
  });

  it('serves a paste-ready buyer proposal with approval gate', async () => {
    const res = await worker.fetch(new Request('https://example.com/proposal'), {}, {} as ExecutionContext);
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.price).toContain('$25');
    expect(body.subject).toContain('Paid bounty due-diligence');
    expect(body.channel).toContain('approval');
    expect(body.operator_approval_text).toContain('APPROVE: send');
  });

  it('serves a buyer-demo report and target list', async () => {
    const res = await worker.fetch(new Request('https://example.com/demo'), {}, {} as ExecutionContext);
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.sample_report.payout.currency).toBe('USDT');
    expect(body.sample_report.competition.risk).toBe('high');
    expect(body.buyer_targets.length).toBeGreaterThan(0);
    expect(body.buyer_targets[0].approval_text).toContain('APPROVE:');
    expect(body.fulfillment_checklist).toContain('Verify canonical URL and payout/currency.');
  });

  it('serves approval-gated buyer leads with paste-ready messages', async () => {
    const res = await worker.fetch(new Request('https://example.com/buyers'), {}, {} as ExecutionContext);
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.boundary).toContain('Do not send autonomously');
    expect(body.leads.length).toBe(3);
    expect(body.leads[0].offer).toContain('$25');
    expect(body.leads[0].approval_text).toContain('APPROVE:');
    expect(body.leads[0].message).toContain('Fixed price');
  });
});
