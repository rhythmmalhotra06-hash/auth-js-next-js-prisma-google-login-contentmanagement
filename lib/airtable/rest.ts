// Airtable REST client (vendor-portal pattern) — the canonical data layer for the
// Airtable-direct architecture. Per-base rate limiting (5 req/s, concurrent — see
// `limiter.ts` for what it replaced), 429/5xx retry, and discriminated-union results so
// callers handle failures explicitly.
// Field keys are always returned by field ID (returnFieldsByFieldId=true).

import { acquire, baseOf, currentInflight } from './limiter';
import { perfLog } from '@/lib/perf/timed';

const API = 'https://api.airtable.com/v0';
const MAX_RETRIES = 3;

export interface AirtableRecord<T = Record<string, unknown>> {
  id: string;
  fields: T;
  createdTime: string;
}
export interface AirtableListResponse<T = Record<string, unknown>> {
  records: AirtableRecord<T>[];
  offset?: string;
}
export interface AirtableError {
  type: 'RATE_LIMIT' | 'NOT_FOUND' | 'UNAUTHORIZED' | 'SERVER_ERROR' | 'NETWORK_ERROR' | 'UNKNOWN';
  message: string;
  status?: number;
}
export type AirtableResult<T> = { ok: true; data: T } | { ok: false; error: AirtableError };

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

function token(): string | null {
  return process.env.AIRTABLE_TOKEN ?? process.env.AIRTABLE_API_KEY ?? null;
}

/** `base/table[/record]` for the perf line — enough to recognise the call, never the query. */
function labelOf(url: string): string {
  const m = /\/v0\/([^/?]+)\/([^/?]+)(?:\/([^/?]+))?/.exec(url);
  return m ? `${m[1]}/${m[2]}${m[3] ? '/rec' : ''}` : 'airtable';
}

async function request<T>(url: string, options: RequestInit = {}): Promise<AirtableResult<T>> {
  const key = token();
  if (!key) return { ok: false, error: { type: 'UNAUTHORIZED', message: 'AIRTABLE_API_KEY/AIRTABLE_TOKEN not set' } };

  const base = baseOf(url);
  const t0 = performance.now();
  let lastError: AirtableError | null = null;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    if (attempt > 0) await sleep(Math.pow(2, attempt) * 500);
    // Each attempt takes its own slot, so a 429 retry is spaced by the limiter too.
    const release = await acquire(base);
    const started = currentInflight();
    let res: Response;
    try {
      try {
        res = await fetch(url, {
          ...options,
          headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', ...options.headers },
        });
      } catch (err) {
        lastError = { type: 'NETWORK_ERROR', message: String(err) };
        continue;
      }
      if (res.status === 429) { lastError = { type: 'RATE_LIMIT', message: 'rate limited', status: 429 }; continue; }
      if (res.status === 401 || res.status === 403) {
        const b = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
        return { ok: false, error: { type: 'UNAUTHORIZED', message: b?.error?.message ?? 'unauthorized', status: res.status } };
      }
      if (res.status === 404) return { ok: false, error: { type: 'NOT_FOUND', message: 'not found', status: 404 } };
      if (res.status >= 500) { lastError = { type: 'SERVER_ERROR', message: `server ${res.status}`, status: res.status }; continue; }
      if (!res.ok) {
        const body = await res.text().catch(() => '');
        let message = body || `HTTP ${res.status}`;
        try {
          const p = JSON.parse(body) as { error?: { message?: string; type?: string } };
          if (p?.error?.message) message = p.error.type ? `${p.error.type}: ${p.error.message}` : p.error.message;
        } catch { /* raw text */ }
        return { ok: false, error: { type: 'UNKNOWN', message, status: res.status } };
      }
      return { ok: true, data: (await res.json()) as T };
    } finally {
      release();
      perfLog(`airtable ${labelOf(url)}`, performance.now() - t0, `inflight=${started}${attempt ? ` attempt=${attempt + 1}` : ''}`);
    }
  }
  // Out of retries. A 429 here means the limiter's model of the budget is wrong — say so loudly.
  if (lastError?.type === 'RATE_LIMIT') console.warn(`[airtable] 429 exhausted retries on ${labelOf(url)}`);
  return { ok: false, error: lastError ?? { type: 'UNKNOWN', message: 'max retries exceeded' } };
}

