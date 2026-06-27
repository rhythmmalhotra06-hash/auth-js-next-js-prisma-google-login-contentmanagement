// Airtable REST client (vendor-portal pattern) — the canonical data layer for the
// Airtable-direct architecture. Global rate-limit queue (5 req/s), 429/5xx retry,
// and discriminated-union results so callers handle failures explicitly.
// Field keys are always returned by field ID (returnFieldsByFieldId=true).

const API = 'https://api.airtable.com/v0';
const MAX_RPS = 5;
const INTERVAL_MS = Math.ceil(1000 / MAX_RPS); // 200ms
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

class RequestQueue {
  private queue: Array<() => Promise<void>> = [];
  private running = false;
  private last = 0;
  enqueue<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.queue.push(async () => {
        try { resolve(await fn()); } catch (e) { reject(e); }
      });
      this.drain();
    });
  }
  private async drain() {
    if (this.running) return;
    this.running = true;
    while (this.queue.length) {
      const elapsed = Date.now() - this.last;
      if (elapsed < INTERVAL_MS) await sleep(INTERVAL_MS - elapsed);
      const task = this.queue.shift()!;
      this.last = Date.now();
      await task();
    }
    this.running = false;
  }
}
const queue = new RequestQueue();

function token(): string | null {
  return process.env.AIRTABLE_TOKEN ?? process.env.AIRTABLE_API_KEY ?? null;
}

async function request<T>(url: string, options: RequestInit = {}): Promise<AirtableResult<T>> {
  const key = token();
  if (!key) return { ok: false, error: { type: 'UNAUTHORIZED', message: 'AIRTABLE_API_KEY/AIRTABLE_TOKEN not set' } };

  return queue.enqueue(async () => {
    let lastError: AirtableError | null = null;
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      if (attempt > 0) await sleep(Math.pow(2, attempt) * 500);
      let res: Response;
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
    }
    return { ok: false, error: lastError ?? { type: 'UNKNOWN', message: 'max retries exceeded' } };
  });
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
