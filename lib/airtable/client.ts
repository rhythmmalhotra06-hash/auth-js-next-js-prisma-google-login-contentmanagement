// Minimal Airtable REST client for reference-data pulls.
//
// Airtable allows ~5 req/s per base + monthly caps (CLAUDE.md §2/§8), so requests
// are spaced and 429s are backed off. Fields come back keyed by FIELD ID
// (returnFieldsByFieldId=true) for rename stability.

const API = 'https://api.airtable.com/v0';

export interface AirtableRecord {
  id: string; // rec… — our airtable_id provenance
  fields: Record<string, unknown>; // keyed by field ID
}

function token(): string {
  // Local dev uses AIRTABLE_TOKEN; the Kessel service has AIRTABLE_API_KEY. Accept either.
  const t = process.env.AIRTABLE_TOKEN ?? process.env.AIRTABLE_API_KEY;
  if (!t) throw new Error('No Airtable token (set AIRTABLE_TOKEN or AIRTABLE_API_KEY; needs data.records:read scope).');
  return t;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Stay under ~5 req/s per base.
const MIN_INTERVAL_MS = 220;
const MAX_429_RETRIES = 5;

/**
 * Single Airtable request with 429 backoff. Returns the parsed JSON body.
 * Shared by all read/write helpers so the rate-limit handling lives in one place.
 */
async function request<T>(url: string | URL, init?: RequestInit): Promise<T> {
  let retries = 0;
  for (;;) {
    const res = await fetch(url, {
      ...init,
      headers: {
        Authorization: `Bearer ${token()}`,
        ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
        ...init?.headers,
      },
    });
    if (res.status === 429) {
      if (++retries > MAX_429_RETRIES) throw new Error(`${url}: rate-limited after ${MAX_429_RETRIES} retries`);
      await sleep(Math.min(1000 * 2 ** retries, 10000)); // exponential backoff
      continue;
    }
    if (!res.ok) throw new Error(`${url}: ${res.status} ${await res.text()}`);
    return (await res.json()) as T;
  }
}

/** List every record in a table, following pagination. */
export async function listRecords(baseId: string, tableId: string): Promise<AirtableRecord[]> {
  const out: AirtableRecord[] = [];
  let offset: string | undefined;

  do {
    const url = new URL(`${API}/${baseId}/${tableId}`);
    url.searchParams.set('pageSize', '100');
    url.searchParams.set('returnFieldsByFieldId', 'true');
    if (offset) url.searchParams.set('offset', offset);

    const json = await request<{ records: AirtableRecord[]; offset?: string }>(url);
    out.push(...json.records);
    offset = json.offset;
    await sleep(MIN_INTERVAL_MS);
  } while (offset);

  return out;
}

/** Fetch a single record by ID (used for lazy reference upserts). */
export async function getRecord(baseId: string, tableId: string, recordId: string): Promise<AirtableRecord> {
  const url = new URL(`${API}/${baseId}/${tableId}/${recordId}`);
  url.searchParams.set('returnFieldsByFieldId', 'true');
  const rec = await request<AirtableRecord>(url);
  await sleep(MIN_INTERVAL_MS);
  return rec;
}
