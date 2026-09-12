// Braze REST client — the three endpoints the email half of the performance loop needs.
//
// ── WHY WE CALL BRAZE OURSELVES ───────────────────────────────────────────────────────────────
//
// Marketing Ops already has a Braze app (`mindvalley-ai/brazeops-hub`, Monique's), and the
// obvious move was to read from it. It has no database: its dashboard is these same REST calls
// in a 15-minute in-memory cache per Cloud Run instance, behind IAP with no service-token path,
// and its JSON route is scoped to eight newsletter tags — most comms-calendar emails would
// simply be absent from the response. So there is nothing to read. What that app did give us for
// free is the shape of the summing loop and the two constraints below, learned there rather than
// the hard way.
//
// ── TWO CONSTRAINTS THAT DECIDE WHAT WE CAN HONESTLY SHOW ─────────────────────────────────────
//
//  1. `/campaigns/data_series` returns DAILY buckets. There is no hourly granularity, so a
//     literal "last 24 hours" is not available at any price. The closest true figure is the send
//     day plus the next one, which is what `windowDays = 2` means everywhere in this codebase.
//  2. Opens keep arriving for days. The Braze Ops hub excludes anything younger than 48h from
//     its own ranking for exactly this reason; we show the number but label it as still counting.
//
// ── KEY ──────────────────────────────────────────────────────────────────────────────────────
//
// `BRAZE_API_KEY` needs `campaigns.list`, `campaigns.details` and `campaigns.data_series`. Braze
// keys CANNOT be edited after creation — only deleted and recreated — so all three have to be on
// it from the start. The REST host is per-cluster; ours is `rest.iad-01.braze.com`.

import { perfLog } from '@/lib/perf/timed';

const DEFAULT_ENDPOINT = 'https://rest.iad-01.braze.com';
const MAX_RETRIES = 3;

export interface BrazeError {
  type: 'UNAUTHORIZED' | 'RATE_LIMIT' | 'SERVER_ERROR' | 'NETWORK_ERROR' | 'NOT_CONFIGURED' | 'UNKNOWN';
  message: string;
  status?: number;
}
export type BrazeResult<T> = { ok: true; data: T } | { ok: false; error: BrazeError };

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

function endpoint(): string {
  return (process.env.BRAZE_REST_ENDPOINT || DEFAULT_ENDPOINT).replace(/\/+$/, '');
}

export function brazeConfigured(): boolean {
  return !!process.env.BRAZE_API_KEY;
}

async function request<T>(path: string, params: Record<string, string | number | undefined> = {}): Promise<BrazeResult<T>> {
  const key = process.env.BRAZE_API_KEY;
  if (!key) {
    return { ok: false, error: { type: 'NOT_CONFIGURED', message: 'BRAZE_API_KEY is not set' } };
  }

  const url = new URL(`${endpoint()}${path}`);
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, String(v));
  }

  const t0 = performance.now();
  let last: BrazeError | null = null;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    // Braze's own guidance on a 429 is to back off; its rate limits are per-endpoint and
    // generous for data_series, so this should stay theoretical at our volume.
    if (attempt > 0) await sleep(Math.pow(2, attempt) * 500);
    try {
      const res = await fetch(url, { headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' } });

      if (res.status === 401 || res.status === 403) {
        const body = (await res.json().catch(() => ({}))) as { message?: string };
        // Most likely cause: the key was created without one of the three permissions, and
        // Braze keys cannot be edited — so name that rather than a bare "forbidden".
        return {
          ok: false,
          error: {
            type: 'UNAUTHORIZED',
            message: `${body?.message ?? 'unauthorized'} — check the key carries campaigns.list, campaigns.details and campaigns.data_series`,
            status: res.status,
          },
        };
      }
      if (res.status === 429) { last = { type: 'RATE_LIMIT', message: 'rate limited', status: 429 }; continue; }
      if (res.status >= 500) { last = { type: 'SERVER_ERROR', message: `server ${res.status}`, status: res.status }; continue; }
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        return { ok: false, error: { type: 'UNKNOWN', message: text || `HTTP ${res.status}`, status: res.status } };
      }
      return { ok: true, data: (await res.json()) as T };
    } catch (err) {
      last = { type: 'NETWORK_ERROR', message: String(err) };
    } finally {
      perfLog(`braze ${path}`, performance.now() - t0, attempt ? `attempt=${attempt + 1}` : undefined);
    }
  }
  return { ok: false, error: last ?? { type: 'UNKNOWN', message: 'max retries exceeded' } };
}

