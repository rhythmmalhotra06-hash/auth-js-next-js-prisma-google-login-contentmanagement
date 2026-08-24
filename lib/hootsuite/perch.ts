// Hootsuite Perch → social_metrics. The scheduled half of the performance loop.
//
// IMPORTANT — this file is written against an UNVERIFIED tool surface. Perch's tool list
// sits behind OAuth, so it could not be read before the integration was connected, and
// Hootsuite publishes no schema. Rather than guess at exact names and then silently return
// nothing, the code:
//   - discovers tools at runtime and picks analytics-looking ones by name/description,
//   - maps results through a TOLERANT extractor that accepts many plausible field spellings,
//   - keeps the raw payload on every row (`SocialMetric.raw`) so a wrong guess is debuggable
//     after the fact instead of lost,
//   - reports what it saw (`toolsSeen`, `sampled`) so the admin page doubles as the
//     capability spike that was owed.
//
// When the real shapes are known, tighten extractRows() — everything else stays.

import { connect, type McpTool } from '@/lib/mcp/client';
import { getAccessToken, PERCH_URL } from '@/lib/hootsuite/oauth';
import { ingestSocialMetrics, type IngestReport } from '@/lib/metrics/social-perf';
import type { SocialMetricInput } from '@/lib/metrics/social-metric-types';

/** Tools worth calling for per-post numbers, best guess first. */
const ANALYTICS_HINTS = ['post', 'analytic', 'metric', 'performance', 'insight', 'top'];

export interface PerchProbe {
  tools: McpTool[];
  /** Raw text/JSON returned by each tool we tried, for eyeballing on the admin page. */
  samples: Array<{ tool: string; args: Record<string, unknown>; ok: boolean; preview: string }>;
}

/** List every tool Perch exposes. This is the capability spike, run through the app. */
export async function probeTools(): Promise<{ ok: true; data: McpTool[] } | { ok: false; error: string }> {
  const token = await getAccessToken();
  const session = await connect(PERCH_URL, token);
  if (!session.ok) return { ok: false, error: session.error.message };
  const tools = await session.data.listTools();
  if (!tools.ok) return { ok: false, error: tools.error.message };
  return { ok: true, data: tools.data };
}

/** Call one tool by name with arbitrary args — the admin "try it" affordance. */
export async function callTool(name: string, args: Record<string, unknown>): Promise<{ ok: true; text: string; json: unknown } | { ok: false; error: string }> {
  const token = await getAccessToken();
  const session = await connect(PERCH_URL, token);
  if (!session.ok) return { ok: false, error: session.error.message };
  const res = await session.data.callTool(name, args);
  if (!res.ok) return { ok: false, error: res.error.message };
  return { ok: true, text: res.data.text, json: res.data.json };
}

const num = (v: unknown): number | null => {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string') {
    const n = Number(v.replace(/,/g, ''));
    return Number.isFinite(n) ? n : null;
  }
  return null;
};

/** First present value among several candidate keys, case-insensitively. */
function pick(o: Record<string, unknown>, keys: string[]): unknown {
  const lower = new Map(Object.keys(o).map((k) => [k.toLowerCase().replace(/[_\s-]/g, ''), k]));
  for (const k of keys) {
    const hit = lower.get(k.toLowerCase().replace(/[_\s-]/g, ''));
    if (hit !== undefined && o[hit] !== null && o[hit] !== undefined) return o[hit];
  }
  return undefined;
}

/** Walk a JSON payload and return every object that looks like a per-post metric row. */
function findRowObjects(payload: unknown, depth = 0): Record<string, unknown>[] {
  if (depth > 6 || payload === null || typeof payload !== 'object') return [];
  if (Array.isArray(payload)) return payload.flatMap((p) => findRowObjects(p, depth + 1));

  const o = payload as Record<string, unknown>;
  const hasKey = pick(o, ['permalink', 'postUrl', 'url', 'link', 'postId', 'id', 'messageId']) !== undefined;
  const hasMetric = ['impressions', 'views', 'reach', 'engagementRate', 'engagement', 'clicks']
    .some((m) => pick(o, [m]) !== undefined);
  if (hasKey && hasMetric) return [o];

  // Otherwise recurse into nested containers (data/results/posts/items/…).
  return Object.values(o).flatMap((v) => findRowObjects(v, depth + 1));
}

/**
 * Turn a tool payload into ingest rows. Tolerant by design — see the file header.
 * `engagementRate` is normalized to a percent: a source reporting 0.051 becomes 5.1.
 */
