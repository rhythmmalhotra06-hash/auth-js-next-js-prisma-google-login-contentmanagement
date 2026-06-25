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

/** List every record in a table, following pagination. */
export async function listRecords(baseId: string, tableId: string): Promise<AirtableRecord[]> {
  const out: AirtableRecord[] = [];
  let offset: string | undefined;

  do {
    const url = new URL(`${API}/${baseId}/${tableId}`);
    url.searchParams.set('pageSize', '100');
    url.searchParams.set('returnFieldsByFieldId', 'true');
    if (offset) url.searchParams.set('offset', offset);

    let retries = 0;
    for (;;) {
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token()}` } });
      if (res.status === 429) {
        if (++retries > MAX_429_RETRIES) throw new Error(`${tableId}: rate-limited after ${MAX_429_RETRIES} retries`);
        await sleep(Math.min(1000 * 2 ** retries, 10000)); // exponential backoff
        continue;
      }
      if (!res.ok) throw new Error(`${baseId}/${tableId}: ${res.status} ${await res.text()}`);
      const json = (await res.json()) as { records: AirtableRecord[]; offset?: string };
      out.push(...json.records);
      offset = json.offset;
      break;
    }
    await sleep(MIN_INTERVAL_MS);
  } while (offset);

  return out;
}
