export interface Env {
  // Optional shared secret for early paid/manual access. Set in Cloudflare as SCAN_API_KEY.
  SCAN_API_KEY?: string;
}

type ScanRequest = { url?: string; notes?: string };
type Liquidity = 'liquid' | 'semi-liquid' | 'native' | 'unknown';
type Verdict = 'go' | 'maybe' | 'skip';

type ScanReport = {
  url: string;
  verdict: Verdict;
  payout: { amount: number | null; currency: string | null; liquidity: Liquidity; raw: string[] };
  status: 'open' | 'closed' | 'stale' | 'unknown';
  competition: { existing_prs: number | null; risk: 'low' | 'medium' | 'high' | 'unknown' };
  gates: string[];
  red_flags: string[];
  next_action: string;
  evidence: string[];
};

type Offer = {
  service: string;
  tiers: Array<{ name: string; price_usd: number; deliverable: string; turnaround: string }>;
  payment: { preferred: string[]; note: string };
  boundaries: string[];
  approval_text: string;
};

type Proposal = {
  target_buyer: string;
  channel: string;
  price: string;
  subject: string;
  body: string;
  acceptance_criteria: string[];
  operator_approval_text: string;
};

type Demo = {
  sample_input: { url: string; notes: string };
  sample_report: ScanReport;
  buyer_targets: Array<{ buyer: string; channel: string; reason: string; approval_text: string }>;
  fulfillment_checklist: string[];
};

const LIQUID = ['USDC', 'USDT', 'USD', 'ETH', 'SOL', 'BTC', 'XMR', 'DAI'];
const NATIVE_HINTS = ['token', 'points', 'credits', 'airdrop', 'native', 'mrwk', 'reward token'];
const RED_FLAG_TERMS = ['follow us', 'star this repo', 'like and retweet', 'airdrop farming', 'trading bot', 'gambling', 'casino', 'private key', 'seed phrase'];
const GATE_TERMS = ['kyc', 'discord', 'telegram dm', 'apply', 'form', 'sign up', 'login', 'wallet connect', 'prior contributor'];

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
}

function offer(): Offer {
  return {
    service: 'Bounty Reality Check',
    tiers: [
      { name: 'Quick scan', price_usd: 5, deliverable: 'One URL triaged for payout, gate, crowding, and next action.', turnaround: '<24h manual fulfillment while deployment is approval-gated.' },
      { name: 'Deep scan', price_usd: 25, deliverable: 'Source verification, existing PR/claim sweep, payout liquidity classification, and submit/no-submit recommendation.', turnaround: '<24h manual fulfillment.' },
      { name: 'Weekly shortlist', price_usd: 99, deliverable: '5-10 agent-friendly paid-work leads with eligibility and liquidity notes.', turnaround: 'Weekly.' },
    ],
    payment: {
      preferred: ['Solana USDC', 'EVM/BSC stablecoin'],
      note: 'Addresses are intentionally omitted from the API response until the operator approves public advertising/deployment.',
    },
    boundaries: [
      'No custody, trading, token swaps, gambling, or fake engagement.',
      'Output is triage intelligence, not a guarantee of bounty payment.',
      'External posting/submission/deployment still requires operator approval.',
    ],
    approval_text: 'APPROVE: deploy/advertise Bounty Reality Check manual paid scans at $5/$25/$99 using the listed PAYMENT.md rails.',
  };
}

function proposal(): Proposal {
  return {
    target_buyer: 'Bounty platform operators, open-source maintainers with paid issues, and crypto teams sponsoring developer contests',
    channel: 'Manual email/contact form/GitHub issue comment only after Tolga/RFDY approval; no autonomous DMs or social posting.',
    price: '$25 USDC/USD-equivalent fixed price for one deep scan; $99/week for a 5-10 lead shortlist',
    subject: 'Paid bounty due-diligence scan: payout, gates, crowding, and submit/no-submit recommendation',
    body: [
      'I run a compact paid-work due-diligence service for engineering bounties and crypto/devtool contests.',
      'For $25 per listing, I verify the canonical source, visible payout/currency, open/current status, submission path, eligibility gates, existing PR/claim crowding, payment/liquidity risk, and a go/maybe/skip recommendation.',
      'Deliverable: a short evidence-backed report within 24h. No spam, no fake engagement, no trading advice, and no promise that a bounty will pay.',
      'If useful, send one bounty/listing URL and preferred payment rail; I will return the scan package before any build/submission work.'
    ].join('\n\n'),
    acceptance_criteria: [
      'Buyer provides one public bounty/listing URL.',
      'Operator confirms payment rail/address privately before advertising.',
      'Report includes payout, liquidity, gates, crowding, risk, and next action.',
      'No deployment or public outreach happens without explicit approval.'
    ],
    operator_approval_text: 'APPROVE: send the Bounty Reality Check $25 deep-scan proposal to <buyer/channel> and share approved payment rail privately.',
  };
}