export function extractRows(payload: unknown, windowDays: number | null): SocialMetricInput[] {
  return findRowObjects(payload).flatMap((o) => {
    const url = pick(o, ['permalink', 'postUrl', 'url', 'link', 'shareUrl']);
    const id = pick(o, ['postId', 'platformPostId', 'messageId', 'socialPostId', 'id']);
    if (typeof url !== 'string' && (id === undefined || id === null)) return [];

    let rate = num(pick(o, ['engagementRate', 'engagement_rate', 'engagementPct', 'engagementPercent']));
    if (rate !== null && rate > 0 && rate <= 1) rate = Math.round(rate * 100 * 1000) / 1000; // fraction → percent
    const engagements = num(pick(o, ['engagements', 'engagement', 'totalEngagements', 'interactions']));
    const impressions = num(pick(o, ['impressions', 'impressionCount']));
    const views = num(pick(o, ['views', 'videoViews', 'viewCount', 'plays']));

    // Derive the rate when the source gives the parts but not the ratio.
    const denom = impressions ?? views;
    if (rate === null && engagements !== null && denom && denom > 0) {
      rate = Math.round((engagements / denom) * 100 * 1000) / 1000;
    }

    const row: SocialMetricInput = {
      source: 'hootsuite:perch',
      publishedUrl: typeof url === 'string' ? url : null,
      platformPostId: id === undefined || id === null ? null : String(id),
      channel: (() => {
        const c = pick(o, ['channel', 'network', 'platform', 'socialNetwork', 'profileType']);
        return typeof c === 'string' ? c : null;
      })(),
      impressions,
      views,
      reach: num(pick(o, ['reach', 'uniqueReach'])),
      engagements,
      engagementRate: rate,
      clicks: num(pick(o, ['clicks', 'linkClicks', 'postClicks'])),
      windowDays,
      raw: o,
    };
    return [row];
  });
}

export interface PullReport extends IngestReport {
  toolsSeen: string[];
  toolsCalled: string[];
  /** Tools that answered but yielded no recognizable rows — the signal that extractRows
   *  needs tightening against the real shape rather than that performance was zero. */
  toolsWithoutRows: string[];
  notes: string[];
}

/**
 * Discover Perch's analytics tools, call the plausible ones for the given window, and
 * ingest whatever comes back. Safe to run repeatedly — ingest is idempotent per
 * (source, post, window, day).
 */
export async function pullPerchMetrics(windowDays = 30): Promise<PullReport> {
  const empty: IngestReport = { upserted: 0, matched: 0, unmatched: 0, skipped: 0, writeErrors: 0, errors: [] };
  const notes: string[] = [];

  const token = await getAccessToken();
  const session = await connect(PERCH_URL, token);
  if (!session.ok) {
    return { ...empty, errors: [session.error.message], toolsSeen: [], toolsCalled: [], toolsWithoutRows: [], notes };
  }
  const listed = await session.data.listTools();
  if (!listed.ok) {
    return { ...empty, errors: [listed.error.message], toolsSeen: [], toolsCalled: [], toolsWithoutRows: [], notes };
  }

  const toolsSeen = listed.data.map((t) => t.name);
  const candidates = listed.data.filter((t) => {
    const hay = `${t.name} ${t.description ?? ''}`.toLowerCase();
    return ANALYTICS_HINTS.some((h) => hay.includes(h));
  });
  if (candidates.length === 0) {
    notes.push(`No analytics-looking tool among: ${toolsSeen.join(', ') || '(none)'}`);
    return { ...empty, toolsSeen, toolsCalled: [], toolsWithoutRows: [], notes };
  }

  const since = new Date(Date.now() - windowDays * 86400_000).toISOString().slice(0, 10);
  const until = new Date().toISOString().slice(0, 10);
  // Spray the common date-arg spellings; a server ignores what it doesn't know, and
  // guessing wrong here costs one rejected call rather than silently empty results.
  const args: Record<string, unknown> = {
    startDate: since, endDate: until, start_date: since, end_date: until,
    from: since, to: until, days: windowDays, period: `${windowDays}d`,
  };

  const rows: SocialMetricInput[] = [];
  const toolsCalled: string[] = [];
  const toolsWithoutRows: string[] = [];
  const errors: string[] = [];

  for (const tool of candidates) {
    toolsCalled.push(tool.name);
    const res = await session.data.callTool(tool.name, args);
    if (!res.ok) {
      errors.push(`${tool.name}: ${res.error.message}`);
      continue;
    }
    const found = extractRows(res.data.json ?? res.data.text, windowDays);
    if (found.length === 0) {
      toolsWithoutRows.push(tool.name);
      notes.push(`${tool.name} answered but no per-post rows were recognized; first 200 chars: ${res.data.text.slice(0, 200)}`);
      continue;
    }
    rows.push(...found);
  }

  if (rows.length === 0) {
    return { ...empty, errors, toolsSeen, toolsCalled, toolsWithoutRows, notes };
  }

  const report = await ingestSocialMetrics(rows);
  return { ...report, errors: [...errors, ...report.errors], toolsSeen, toolsCalled, toolsWithoutRows, notes };
}
