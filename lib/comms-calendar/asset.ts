// One asset's detail — artboard `5b`.
//
// Vishen-lane only, and that is a data fact rather than a scoping decision: a Mindvalley "asset" on
// this calendar is a synthetic row (`recXXX:email`) standing for a comms-day's link count, because
// resolving every linked Email and Social title would be a round-trip per row for something the
// meeting reads as volume. There is no MV record to open, so nothing links to one.
//
// WHAT THIS PAGE IS FOR. `Live Date` is the field the entire calendar hinges on and the field with
// no owner — 204 of 442 assets lack it and 66 of those are already published. So the detail view
// promotes it rather than tucking it in a corner, and every absence here names who closes it.

import { getRecord, listAll } from '@/lib/airtable/rest';
import { VL_VIDEOS, VL_MESSAGE_OF_WEEK } from '@/lib/airtable/field-map';
import { meaningful } from '@/lib/mow/coverage';
import { splitJammedName, normaliseBrand, BRAND_LABEL } from '@/lib/mow/derive-week';

export interface AssetDetail {
  id: string;
  title: string;
  /** THE field. Null is the common case and is the point of the page, not an error. */
  liveDate: string | null;
  status: string | null;
  published: boolean;
  channel: string | null;
  source: string | null;
  publishedUrl: string | null;
  /**
   * The 24-hour read. Empty on EVERY published asset in the base as of 10 Sep.
   * Renders as "not filled", never as `0` — an empty field is not a zero result.
   */
  read24h: string | null;
  approval: string | null;
  /** The message it inherits, and that message's goal. Both suppress placeholders (Y2). */
  messageName: string | null;
  goal: string | null;
  /**
   * The message's brand, as a normalised LABEL.
   *
   * Never the raw Airtable value: 6 of the 7 master records are tagged `Mindalley`, a live
   * misspelling. The design handoff proposed surfacing it as a `misspelled upstream` chip and
   * flagged that as needing confirmation before a viewer saw it. Consistent with Y2 it is not
   * shown — `normaliseBrand` recognises both spellings and `BRAND_LABEL` renders the correct one.
   * The value is never rewritten in Airtable; the fix belongs there, followed by a reconcile.
   */
  brandLabel: string | null;
  /** Other assets carrying the same message. Empty is ordinary — one asset in the base is linked. */
  siblings: { id: string; title: string; liveDate: string | null; published: boolean }[];
}

const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null);
const ids = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
function selectName(v: unknown): string | null {
  if (v == null) return null;
  if (typeof v === 'string') return v || null;
  if (Array.isArray(v)) return selectName(v[0]);
  if (typeof v === 'object' && 'name' in (v as object)) return String((v as { name: unknown }).name);
  return null;
}

export async function getAssetDetail(recordId: string): Promise<AssetDetail | null> {
  const res = await getRecord(VL_VIDEOS.baseId, VL_VIDEOS.tableId, recordId);
  if (!res.ok) {
    // A deleted or mistyped id is "not found", not a crash — the caller renders a friendly page.
    // Uses the REST layer's own typed discriminant rather than a raw status code.
    if (res.error.type === 'NOT_FOUND') return null;
    throw new Error(`Could not read the asset: ${res.error.message}`);
  }

  const f = res.data.fields as Record<string, unknown>;
  const status = selectName(f[VL_VIDEOS.fields.status]);
  const msgIds = ids(f[VL_VIDEOS.links.messageOfWeek]);

  let messageName: string | null = null;
  let goal: string | null = null;
  let brandLabel: string | null = null;
  let siblings: AssetDetail['siblings'] = [];

  if (msgIds.length) {
    const msgRes = await getRecord(VL_MESSAGE_OF_WEEK.baseId, VL_MESSAGE_OF_WEEK.tableId, msgIds[0]);
    if (msgRes.ok) {
      const mf = msgRes.data.fields as Record<string, unknown>;
      const brand = normaliseBrand(selectName(mf[VL_MESSAGE_OF_WEEK.fields.brand]));
      brandLabel = brand ? BRAND_LABEL[brand] : null;
      messageName = meaningful(splitJammedName(str(mf[VL_MESSAGE_OF_WEEK.fields.name]), brand));
      goal = meaningful(str(mf[VL_MESSAGE_OF_WEEK.fields.goal]));
    }
    siblings = await siblingsOf(msgIds[0], recordId);
  }

  return {
    id: res.data.id,
    title: str(f[VL_VIDEOS.fields.name]) ?? '(untitled)',
    liveDate: str(f[VL_VIDEOS.fields.liveDate])?.slice(0, 10) ?? null,
    status,
    published: !!status && status.startsWith('7'),
    channel: selectName(f[VL_VIDEOS.fields.medium]),
    source: selectName(f[VL_VIDEOS.fields.source]),
    publishedUrl: str(f[VL_VIDEOS.fields.publishedLink]),
    read24h: meaningful(str(f[VL_VIDEOS.fields.data24h])),
    approval: selectName(f[VL_VIDEOS.fields.approval]),
    messageName,
    goal,
    brandLabel,
    siblings,
  };
}

/**
 * Assets sharing this asset's message.
 *
 * Filtered client-side rather than with a `filterByFormula` on the link field: Airtable's formula
 * language matches link fields by their DISPLAY value, and the display value here is the message
 * name — which is `test` on the only linked record and would be a name-based lookup, the exact
 * pattern that has already caused silent data loss on this project. One list pass is cheaper than
 * being subtly wrong.
 */
async function siblingsOf(messageId: string, excludeId: string): Promise<AssetDetail['siblings']> {
  const res = await listAll(VL_VIDEOS.baseId, VL_VIDEOS.tableId);
  if (!res.ok) return [];

  return res.data
    .filter((r) => r.id !== excludeId && ids((r.fields as Record<string, unknown>)[VL_VIDEOS.links.messageOfWeek]).includes(messageId))
    .map((r) => {
      const f = r.fields as Record<string, unknown>;
      const st = selectName(f[VL_VIDEOS.fields.status]);
      return {
        id: r.id,
        title: str(f[VL_VIDEOS.fields.name]) ?? '(untitled)',
        liveDate: str(f[VL_VIDEOS.fields.liveDate])?.slice(0, 10) ?? null,
        published: !!st && st.startsWith('7'),
      };
    })
    .sort((a, b) => (a.liveDate ?? '9999').localeCompare(b.liveDate ?? '9999'));
}
