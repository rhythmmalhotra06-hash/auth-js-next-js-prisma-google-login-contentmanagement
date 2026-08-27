// Hootsuite Perch → social_metrics. The scheduled half of the performance loop.
//
// Written against the REAL tool surface, captured in context/hootsuite-perch-capabilities.md
// (live tools/list, 2026-08-24). Analytics is a five-step discovery pipeline, not a single
// call:
//
//   get_entitled_workspaces → list_providers → search_sources
//                                            → search_metrics → query_analytics
//
// Three things here are load-bearing and easy to get wrong:
//
//  1. `get_entitled_workspaces` exists on BOTH the publishing and analytics servers and
//     returns DIFFERENT shapes ({organizationId,…} vs {tenantId, tenantType, tenantUUID}).
//     Tools are resolved by name suffix but preferring the `perch-analytics` prefix; take
//     the publishing one and every later call rejects the scope.
//  2. Per-post rows come only from metrics whose dataFormat is MULTIPART (paginated
//     `entries`). TIMESERIES metrics are profile-level totals — useless for attribution.
//  3. `query_analytics` is a BATCH where individual queries fail independently, so a
//     partial failure must not sink the whole pull.
//
// Response *entry* shapes are still undocumented (the tool schema only references a
// `layout`), so entries go through a tolerant extractor and every raw entry is stored on
// the row. The first real pull is therefore self-diagnosing rather than silently empty.

import { connect, type McpSession, type McpTool } from '@/lib/mcp/client';
import { getAccessToken, PERCH_URL } from '@/lib/hootsuite/oauth';
import { ingestSocialMetrics, type IngestReport } from '@/lib/metrics/social-perf';
import type { SocialMetricInput } from '@/lib/metrics/social-metric-types';

const ANALYTICS_PREFIX = 'perch-analytics';
/** Cap so one workspace with many profiles can't run the route past its 300s budget. */
const MAX_METRICS_PER_PROVIDER = 6;
const ENTRY_PAGE_LIMIT = 100; // the documented maximum

type Json = Record<string, unknown>;

export interface PerchToolset {
  workspaces: string;
  providers: string;
  sources: string;
  metrics: string;
  query: string;
}

/**
 * Find a tool by its bare name, preferring the analytics server when both servers expose
 * it. Matching on suffix keeps this working if Hootsuite renames the prefixes.
 */
function resolveTool(tools: McpTool[], bare: string): string | null {
  const matches = tools.filter((t) => t.name === bare || t.name.endsWith(`_${bare}`));
  if (matches.length === 0) return null;
  return (matches.find((t) => t.name.includes(ANALYTICS_PREFIX)) ?? matches[0]).name;
}

export function resolveToolset(tools: McpTool[]): { ok: true; data: PerchToolset } | { ok: false; missing: string[] } {
  const wanted = {
    workspaces: 'get_entitled_workspaces',
    providers: 'list_providers',
    sources: 'search_sources',
    metrics: 'search_metrics',
    query: 'query_analytics',
  } as const;
  const out: Partial<PerchToolset> = {};
  const missing: string[] = [];
  for (const [key, bare] of Object.entries(wanted) as [keyof PerchToolset, string][]) {
    const found = resolveTool(tools, bare);
    if (found) out[key] = found;
    else missing.push(bare);
  }
  return missing.length ? { ok: false, missing } : { ok: true, data: out as PerchToolset };
}

/** Every object anywhere in a payload that carries all of `keys`. Response envelopes are
 *  undocumented, so we locate the interesting objects instead of assuming a path. */
function deepFind(payload: unknown, keys: string[], depth = 0): Json[] {
  if (depth > 8 || payload === null || typeof payload !== 'object') return [];
  if (Array.isArray(payload)) return payload.flatMap((p) => deepFind(p, keys, depth + 1));
  const o = payload as Json;
  const hit = keys.every((k) => o[k] !== undefined && o[k] !== null);
  const nested = Object.values(o).flatMap((v) => deepFind(v, keys, depth + 1));
  return hit ? [o, ...nested] : nested;
}