function demo(): Demo {
  const sampleUrl = 'https://github.com/BitgesellOfficial/bitgesell/issues/81';
  return {
    sample_input: {
      url: sampleUrl,
      notes: 'Demo only: illustrates the paid report shape without promising award/payment.',
    },
    sample_report: makeReport(
      sampleUrl,
      'Bounty Program\n\nUp to 50,000 USDT for useful Bitgesell ecosystem contributions. Submit GitHub PRs and link proof comments.',
      'open',
      14,
      ['Demo evidence: canonical GitHub issue URL', 'Demo evidence: existing PR stack is crowded'],
      'No payment is implied until sponsor accepts/awards the work.',
    ),
    buyer_targets: [
      {
        buyer: 'Bounty platform operator',
        channel: 'contact form or founder email after operator approval',
        reason: 'They can resell/offer triage as a quality-control layer for noisy bounty boards.',
        approval_text: 'APPROVE: send Bounty Reality Check proposal to <platform contact> at $25/deep scan.',
      },
      {
        buyer: 'Crypto/devtool sponsor with open paid GitHub issues',
        channel: 'one non-spammy GitHub issue comment or listed email after operator approval',
        reason: 'They benefit from crowding/eligibility reports before paying or assigning work.',
        approval_text: 'APPROVE: send sponsor-facing scan offer to <repo/listing URL> contact.',
      },
    ],
    fulfillment_checklist: [
      'Verify canonical URL and payout/currency.',
      'Check open/current status, deadline, and closed/winner signals.',
      'Inspect existing PRs/claims/comments for duplicate or first-come risk.',
      'Classify gates/red flags and liquidity honestly.',
      'Return go/maybe/skip plus one next action within 24h.',
    ],
  };
}

function authOk(request: Request, env: Env): boolean {
  if (!env.SCAN_API_KEY) return true;
  const auth = request.headers.get('authorization') ?? '';
  const key = request.headers.get('x-api-key') ?? '';
  return auth === `Bearer ${env.SCAN_API_KEY}` || key === env.SCAN_API_KEY;
}

function githubIssueParts(rawUrl: string): { owner: string; repo: string; number: string } | null {
  const u = new URL(rawUrl);
  const m = u.pathname.match(/^\/([^/]+)\/([^/]+)\/issues\/(\d+)/);
  if (!m) return null;
  return { owner: m[1], repo: m[2], number: m[3] };
}

function classifyUrl(url: string) {
  const lowered = url.toLowerCase();
  const hints: string[] = [];
  if (lowered.includes('github.com')) hints.push('github-native workflow possible');
  if (lowered.includes('superteam') || lowered.includes('earn')) hints.push('platform/form submission likely');
  if (lowered.includes('bounty') || lowered.includes('issue')) hints.push('bounty-like source');
  return hints;
}

function extractPayout(text: string): ScanReport['payout'] {
  const raw: string[] = [];
  const money = text.match(/(?:[$€£]\s?\d[\d,]*(?:\.\d+)?|\d[\d,]*(?:\.\d+)?\s?(?:USDC|USDT|USD|ETH|SOL|BTC|XMR|DAI|MRWK|tokens?|points?|credits?))/gi) ?? [];
  for (const m of money.slice(0, 8)) raw.push(m.trim());

  const joined = raw.join(' ').toUpperCase();
  const liquidCurrency = LIQUID.find((c) => joined.includes(c));
  const native = NATIVE_HINTS.some((h) => text.toLowerCase().includes(h));
  const amountMatch = raw.join(' ').match(/\d[\d,]*(?:\.\d+)?/);

  let liquidity: Liquidity = 'unknown';
  if (liquidCurrency || raw.some((x) => x.trim().startsWith('$'))) liquidity = 'liquid';
  else if (native) liquidity = 'native';

  return {
    amount: amountMatch ? Number(amountMatch[0].replace(/,/g, '')) : null,
    currency: liquidCurrency ?? (raw.some((x) => x.trim().startsWith('$')) ? 'USD' : null),
    liquidity,
    raw,
  };
}

function detectTerms(text: string, terms: string[]): string[] {
  const lower = text.toLowerCase();
  return terms.filter((term) => lower.includes(term));
}