export interface ListParams {
  filterByFormula?: string;
  fields?: string[];
  maxRecords?: number;
  pageSize?: number;
  offset?: string;
  sort?: { field: string; direction?: 'asc' | 'desc' }[];
}

export async function listRecords<T = Record<string, unknown>>(
  baseId: string,
  tableId: string,
  params: ListParams = {},
): Promise<AirtableResult<AirtableListResponse<T>>> {
  const url = new URL(`${API}/${baseId}/${tableId}`);
  url.searchParams.set('returnFieldsByFieldId', 'true');
  if (params.filterByFormula) url.searchParams.set('filterByFormula', params.filterByFormula);
  if (params.maxRecords) url.searchParams.set('maxRecords', String(params.maxRecords));
  if (params.pageSize) url.searchParams.set('pageSize', String(params.pageSize));
  if (params.offset) url.searchParams.set('offset', params.offset);
  params.fields?.forEach((f, i) => url.searchParams.set(`fields[${i}]`, f));
  params.sort?.forEach((s, i) => {
    url.searchParams.set(`sort[${i}][field]`, s.field);
    if (s.direction) url.searchParams.set(`sort[${i}][direction]`, s.direction);
  });
  return request<AirtableListResponse<T>>(url.toString());
}

/** List ALL records across pages (use only with a filter — never on raw 10k+ tables). */
export async function listAll<T = Record<string, unknown>>(
  baseId: string,
  tableId: string,
  params: ListParams = {},
): Promise<AirtableResult<AirtableRecord<T>[]>> {
  const out: AirtableRecord<T>[] = [];
  let offset: string | undefined = params.offset;
  do {
    const res: AirtableResult<AirtableListResponse<T>> = await listRecords<T>(baseId, tableId, { ...params, offset });
    if (!res.ok) return res;
    out.push(...res.data.records);
    offset = res.data.offset;
  } while (offset);
  return { ok: true, data: out };
}

export async function getRecord<T = Record<string, unknown>>(
  baseId: string,
  tableId: string,
  recordId: string,
): Promise<AirtableResult<AirtableRecord<T>>> {
  return request<AirtableRecord<T>>(`${API}/${baseId}/${tableId}/${recordId}?returnFieldsByFieldId=true`);
}

export async function createRecord<T = Record<string, unknown>>(
  baseId: string,
  tableId: string,
  fields: Record<string, unknown>,
): Promise<AirtableResult<AirtableRecord<T>>> {
  return request<AirtableRecord<T>>(`${API}/${baseId}/${tableId}`, {
    method: 'POST',
    body: JSON.stringify({ fields, returnFieldsByFieldId: true }),
  });
}

export async function updateRecord<T = Record<string, unknown>>(
  baseId: string,
  tableId: string,
  recordId: string,
  fields: Record<string, unknown>,
): Promise<AirtableResult<AirtableRecord<T>>> {
  return request<AirtableRecord<T>>(`${API}/${baseId}/${tableId}/${recordId}`, {
    method: 'PATCH',
    body: JSON.stringify({ fields, returnFieldsByFieldId: true }),
  });
}

/** Create multiple records (Airtable caps writes at 10/request — batches + paced via the queue). */
export async function createRecords<T = Record<string, unknown>>(
  baseId: string,
  tableId: string,
  records: { fields: Record<string, unknown> }[],
): Promise<AirtableResult<AirtableRecord<T>[]>> {
  const out: AirtableRecord<T>[] = [];
  for (let i = 0; i < records.length; i += 10) {
    const batch = records.slice(i, i + 10);
    const res = await request<AirtableListResponse<T>>(`${API}/${baseId}/${tableId}`, {
      method: 'POST',
      body: JSON.stringify({ records: batch, returnFieldsByFieldId: true }),
    });
    if (!res.ok) return res;
    out.push(...res.data.records);
  }
  return { ok: true, data: out };
}
