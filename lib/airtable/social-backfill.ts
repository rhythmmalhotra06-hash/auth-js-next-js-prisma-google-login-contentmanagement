// One-time (idempotent) backfill: mirror engine-origin 📣 Social rows → Postgres.
// Engine rows are those with a non-empty Clip Source URL (the app's origin marker) — the
// same domain listSocialSuggestions serves. Includes rejected rows so the mirror is complete.

import { listAll } from './rest';
import { SOCIAL } from './field-map';
import { upsertSocialFromRecords } from './social-upsert';

export async function backfillSocial(): Promise<{ fetched: number; upserted: number }> {
  const res = await listAll(SOCIAL.baseId, SOCIAL.tableId, { filterByFormula: `NOT({Clip Source URL} = '')` });
  if (!res.ok) throw new Error(res.error.message);
  const upserted = await upsertSocialFromRecords(res.data);
  return { fetched: res.data.length, upserted };
}