// ── /campaigns/list ───────────────────────────────────────────────────────────────────────────

export interface BrazeCampaignSummary {
  id: string;
  name: string;
  tags?: string[];
  last_edited?: string;
  is_api_campaign?: boolean;
}

const LIST_PAGE_SIZE = 100; // Braze's fixed page size for this endpoint.

/**
 * Every campaign edited since `sinceIso`, newest first.
 *
 * `last_edit.time[gt]` filters on EDIT time, not send time — a campaign edited long after it
 * sent still shows up, and one that sent recently but was built weeks ago also shows up because
 * scheduling counts as an edit. It is a cheap way to bound the scan, not a send-date filter;
 * the send date comes from `first_sent` on the detail call.
 */
export async function listCampaigns(sinceIso: string, maxPages = 20): Promise<BrazeResult<BrazeCampaignSummary[]>> {
  const out: BrazeCampaignSummary[] = [];
  for (let page = 0; page < maxPages; page++) {
    const res = await request<{ campaigns?: BrazeCampaignSummary[] }>('/campaigns/list', {
      page,
      include_archived: 'false',
      sort_direction: 'desc',
      'last_edit.time[gt]': sinceIso,
    });
    if (!res.ok) return res;
    const batch = res.data.campaigns ?? [];
    out.push(...batch);
    if (batch.length < LIST_PAGE_SIZE) break;
  }
  return { ok: true, data: out };
}

// ── /campaigns/details ────────────────────────────────────────────────────────────────────────

export interface BrazeMessage {
  channel?: string;
  subject?: string;
  preheader?: string;
  from?: string;
  /** 'control' variants are holdouts and carry no send of their own. */
  message_variation_id?: string;
}

export interface BrazeCampaignDetails {
  name?: string;
  created_at?: string;
  first_sent?: string;
  last_sent?: string;
  tags?: string[];
  channels?: string[];
  messages?: Record<string, BrazeMessage>;
}

export function getCampaignDetails(campaignId: string): Promise<BrazeResult<BrazeCampaignDetails>> {
  return request<BrazeCampaignDetails>('/campaigns/details', { campaign_id: campaignId });
}

// ── /campaigns/data_series ────────────────────────────────────────────────────────────────────

/** One variant's numbers inside one day's bucket. Every field is optional — Braze omits zeroes. */
export interface BrazeVariantStats {
  variation_name?: string;
  sent?: number;
  delivered?: number;
  unique_opens?: number;
  machine_open?: number;
  unique_clicks?: number;
  unsubscribes?: number;
  reported_spam?: number;
  conversions_by_send_time?: number;
  conversions?: number;
  revenue?: number;
}

export interface BrazeDataSeriesPoint {
  time: string;
  messages?: Record<string, BrazeVariantStats[]>;
}

/**
 * Daily buckets for a campaign, most recent `length` days.
 *
 * `length` is in DAYS and caps at 100. There is no hourly option — see the file header.
 */
export function getCampaignDataSeries(campaignId: string, length = 14): Promise<BrazeResult<{ data?: BrazeDataSeriesPoint[] }>> {
  return request<{ data?: BrazeDataSeriesPoint[] }>('/campaigns/data_series', {
    campaign_id: campaignId,
    length: Math.min(Math.max(length, 1), 100),
  });
}
