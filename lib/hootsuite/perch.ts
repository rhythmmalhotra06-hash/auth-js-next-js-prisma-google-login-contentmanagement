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
// The real entry shape, from a live pull on 2026-08-26:
//
//   { results: [ { metric: { id: 'top_posts', provider: {...} },
//                  entries: [ { unique_id: '<sourceId>_<postId>',
//                               source_id: '<sourceId>',
//                               timestamp: '2026-08-26T23:01:38Z',
//                               details: { content: { body: '…' }, auto_tags: [] } } ] } ] }
//
// Two consequences that cost a whole pull to learn:
//  - The identifier sits on the ENTRY while the numbers sit nested inside `details`, so an
//    extractor requiring both on one object matches nothing. Metrics are collected from the
//    entry's whole subtree, keyed off the entry's own identifier.
//  - Hootsuite 429s quickly. `search_sources` and `search_metrics` both accept arrays, so
//    all providers go in ONE call each instead of one call per provider. Pacing alone was
//    not enough; reducing call count is what actually fixes it.

import { connect, type McpSession, type McpTool } from '@/lib/mcp/client';
import { getAccessToken, PERCH_URL } from '@/lib/hootsuite/oauth';
import { ingestSocialMetrics, rollupAccounts, fromRaw, type IngestReport, type SocialPostRow, type AccountPerformance } from '@/lib/metrics/social-perf';
import { reachOf, isPostPermalink, type SocialMetricInput, type SocialMetricRow } from '@/lib/metrics/social-metric-types';

const ANALYTICS_PREFIX = 'perch-analytics';
/** Cap so one workspace with many profiles can't run the route past its 300s budget. */
const MAX_METRICS_PER_PROVIDER = 6;
const ENTRY_PAGE_LIMIT = 100; // the documented maximum
/** Diagnostic preview length. Long enough to show a whole entry — a 300-char preview hid
 *  the nested `details` shape and cost an entire pull to discover. */
const PREVIEW_CHARS = 2500;

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

/**
 * Source ids grouped by provider. The real envelope is
 * `[{ provider: {...}, sources: [...] }, …]` (confirmed live 2026-08-26, including empty
 * `sources` arrays for providers with no connected profile), so all providers can be
 * requested in ONE call and the results split here.
 */
