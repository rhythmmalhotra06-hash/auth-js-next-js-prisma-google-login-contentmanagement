// One asset's detail — artboard `5b`.
//
// TWO KINDS OF RECORD land here, and the id alone does not say which:
//
//   Vishen's lane      -> a `Videos` row in the VL base
//   Mindvalley's lane  -> a `📣 Social` row in the Content & Comms base
//
// The Mindvalley case is new. That lane used to emit synthetic `recXXX:email` placeholders that
// linked nowhere, so this page was Vishen-only by construction; now it carries real 📣 Social
// recIds and they must open something. The table is deliberately NOT encoded in the URL — that
// would turn every link already in the wild into a 404.
//
// Both tables are queried CONCURRENTLY and whichever answers wins. The obvious cheaper design —
// try Videos, fall back on NOT_FOUND — does not work: Airtable answers a foreign record id with
// "Invalid permissions, or the requested model was not found", which is a 403 rather than a 404,
// so the fallback never fired and the page threw. Racing both is one extra request on a
// single-record view and it cannot be fooled by how the API chooses to phrase a miss.
//
// WHAT THIS PAGE IS FOR. `Live Date` is the field the entire calendar hinges on and the field with
// no owner — 204 of 442 assets lack it and 66 of those are already published. So the detail view
// promotes it rather than tucking it in a corner, and every absence here names who closes it.

import { getRecord, listAll } from '@/lib/airtable/rest';
import { VL_VIDEOS, VL_MESSAGE_OF_WEEK, SOCIAL } from '@/lib/airtable/field-map';
import { getSocialPosts } from './social-posts';
import { meaningful } from '@/lib/mow/coverage';
import { splitJammedName, normaliseBrand, BRAND_LABEL } from '@/lib/mow/derive-week';

export interface AssetDetail {
  id: string;
  /** Which lane this record came from — the two carry genuinely different fields. */
  kind: 'video' | 'social';
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

  // ── Mindvalley-lane only. Null on a Videos record rather than absent, so the page can render
  //    one shape and let each field speak for itself.
  imageUrl: string | null;
  /** From the linked Creative Request. The answer to "who made this". */
  editor: string | null;
  ticketId: string | null;
  ticketStatus: string | null;
  assetLink: string | null;
  /** Perch results, when the caption matched (57% inside its window). Null means NOT MATCHED. */
  results: { reach: number | null; engagements: number | null; multiAccount: boolean } | null;
}

/**
 * A Mindvalley post's detail, from 📣 Social.
 *
 * This is where the creative ticket and the editor surface — the linked `Creative Request` carries
 * `Assigned Creative`, `Ticket Status` and the asset link as lookups, so one record answers "who
 * made this and where is it" without a cross-base hop.
 *
 * Measured 10 Sep across 8,564 records, because the page must not promise what the base rarely
 * holds: Title 100% · Channels 89% · image 62% · Creative Request 1% overall but 15% since July ·
 * ► Editor 10% (1% since July). So the ticket and editor are shown when present and named as gaps
 * when not, rather than being quietly omitted.
 */
async function buildSocialDetail(recordId: string, f: Record<string, unknown>): Promise<AssetDetail> {
  const posts = await getSocialPosts([recordId]);
  const p = posts.get(recordId);

  return {
    id: recordId,
    kind: 'social',
    title: p?.title ?? str(f[SOCIAL.fields.title]) ?? '(untitled)',
    liveDate: p?.liveDate ?? null,
    status: p?.status ?? null,
    published: !!p?.publishedUrl || !!p?.results,
    channel: p?.channels.join(' · ') ?? null,
    source: null,
    publishedUrl: p?.publishedUrl ?? null,
    read24h: null,
    approval: null,
    messageName: null,
    goal: null,
    brandLabel: 'Mindvalley',
    siblings: [],
    imageUrl: p?.imageUrl ?? null,
    editor: p?.editor ?? null,
    ticketId: p?.ticketId ?? null,
    ticketStatus: p?.ticketStatus ?? null,
    assetLink: p?.assetLink ?? null,
    results: p?.results ?? null,
  };
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
  const [res, socialRes] = await Promise.all([
    getRecord(VL_VIDEOS.baseId, VL_VIDEOS.tableId, recordId),
    getRecord(SOCIAL.baseId, SOCIAL.tableId, recordId),
  ]);

  if (!res.ok) {
    if (socialRes.ok) return buildSocialDetail(recordId, socialRes.data.fields as Record<string, unknown>);
    // Neither table has it. A deleted or mistyped id is "not found", not a crash.
    if (res.error.type === 'NOT_FOUND' || socialRes.error.type === 'NOT_FOUND') return null;
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
    kind: 'video',
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
    // Videos rows have no post-level equivalents; the page renders them only for social records.
    imageUrl: null,
    editor: null,
    ticketId: null,
    ticketStatus: null,
    assetLink: null,
    results: null,
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