async function fetchGithubIssue(url: string): Promise<{ text: string; evidence: string[]; status: ScanReport['status']; prCount: number | null }> {
  const parts = githubIssueParts(url);
  if (!parts) return { text: '', evidence: [], status: 'unknown', prCount: null };

  const api = `https://api.github.com/repos/${parts.owner}/${parts.repo}/issues/${parts.number}`;
  const res = await fetch(api, { headers: { 'user-agent': 'bounty-reality-check/0.1', accept: 'application/vnd.github+json' } });
  if (!res.ok) return { text: '', evidence: [`GitHub API issue fetch failed: ${res.status}`], status: 'unknown', prCount: null };

  const issue = (await res.json()) as { title?: string; body?: string; state?: string; html_url?: string };
  const query = encodeURIComponent(`repo:${parts.owner}/${parts.repo} is:pr ${parts.number}`);
  const prsRes = await fetch(`https://api.github.com/search/issues?q=${query}`, { headers: { 'user-agent': 'bounty-reality-check/0.1', accept: 'application/vnd.github+json' } });
  let prCount: number | null = null;
  const evidence = [`GitHub issue state: ${issue.state ?? 'unknown'}`, `Canonical issue: ${issue.html_url ?? url}`];
  if (prsRes.ok) {
    const prs = (await prsRes.json()) as { total_count?: number };
    prCount = typeof prs.total_count === 'number' ? prs.total_count : null;
    evidence.push(`Related PR search count: ${prCount}`);
  } else {
    evidence.push(`Related PR search failed: ${prsRes.status}`);
  }

  return {
    text: `${issue.title ?? ''}\n\n${issue.body ?? ''}`,
    evidence,
    status: issue.state === 'open' ? 'open' : issue.state === 'closed' ? 'closed' : 'unknown',
    prCount,
  };
}

function makeReport(url: string, text: string, status: ScanReport['status'], prCount: number | null, evidence: string[], notes?: string): ScanReport {
  const fullText = `${text}\n${notes ?? ''}`;
  const payout = extractPayout(fullText);
  const redFlags = detectTerms(fullText, RED_FLAG_TERMS);
  const gates = detectTerms(fullText, GATE_TERMS);
  const competitionRisk = prCount == null ? 'unknown' : prCount === 0 ? 'low' : prCount <= 3 ? 'medium' : 'high';

  let verdict: Verdict = 'maybe';
  if (status === 'closed' || redFlags.length > 0 || competitionRisk === 'high') verdict = 'skip';
  else if (status === 'open' && payout.liquidity !== 'unknown' && competitionRisk === 'low' && gates.length === 0) verdict = 'go';

  const next_action = verdict === 'go'
    ? 'Proceed to deep preflight, clone/inspect repo, and prepare a submission package.'
    : verdict === 'skip'
      ? 'Do not spend build time unless sponsor confirms eligibility/payment and crowding is resolved.'
      : 'Verify payout source, submission route, eligibility gates, and existing PR quality before building.';

  return {
    url,
    verdict,
    payout,
    status,
    competition: { existing_prs: prCount, risk: competitionRisk },
    gates,
    red_flags: redFlags,
    next_action,
    evidence: [...classifyUrl(url), ...evidence],
  };
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const u = new URL(request.url);
    if (u.pathname === '/health') return json({ ok: true, service: 'bounty-reality-check' });
    if (u.pathname === '/offer') return json(offer());
    if (u.pathname === '/proposal') return json(proposal());
    if (u.pathname === '/demo') return json(demo());

    if (u.pathname === '/scan' && request.method === 'POST') {
      if (!authOk(request, env)) return json({ error: 'Unauthorized' }, 401);

      let body: ScanRequest;
      try {
        body = await request.json();
      } catch {
        return json({ error: 'Expected JSON body: {"url":"https://..."}' }, 400);
      }
      if (!body.url) return json({ error: 'Missing url' }, 400);

      let parsed: URL;
      try { parsed = new URL(body.url); } catch { return json({ error: 'Invalid url' }, 400); }

      let source = { text: body.notes ?? '', evidence: [] as string[], status: 'unknown' as ScanReport['status'], prCount: null as number | null };
      if (parsed.hostname === 'github.com' && githubIssueParts(body.url)) {
        source = await fetchGithubIssue(body.url);
        if (body.notes) source.text += `\n\nUser notes:\n${body.notes}`;
      }

      return json(makeReport(body.url, source.text, source.status, source.prCount, source.evidence, body.notes));
    }

    return json({ error: 'Not found', routes: ['GET /health', 'GET /offer', 'GET /proposal', 'GET /demo', 'POST /scan'] }, 404);
  },
};