export function parseSourcesByProvider(payload: unknown): Map<string, string[]> {
  const out = new Map<string, string[]>();
  for (const group of deepFind(payload, ['provider', 'sources'])) {
    const p = group.provider as Provider | undefined;
    if (!p?.dataService) continue;
    const key = `${p.dataService}:${p.dataType}`;
    const sources = Array.isArray(group.sources) ? group.sources : [];
    const ids = sources
      .filter((x): x is Json => x !== null && typeof x === 'object')
      .map((x) => (x.id === undefined ? null : String(x.id)))
      .filter((x): x is string => !!x);
    out.set(key, [...new Set([...(out.get(key) ?? []), ...ids])]);
  }
  return out;
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
// `unique_id` is Perch's real per-post key ("<sourceId>_<postId>") and is stable, so it
// leads. The rest are fallbacks for providers that shape entries differently.
const ID_KEYS = ['unique_id', 'platformPostId', 'postId', 'messageId', 'socialPostId', 'contentId', 'externalId', 'id'];
/** Perch metric id → the column a bare `value` on its entries belongs in. */
const METRIC_ID_FIELD: Array<[RegExp, 'impressions' | 'views' | 'reach' | 'engagements' | 'clicks' | 'engagementRate']> = [
  [/impression/i, 'impressions'],
  [/(^|_)views?(_|$)|video_view|play/i, 'views'],
  [/reach/i, 'reach'],
  [/engagement_rate|eng_rate/i, 'engagementRate'],
  [/engagement/i, 'engagements'],
  [/click/i, 'clicks'],
];

/** Flatten an entry subtree into leaf key→value pairs, so `details.metrics.impressions`
 *  is found as readily as a top-level `impressions`. Later duplicates lose to earlier
 *  (shallower) ones, which keeps a top-level value authoritative. */
function flattenLeaves(value: unknown, out: Json = {}, depth = 0): Json {
  if (depth > 6 || value === null || typeof value !== 'object') return out;
  if (Array.isArray(value)) {
    for (const v of value) flattenLeaves(v, out, depth + 1);
    return out;
  }
  for (const [k, v] of Object.entries(value as Json)) {
    if (v !== null && typeof v === 'object') flattenLeaves(v, out, depth + 1);
    else if (!(k in out)) out[k] = v;
  }
  return out;
}

/**
 * Hootsuite campaign/speaker tags for an entry.
 *
 * They sit at `details.tags` as `[{id, label, group_name}]` — verified in production, where
 * 56 of 329 posts carry at least one ('Expert to Authority Summit 2026', 'Weekly Masterclass',
 * 'MVU 2027', plus speakers like 'Vishen' and 'Regan Hillyer'). This is the mechanism the social
 * team already groups campaigns by, so it needs no new integration — only lifting out of the
 * payload we were already storing.
 *
 * Searched rather than read at a fixed path, for the same reason the metrics are: Perch's entry
 * shape varies by provider and a fixed path cost an entire pull to discover once already.
 */
export function tagLabels(entry: unknown, depth = 0): string[] {
  if (depth > 6 || entry === null || typeof entry !== 'object') return [];
  if (Array.isArray(entry)) return [...new Set(entry.flatMap((v) => tagLabels(v, depth + 1)))];
  const out: string[] = [];
  for (const [k, v] of Object.entries(entry as Json)) {
    if (k.toLowerCase() === 'tags' && Array.isArray(v)) {
      for (const t of v) {
        if (typeof t === 'string' && t.trim()) out.push(t.trim());
        else if (t && typeof t === 'object') {
          const label = (t as Json).label ?? (t as Json).name;
          if (typeof label === 'string' && label.trim()) out.push(label.trim());
        }
      }
    } else if (v !== null && typeof v === 'object') {
      out.push(...tagLabels(v, depth + 1));
    }
  }
  return [...new Set(out)];
}

/** The first plausible post permalink anywhere in an entry. */
function findPermalink(entry: unknown, depth = 0): string | null {
  if (depth > 6 || entry === null || typeof entry !== 'object') return null;
  if (Array.isArray(entry)) {
    for (const v of entry) { const hit = findPermalink(v, depth + 1); if (hit) return hit; }
    return null;
  }
  for (const [k, v] of Object.entries(entry as Json)) {
    if (typeof v === 'string' && /^https?:\/\//i.test(v)) {
      const keyed = URL_KEYS.some((u) => k.toLowerCase().replace(/[_\s-]/g, '').includes(u.toLowerCase()));
      // Only accept a bare URL that actually looks like a post, so a thumbnail/CDN link
      // never becomes the join key.
      if (keyed || /instagram\.com|youtube\.com|youtu\.be|linkedin\.com|facebook\.com|tiktok\.com|threads\.net|pinterest\./i.test(v)) {
        if (!/\.(jpg|jpeg|png|gif|webp|mp4|mov)(\?|$)/i.test(v)) return v;
      }
    }
    if (v !== null && typeof v === 'object') { const hit = findPermalink(v, depth + 1); if (hit) return hit; }
  }
  return null;
}

export interface ExtractResult {
  rows: SocialMetricInput[];
  /** Metric ids whose entries carried a value we could not confidently name. Reported,
   *  never guessed into a column. */
  unmappedMetricIds: string[];
}

/** One `results[]` group: the metric it answers for plus its per-post entries. */
export interface EntryGroup { metricId: string; entries: Json[] }

/**
 * Pull `results[].entries[]` out of a query_analytics response. Falls back to a deep scan
 * for anything carrying `entries` so a slightly different envelope still works.
 */
export function parseEntryGroups(payload: unknown): EntryGroup[] {
  const holders = deepFind(payload, ['entries']);
  const groups: EntryGroup[] = [];
  for (const h of holders) {
    const entries = h.entries;
    if (!Array.isArray(entries) || entries.length === 0) continue;
    const metric = h.metric as Json | undefined;
    groups.push({
      metricId: typeof metric?.id === 'string' ? metric.id : 'unknown',
      entries: entries.filter((e): e is Json => e !== null && typeof e === 'object' && !Array.isArray(e)),
    });
  }
  return groups;
}

/**
 * Turn Perch entries into ingest rows.
 *
 * The identifier lives on the entry (`unique_id`) while the numbers live nested under
 * `details`, so the entry's whole subtree is flattened and searched. A metric whose entries
 * carry a bare `value` is mapped by the METRIC_ID_FIELD table, since the response says which
 * metric it is answering for rather than naming the field.
 */
export function extractRows(payload: unknown, windowDays: number | null, channel: string | null): ExtractResult {
  const rows: SocialMetricInput[] = [];
  const unmapped = new Set<string>();

  for (const group of parseEntryGroups(payload)) {
    const mapped = METRIC_ID_FIELD.find(([re]) => re.test(group.metricId))?.[1] ?? null;

    for (const entry of group.entries) {
      const flat = flattenLeaves(entry);
      const id = pick(entry, ID_KEYS) ?? pick(flat, ID_KEYS);
      const url = findPermalink(entry);
      if (id === undefined && !url) continue; // nothing to key on — skip rather than orphan

      let rate = num(pick(flat, ['engagementRate', 'engagementPct', 'engagementPercent', 'engagement_rate']));
      if (rate !== null && rate > 0 && rate <= 1) rate = Math.round(rate * 100 * 1000) / 1000; // fraction → percent
      let engagements = num(pick(flat, ['engagements', 'engagement', 'totalEngagements', 'interactions']));
      let impressions = num(pick(flat, ['impressions', 'impressionCount']));
      let views = num(pick(flat, ['views', 'videoViews', 'viewCount', 'plays']));
      let reach = num(pick(flat, ['reach', 'uniqueReach']));
      let clicks = num(pick(flat, ['clicks', 'linkClicks', 'postClicks']));

      // A metric answering with a bare `value` tells us the field via the metric id.
      const bare = num(pick(flat, ['value', 'total', 'count']));
      if (bare !== null && mapped) {
        if (mapped === 'impressions' && impressions === null) impressions = bare;
        else if (mapped === 'views' && views === null) views = bare;
        else if (mapped === 'reach' && reach === null) reach = bare;
        else if (mapped === 'clicks' && clicks === null) clicks = bare;
        else if (mapped === 'engagements' && engagements === null) engagements = bare;
        else if (mapped === 'engagementRate' && rate === null) rate = bare > 0 && bare <= 1 ? Math.round(bare * 100 * 1000) / 1000 : bare;
      }

      const denom = impressions ?? views;
      if (rate === null && engagements !== null && denom && denom > 0) {
        rate = Math.round((engagements / denom) * 100 * 1000) / 1000;
      }

      const hasAny = [impressions, views, reach, engagements, rate, clicks].some((v) => v !== null);
      if (!hasAny) {
        // A number we can't name is worse than no number — putting it in the wrong column
        // would quietly misreport performance. So don't guess; report the metric id so the
        // mapping can be added deliberately.
        if (bare !== null && !mapped) unmapped.add(group.metricId);
        continue;
      }

      const entryChannel = pick(flat, ['channel', 'network', 'networkType', 'platform', 'socialNetwork', 'profileType']);
      rows.push({
        source: 'hootsuite:perch',
        publishedUrl: url,
        platformPostId: id === undefined ? null : String(id),
        channel: typeof entryChannel === 'string' ? entryChannel : channel,
        tags: tagLabels(entry),
        impressions,
        views,
        reach,
        engagements,
        engagementRate: rate,
        clicks,
        windowDays,
        raw: entry,
      });
    }
  }

  // The same post appears under several metrics (one call per metric), each carrying a
  // different number. Merge them into one row instead of letting the last write win.
  const merged = new Map<string, SocialMetricInput>();
  for (const r of rows) {
    const key = `${r.platformPostId ?? ''}|${r.publishedUrl ?? ''}`;
    const prev = merged.get(key);
    if (!prev) { merged.set(key, r); continue; }
    merged.set(key, {
      ...prev,
      impressions: prev.impressions ?? r.impressions,
      views: prev.views ?? r.views,
      reach: prev.reach ?? r.reach,
      engagements: prev.engagements ?? r.engagements,
      engagementRate: prev.engagementRate ?? r.engagementRate,
      clicks: prev.clicks ?? r.clicks,
      publishedUrl: prev.publishedUrl ?? r.publishedUrl,
      channel: prev.channel ?? r.channel,
      // Tags are a SET across a post's several metric entries — union, not last-write-wins,
      // because a given entry may carry them while another doesn't.
      tags: [...new Set([...(prev.tags ?? []), ...(r.tags ?? [])])],
    });
  }
  return { rows: [...merged.values()], unmappedMetricIds: [...unmapped] };
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
  /** Metric ids returning a value we deliberately refused to guess a column for. Each one
   *  is a line to add to METRIC_ID_FIELD. */
  unmappedMetricIds: string[];
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
 * The whole discovery + query pipeline for one [since, until] range, shared by the
 * scheduled cron pull (pullPerchMetrics) and the live custom-range fetch
 * (fetchPerchMetricsRange). Returns extracted rows only — neither caller's storage
 * decision (upsert vs. discard) belongs in here.
 */
async function collectPerchRows(since: string, until: string, windowDaysLabel: number | null): Promise<{ rows: SocialMetricInput[]; base: Omit<PullReport, keyof IngestReport>; errors: string[] }> {
  const notes: string[] = [];
  const errors: string[] = [];
  const base = { toolsSeen: [] as string[], workspaces: 0, providers: [] as string[], sourcesFound: 0, metricsQueried: [] as string[], metricsWithoutRows: [] as string[], unmappedMetricIds: [] as string[], notes };

  const session = await connect(PERCH_URL, await getAccessToken());
  if (!session.ok) return { rows: [], base, errors: [session.error.message] };

  const listed = await session.data.listTools();
  if (!listed.ok) return { rows: [], base, errors: [listed.error.message] };
  base.toolsSeen = listed.data.map((t) => t.name);

  const toolset = resolveToolset(listed.data);
  if (!toolset.ok) {
    return { rows: [], base, errors: [`Perch is missing expected analytics tools: ${toolset.missing.join(', ')}`] };
  }
  const T = toolset.data;

  const wsRes = await callJson(session.data, T.workspaces, {});
  if (!wsRes.ok) return { rows: [], base, errors: [wsRes.error] };
  const workspaces = parseWorkspaces(wsRes.json);
  base.workspaces = workspaces.length;
  if (workspaces.length === 0) {
    notes.push(`${T.workspaces} returned no workspace with tenantId/tenantType/tenantUUID. First 300 chars: ${wsRes.text.slice(0, 300)}`);
    return { rows: [], base, errors };
  }

  const rows: SocialMetricInput[] = [];

  for (const workspaceScope of workspaces) {
    const provRes = await callJson(session.data, T.providers, { workspaceScope });
    if (!provRes.ok) { errors.push(`${T.providers}: ${provRes.error}`); continue; }
    const providers = parseProviders(provRes.json);
    if (providers.length === 0) {
      notes.push(`No providers in workspace ${workspaceScope.tenantId}. First 200 chars: ${provRes.text.slice(0, 200)}`);
      continue;
    }
    for (const p of providers) {
      const label = `${p.dataService}/${p.dataType}`;
      if (!base.providers.includes(label)) base.providers.push(label);
    }

    // ONE call for every provider's sources, and ONE for every provider's metrics. Doing
    // this per provider is what triggered Hootsuite's 429s; both tools take arrays.
    const srcRes = await callJson(session.data, T.sources, { workspaceScope, providers });
    if (!srcRes.ok) { errors.push(`${T.sources}: ${srcRes.error}`); continue; }
    const sourcesByProvider = parseSourcesByProvider(srcRes.json);
    const withSources = providers.filter((p) => (sourcesByProvider.get(`${p.dataService}:${p.dataType}`) ?? []).length > 0);
    base.sourcesFound += [...sourcesByProvider.values()].reduce((n, ids) => n + ids.length, 0);
    if (withSources.length === 0) {
      notes.push(`No connected sources in workspace ${workspaceScope.tenantId}. First 200 chars: ${srcRes.text.slice(0, 200)}`);
      continue;
    }

    const metRes = await callJson(session.data, T.metrics, {
      workspaceScope,
      queries: withSources.map((p) => ({ providers: [p], query: 'post' })),
    });
    if (!metRes.ok) { errors.push(`${T.metrics}: ${metRes.error}`); continue; }

    for (const provider of withSources) {
      const label = `${provider.dataService}/${provider.dataType}`;
      const sourceIds = sourcesByProvider.get(`${provider.dataService}:${provider.dataType}`) ?? [];
      const all = parseMetrics(metRes.json, provider)
        .filter((m) => m.provider.dataService === provider.dataService && m.provider.dataType === provider.dataType);
      const multipart = all.filter((m) => m.dataFormat === 'MULTIPART');
      const chosen = (multipart.length ? multipart : all).slice(0, MAX_METRICS_PER_PROVIDER);
      if (chosen.length === 0) {
        notes.push(`No metrics discovered for ${label}. First 200 chars: ${metRes.text.slice(0, 200)}`);
        continue;
      }
      if (multipart.length === 0) {
        notes.push(`${label}: no MULTIPART (per-post) metric found; falling back to ${chosen.map((m) => `${m.label}[${m.dataFormat}]`).join(', ')} — these are likely profile-level, so per-post attribution may not be possible for this provider.`);
      }

      // One batched query_analytics for all of this provider's metrics. Entries fail
      // per-query upstream, so a bad metric costs its own result, not the batch.
      const qRes = await callJson(session.data, T.query, {
        queries: chosen.map((metric) => ({
          metricId: { id: metric.id, provider: metric.provider },
          sourceIds,
          timeRange: { since, until },
          ...(metric.dataFormat === 'MULTIPART' ? { limit: ENTRY_PAGE_LIMIT } : {}),
        })),
      });
      for (const metric of chosen) base.metricsQueried.push(`${label}:${metric.label}`);
      if (!qRes.ok) { errors.push(`${T.query} (${label}): ${qRes.error}`); continue; }

      const found = extractRows(qRes.json, windowDaysLabel, provider.dataService);
      if (found.unmappedMetricIds.length) {
        base.unmappedMetricIds.push(...found.unmappedMetricIds.filter((m) => !base.unmappedMetricIds.includes(m)));
      }
      if (found.rows.length === 0) {
        base.metricsWithoutRows.push(label);
        // A generous slice: the entry shape is the thing we are still learning, and a
        // 300-char preview already cost one whole pull to discover it was too short.
        notes.push(`${label} answered but no per-post row was built. Raw: ${qRes.text.slice(0, PREVIEW_CHARS)}`);
        continue;
      }
      rows.push(...found.rows);
    }
  }

  return { rows, base, errors };
}

/**
 * Walk the whole pipeline and ingest per-post numbers.
 *
 * Pulls across EVERY entitled workspace and source deliberately: the grant is read-only
 * analytics and we want all of Mindvalley's profiles, so there is no scope to choose. If
 * that ever needs narrowing, persist a selection rather than guessing one here.
 */
export async function pullPerchMetrics(windowDays = 30): Promise<PullReport> {
  const since = new Date(Date.now() - windowDays * 86400_000).toISOString().slice(0, 10);
  const until = new Date().toISOString().slice(0, 10);
  const fetched = await collectPerchRows(since, until, windowDays);
  if (fetched.rows.length === 0) return { ...emptyReport(), ...fetched.base, errors: fetched.errors };

  const report = await ingestSocialMetrics(fetched.rows);
  return { ...report, ...fetched.base, errors: [...fetched.errors, ...report.errors] };
}

/**
 * Live, on-demand pull for an arbitrary [since, until] date range (YYYY-MM-DD) — the
 * Performance page's custom date filter. Unlike pullPerchMetrics(), nothing here is
 * persisted to `social_metrics`.
 *
 * Why not just store it under a windowDays label: rows are deduped/upserted by
 * (source, post, windowDays, captured day) — see dedupeKeyFor() in social-perf.ts. An
 * arbitrary historical range (say, last month's 8-day launch window) has no honest
 * windowDays bucket, and reusing "7" or "30" for it would silently overwrite that day's
 * STANDING 7- or 30-day-ending-today row — the one the Wednesday/Monday Slack digests and
 * the default Performance page read. So a custom range is fetched fresh every time and
 * handed straight back to render; it costs a live Hootsuite call (~10-15s, and that
 * pipeline is known to rate-limit under repeated hits), which is why callers must gate who
 * can trigger this rather than exposing it to every viewer.
 */
export async function fetchPerchMetricsRange(since: string, until: string): Promise<{ rows: SocialMetricInput[]; errors: string[]; notes: string[] }> {
  const fetched = await collectPerchRows(since, until, null);
  return { rows: fetched.rows, errors: fetched.errors, notes: fetched.base.notes };
}

/**
 * Live, on-demand rollup for an arbitrary [since, until] date range — the Performance
 * page's custom filter. Unlike getAccountPerformance() (in social-perf.ts), this queries
 * Hootsuite Perch directly rather than reading the nightly cache (Perch's own windows
 * are fixed at 1/7/30 days ending today; an arbitrary range has no cached bucket to
 * read), and rolls the result up with the exact same rollupAccounts() math.
 *
 * Nothing here is persisted to `social_metrics` — see fetchPerchMetricsRange()'s doc
 * above for why a custom range must never be written under a windowDays label. That also
 * means no ticket-attribution (`attributed` is always 0): attaching a post to a ticket is
 * a write-side concern of the ingested/cached rows, not this ephemeral view.
 *
 * Callers MUST gate access before calling this — it spends a live Hootsuite API call
 * every time, and that pipeline is known to 429 under repeated hits.
 */
export async function getAccountPerformanceForRange(since: string, until: string, opts?: { limit?: number }): Promise<AccountPerformance> {
  const limit = opts?.limit ?? 10;
  const empty: AccountPerformance = { boards: [], posts: 0, reach: 0, avgEngagement: null, latestCapture: null, attributed: 0 };

  const { rows, errors } = await fetchPerchMetricsRange(since, until);
  if (rows.length === 0) {
    if (errors.length) throw new Error(errors[0]);
    return empty;
  }

  // A live pull can still see the same post from more than one provider/metric hit —
  // collapse the same way the cached path collapses repeat captures.
  const byPost = new Map<string, SocialMetricInput>();
  for (const r of rows) {
    const key = r.platformPostId ?? r.publishedUrl ?? '';
    if (!key || byPost.has(key)) continue;
    byPost.set(key, r);
  }

  const perAccount = new Map<string, SocialPostRow[]>();
  for (const [key, r] of byPost) {
    const meta = fromRaw(r.raw);
    const reach = reachOf({ views: r.views ?? null, impressions: r.impressions ?? null, reach: r.reach ?? null } as SocialMetricRow);
    // Rows here come straight off extractRows() and still carry their scheme
    // (normalizeUrl only runs at ingest time), unlike the cached path's stored rows.
    const rawUrl = r.publishedUrl ?? null;
    const url = meta.link ?? (isPostPermalink(rawUrl) ? rawUrl : null);
    const account = meta.account ?? 'Unattributed account';
    const row: SocialPostRow = {
      key,
      kind: url ? 'post' : 'story',
      platformPostId: r.platformPostId ?? null,
      ticketAirtableId: null,
      vsMedian: null,
      percentile: null,
      url,
      caption: meta.caption,
      account: meta.account,
      reach,
      engagements: r.engagements ?? null,
      engagementRate: r.engagementRate ?? null,
      postedAt: meta.postedAt,
      source: r.source,
    };
    (perAccount.get(account) ?? perAccount.set(account, []).get(account)!).push(row);
  }

  const boards = rollupAccounts(perAccount, limit);
  const allRated = [...perAccount.values()].flat().filter((x) => x.engagementRate !== null);
  return {
    boards,
    posts: byPost.size,
    reach: boards.reduce((n, b) => n + b.reach, 0),
    avgEngagement: allRated.length
      ? Math.round((allRated.reduce((n, x) => n + (x.engagementRate ?? 0), 0) / allRated.length) * 100) / 100
      : null,
    latestCapture: new Date().toISOString(),
    attributed: 0,
  };
}

/**
 * Every workspace → provider → source the current grant can actually see, with names.
 *
 * Exists because "the profile is synced in Hootsuite" and "this grant can read its
 * analytics" are different facts, and a pull that quietly covers one account looks
 * identical to one that covers them all. This answers which is happening.
 */
export async function discoverAccounts(): Promise<{ ok: true; text: string } | { ok: false; error: string }> {
  const session = await connect(PERCH_URL, await getAccessToken());
  if (!session.ok) return { ok: false, error: session.error.message };
  const listed = await session.data.listTools();
  if (!listed.ok) return { ok: false, error: listed.error.message };
  const toolset = resolveToolset(listed.data);
  if (!toolset.ok) return { ok: false, error: `Missing analytics tools: ${toolset.missing.join(', ')}` };
  const T = toolset.data;

  const wsRes = await callJson(session.data, T.workspaces, {});
  if (!wsRes.ok) return { ok: false, error: wsRes.error };
  const workspaces = parseWorkspaces(wsRes.json);
  if (workspaces.length === 0) return { ok: false, error: `No workspaces. Raw: ${wsRes.text.slice(0, 500)}` };

  const lines: string[] = [];
  for (const workspaceScope of workspaces) {
    lines.push(`WORKSPACE ${workspaceScope.tenantId} (${workspaceScope.tenantType})`);
    const provRes = await callJson(session.data, T.providers, { workspaceScope });
    if (!provRes.ok) { lines.push(`  ! ${provRes.error}`); continue; }
    const providers = parseProviders(provRes.json);
    if (providers.length === 0) { lines.push('  (no providers)'); continue; }

    const srcRes = await callJson(session.data, T.sources, { workspaceScope, providers });
    if (!srcRes.ok) { lines.push(`  ! ${srcRes.error}`); continue; }

    // Print the raw source objects: the label/name is the whole point here, and guessing
    // which field carries it is what we are trying to stop doing.
    const groups = deepFind(srcRes.json, ['provider', 'sources']);
    let anySource = false;
    for (const g of groups) {
      const p = g.provider as Provider | undefined;
      const sources = Array.isArray(g.sources) ? g.sources : [];
      if (sources.length === 0) continue;
      anySource = true;
      lines.push(`  ${p?.dataService}/${p?.dataType}:`);
      for (const src of sources) {
        const o = (src ?? {}) as Json;
        const name = o.label ?? o.name ?? o.username ?? o.handle ?? '(unnamed)';
        lines.push(`    · ${String(name)}  [id ${String(o.id ?? '?')}]`);
      }
    }
    if (!anySource) lines.push('  (no connected sources this grant can read)');
  }
  return { ok: true, text: lines.join('\n') };
}