function uniqueBy<T>(rows: T[], key: (r: T) => string): T[] {
  const seen = new Set<string>();
  return rows.filter((r) => {
    const k = key(r);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

export interface Workspace { tenantId: string; tenantType: string; tenantUUID: string }
export interface Provider { dataService: string; dataType: string }
export interface Metric { id: string; provider: Provider; label: string; dataFormat: string }

/** Workspaces, from the ANALYTICS server's shape (tenant*, not organizationId). */
export function parseWorkspaces(payload: unknown): Workspace[] {
  const found = deepFind(payload, ['tenantId', 'tenantType', 'tenantUUID']);
  return uniqueBy(
    found.map((o) => ({ tenantId: String(o.tenantId), tenantType: String(o.tenantType), tenantUUID: String(o.tenantUUID) })),
    (w) => w.tenantUUID,
  );
}

export function parseProviders(payload: unknown): Provider[] {
  const found = deepFind(payload, ['dataService', 'dataType']);
  return uniqueBy(
    found.map((o) => ({ dataService: String(o.dataService), dataType: String(o.dataType) })),
    (p) => `${p.dataService}:${p.dataType}`,
  );
}

/** Source ids for a provider. `search_sources` groups by provider, but we call it per
 *  provider so anything returned belongs to that provider. */
export function parseSourceIds(payload: unknown): string[] {
  const withLabel = deepFind(payload, ['id', 'label']);
  const withName = deepFind(payload, ['id', 'name']);
  const ids = [...withLabel, ...withName].map((o) => String(o.id));
  return [...new Set(ids)];
}

/**
 * Metrics from a discovery response. Keeps MULTIPART first — those are the paginated
 * per-post entries, the only shape that supports attribution.
 */
export function parseMetrics(payload: unknown, provider: Provider): Metric[] {
  const found = deepFind(payload, ['identifier']);
  const metrics: Metric[] = [];
  for (const o of found) {
    const ident = o.identifier as Json | undefined;
    if (!ident || typeof ident.id !== 'string') continue;
    const p = (ident.provider as Provider | undefined) ?? provider;
    metrics.push({
      id: ident.id,
      provider: { dataService: String(p.dataService), dataType: String(p.dataType) },
      label: typeof o.label === 'string' ? o.label : ident.id,
      dataFormat: typeof o.dataFormat === 'string' ? o.dataFormat : 'UNKNOWN',
    });
  }
  const unique = uniqueBy(metrics, (m) => `${m.provider.dataService}:${m.provider.dataType}:${m.id}`);
  const rank = (m: Metric) => (m.dataFormat === 'MULTIPART' ? 0 : m.dataFormat === 'TIMESERIES' ? 2 : 3);
  return unique.sort((a, b) => rank(a) - rank(b));
}

const num = (v: unknown): number | null => {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string') {
    const n = Number(v.replace(/,/g, ''));
    return Number.isFinite(n) ? n : null;
  }
  return null;
};

/** First present value among candidate keys, ignoring case/underscores/spaces. */
function pick(o: Json, keys: string[]): unknown {
  const norm = (s: string) => s.toLowerCase().replace(/[_\s-]/g, '');
  const index = new Map(Object.keys(o).map((k) => [norm(k), k]));
  for (const k of keys) {
    const hit = index.get(norm(k));
    if (hit !== undefined && o[hit] !== null && o[hit] !== undefined) return o[hit];
  }
  return undefined;
}

const URL_KEYS = ['permalink', 'permalinkUrl', 'postUrl', 'url', 'link', 'shareUrl', 'contentUrl', 'postLink'];
const ID_KEYS = ['platformPostId', 'postId', 'messageId', 'socialPostId', 'contentId', 'externalId', 'id'];

/**
 * Turn MULTIPART entries into ingest rows. Tolerant on field names because entry shapes
 * are undocumented; the raw entry is retained on every row so a mis-guess is fixable
 * after the fact instead of lost.
 */
export function extractRows(payload: unknown, windowDays: number | null, channel: string | null): SocialMetricInput[] {
  // An entry is an object carrying at least one identifier and at least one metric value.
  const candidates = deepFind(payload, []).filter((o) => {
    const hasKey = pick(o, URL_KEYS) !== undefined || pick(o, ID_KEYS) !== undefined;
    const hasMetric = ['impressions', 'views', 'reach', 'engagementRate', 'engagements', 'engagement', 'clicks']
      .some((m) => pick(o, [m]) !== undefined);
    return hasKey && hasMetric;
  });

  const rows: SocialMetricInput[] = [];
  for (const o of candidates) {
    const url = pick(o, URL_KEYS);
    const id = pick(o, ID_KEYS);

    let rate = num(pick(o, ['engagementRate', 'engagementPct', 'engagementPercent']));
    if (rate !== null && rate > 0 && rate <= 1) rate = Math.round(rate * 100 * 1000) / 1000; // fraction → percent
    const engagements = num(pick(o, ['engagements', 'engagement', 'totalEngagements', 'interactions']));
    const impressions = num(pick(o, ['impressions', 'impressionCount']));
    const views = num(pick(o, ['views', 'videoViews', 'viewCount', 'plays']));

    const denom = impressions ?? views;
    if (rate === null && engagements !== null && denom && denom > 0) {
      rate = Math.round((engagements / denom) * 100 * 1000) / 1000;
    }

    const entryChannel = pick(o, ['channel', 'network', 'networkType', 'platform', 'socialNetwork', 'profileType']);
    rows.push({
      source: 'hootsuite:perch',
      publishedUrl: typeof url === 'string' ? url : null,
      platformPostId: id === undefined ? null : String(id),
      channel: typeof entryChannel === 'string' ? entryChannel : channel,
      impressions,
      views,
      reach: num(pick(o, ['reach', 'uniqueReach'])),
      engagements,
      engagementRate: rate,
      clicks: num(pick(o, ['clicks', 'linkClicks', 'postClicks'])),
      windowDays,
      raw: o,
    });
  }
  // The same post can appear under several metrics; ingest dedupes on the stored key, but
  // collapsing here keeps the upsert count honest.
  return uniqueBy(rows, (r) => `${r.platformPostId ?? ''}|${r.publishedUrl ?? ''}`);
}

async function callJson(session: McpSession, tool: string, args: Json): Promise<{ ok: true; json: unknown; text: string } | { ok: false; error: string }> {
  const res = await session.callTool(tool, args);
  if (!res.ok) return { ok: false, error: res.error.message };
  return { ok: true, json: res.data.json ?? res.data.text, text: res.data.text };
}

export interface PullReport extends IngestReport {
  toolsSeen: string[];
  workspaces: number;
  providers: string[];
  sourcesFound: number;
  metricsQueried: string[];
  /** Metrics that answered but yielded no recognizable per-post entry — the signal that
   *  extractRows needs the real field names, NOT that performance was zero. */
  metricsWithoutRows: string[];
  notes: string[];
}

function emptyReport(): IngestReport {
  return { upserted: 0, matched: 0, unmatched: 0, skipped: 0, writeErrors: 0, errors: [] };
}

/** List every tool Perch exposes (both servers). Powers the admin inspector. */
export async function probeTools(): Promise<{ ok: true; data: McpTool[] } | { ok: false; error: string }> {
  const session = await connect(PERCH_URL, await getAccessToken());
  if (!session.ok) return { ok: false, error: session.error.message };
  const tools = await session.data.listTools();
  if (!tools.ok) return { ok: false, error: tools.error.message };
  return { ok: true, data: tools.data };
}

/** Call one tool with arbitrary args — the admin "try it" affordance. */
export async function callTool(name: string, args: Json): Promise<{ ok: true; text: string; json: unknown } | { ok: false; error: string }> {
  const session = await connect(PERCH_URL, await getAccessToken());
  if (!session.ok) return { ok: false, error: session.error.message };
  const res = await session.data.callTool(name, args);
  if (!res.ok) return { ok: false, error: res.error.message };
  return { ok: true, text: res.data.text, json: res.data.json };
}

/**
 * Walk the whole pipeline and ingest per-post numbers.
 *
 * Pulls across EVERY entitled workspace and source deliberately: the grant is read-only
 * analytics and we want all of Mindvalley's profiles, so there is no scope to choose. If
 * that ever needs narrowing, persist a selection rather than guessing one here.
 */
export async function pullPerchMetrics(windowDays = 30): Promise<PullReport> {
  const notes: string[] = [];
  const errors: string[] = [];
  const base = { toolsSeen: [] as string[], workspaces: 0, providers: [] as string[], sourcesFound: 0, metricsQueried: [] as string[], metricsWithoutRows: [] as string[], notes };

  const session = await connect(PERCH_URL, await getAccessToken());
  if (!session.ok) return { ...emptyReport(), ...base, errors: [session.error.message] };

  const listed = await session.data.listTools();
  if (!listed.ok) return { ...emptyReport(), ...base, errors: [listed.error.message] };
  base.toolsSeen = listed.data.map((t) => t.name);

  const toolset = resolveToolset(listed.data);
  if (!toolset.ok) {
    return { ...emptyReport(), ...base, errors: [`Perch is missing expected analytics tools: ${toolset.missing.join(', ')}`] };
  }
  const T = toolset.data;

  const wsRes = await callJson(session.data, T.workspaces, {});
  if (!wsRes.ok) return { ...emptyReport(), ...base, errors: [wsRes.error] };
  const workspaces = parseWorkspaces(wsRes.json);
  base.workspaces = workspaces.length;
  if (workspaces.length === 0) {
    notes.push(`${T.workspaces} returned no workspace with tenantId/tenantType/tenantUUID. First 300 chars: ${wsRes.text.slice(0, 300)}`);
    return { ...emptyReport(), ...base, errors };
  }

  const since = new Date(Date.now() - windowDays * 86400_000).toISOString().slice(0, 10);
  const until = new Date().toISOString().slice(0, 10);
  const rows: SocialMetricInput[] = [];

  for (const workspaceScope of workspaces) {
    const provRes = await callJson(session.data, T.providers, { workspaceScope });
    if (!provRes.ok) { errors.push(`${T.providers}: ${provRes.error}`); continue; }
    const providers = parseProviders(provRes.json);
    if (providers.length === 0) {
      notes.push(`No providers in workspace ${workspaceScope.tenantId}. First 200 chars: ${provRes.text.slice(0, 200)}`);
      continue;
    }

    for (const provider of providers) {
      const label = `${provider.dataService}/${provider.dataType}`;
      if (!base.providers.includes(label)) base.providers.push(label);

      const srcRes = await callJson(session.data, T.sources, { workspaceScope, providers: [provider] });
      if (!srcRes.ok) { errors.push(`${T.sources} (${label}): ${srcRes.error}`); continue; }
      const sourceIds = parseSourceIds(srcRes.json);
      base.sourcesFound += sourceIds.length;
      if (sourceIds.length === 0) {
        notes.push(`No sources for ${label}. First 200 chars: ${srcRes.text.slice(0, 200)}`);
        continue;
      }

      // Discovery: ask for post-level metrics, then keep MULTIPART (per-post entries) first.
      const metRes = await callJson(session.data, T.metrics, { workspaceScope, queries: [{ providers: [provider], query: 'post' }] });
      if (!metRes.ok) { errors.push(`${T.metrics} (${label}): ${metRes.error}`); continue; }
      const all = parseMetrics(metRes.json, provider);
      const multipart = all.filter((m) => m.dataFormat === 'MULTIPART');
      const chosen = (multipart.length ? multipart : all).slice(0, MAX_METRICS_PER_PROVIDER);
      if (chosen.length === 0) {
        notes.push(`No metrics discovered for ${label}. First 200 chars: ${metRes.text.slice(0, 200)}`);
        continue;
      }
      if (multipart.length === 0) {
        notes.push(`${label}: no MULTIPART (per-post) metric found; falling back to ${chosen.map((m) => `${m.label}[${m.dataFormat}]`).join(', ')} — these are likely profile-level, so per-post attribution may not be possible for this provider.`);
      }

      for (const metric of chosen) {
        const name = `${label}:${metric.label}`;
        base.metricsQueried.push(name);
        const qRes = await callJson(session.data, T.query, {
          queries: [{
            metricId: { id: metric.id, provider: metric.provider },
            sourceIds,
            timeRange: { since, until },
            ...(metric.dataFormat === 'MULTIPART' ? { limit: ENTRY_PAGE_LIMIT } : {}),
          }],
        });
        if (!qRes.ok) { errors.push(`${T.query} (${name}): ${qRes.error}`); continue; }

        const found = extractRows(qRes.json, windowDays, provider.dataService);
        if (found.length === 0) {
          base.metricsWithoutRows.push(name);
          notes.push(`${name} answered but no per-post entry was recognized. First 300 chars: ${qRes.text.slice(0, 300)}`);
          continue;
        }
        rows.push(...found);
      }
    }
  }

  if (rows.length === 0) return { ...emptyReport(), ...base, errors };

  const report = await ingestSocialMetrics(rows);
  return { ...report, ...base, errors: [...errors, ...report.errors] };
}
