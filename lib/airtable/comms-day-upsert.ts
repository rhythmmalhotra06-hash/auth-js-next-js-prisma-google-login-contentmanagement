// Upsert Airtable 🗓️ Comms Calendar records → Postgres `comms_days`. Shared backbone for the
// backfill (a date window) and the inbound pull (changed rows).
//
// This is the DAY-LEVEL calendar (one row per date) — not 📅 Official Cal, which the
// `OfficialCalCC` model mirrors. See lib/airtable/field-map.ts COMMS_DAY.
//
// The `ro*` columns mirror formula/lookup fields for display only. They are read here and
// NEVER written back: Airtable rejects writes to them, so they are deliberately absent from
// comms-day-push-map.ts.

import { prisma } from '@/lib/prisma';
import { COMMS_DAY } from './field-map';
import { type AirtableRecord } from './rest';

const F = COMMS_DAY.fields;
const L = COMMS_DAY.links;
const RO = COMMS_DAY.readOnlyFields;

const str = (v: unknown): string | null => (typeof v === 'string' && v ? v : null);
const num = (v: unknown): number | null => (typeof v === 'number' && !Number.isNaN(v) ? v : null);
const bool = (v: unknown): boolean => v === true;

/** Airtable date fields arrive as "YYYY-MM-DD"; anything else is not a usable day. */
function dateOnly(v: unknown): Date | null {
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}/.test(v)) return null;
  const d = new Date(`${v.slice(0, 10)}T00:00:00Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** singleSelect / multipleSelects arrive as a string or {id,name}; store the name. */
function selectName(v: unknown): string | null {
  if (v == null) return null;
  if (typeof v === 'string') return v || null;
  if (typeof v === 'object' && 'name' in (v as object)) return String((v as { name: unknown }).name);
  return String(v);
}

// Link and lookup fields have TWO wire shapes and we see both:
//   • REST with returnFieldsByFieldId=true (lib/airtable/rest.ts, the sync path) → links are
//     plain recId string arrays, lookups are plain value arrays.
//   • The Airtable MCP (used for one-off backfills and verification) → links are
//     [{id,name},…] and lookups are {linkedRecordIds, valuesByLinkedRecordId}.
// Tolerating both costs three lines and removes a class of "the backfill wrote nulls" bug.

const linkIds = (v: unknown): string[] => {
  if (!Array.isArray(v)) {
    // MCP lookup envelope: pull the linked record ids out.
    if (v && typeof v === 'object' && Array.isArray((v as { linkedRecordIds?: unknown }).linkedRecordIds)) {
      return ((v as { linkedRecordIds: unknown[] }).linkedRecordIds).filter((x): x is string => typeof x === 'string');
    }
    return [];
  }
  return v
    .map((x) => (typeof x === 'string' ? x : x && typeof x === 'object' && 'id' in x ? String((x as { id: unknown }).id) : null))
    .filter((x): x is string => !!x);
};

/** First scalar behind a lookup/formula value, whichever shape it arrives in. */
function firstOf(v: unknown): unknown {
  if (Array.isArray(v)) return firstOf(v[0]);
  if (v && typeof v === 'object') {
    const env = v as { valuesByLinkedRecordId?: Record<string, unknown>; name?: unknown };
    if (env.valuesByLinkedRecordId) return firstOf(Object.values(env.valuesByLinkedRecordId)[0]);
    if ('name' in env) return env.name; // {id,name,color} select option
  }
  return v;
}
const lookupStr = (v: unknown): string | null => {
  const x = firstOf(v);
  return typeof x === 'string' && x ? x : null;
};
const lookupNum = (v: unknown): number | null => {
  const x = firstOf(v);
  if (typeof x === 'number' && !Number.isNaN(x)) return x;
  if (typeof x === 'string' && x.trim() && Number.isFinite(Number(x))) return Number(x);
  return null;
};

export function commsDayUpsertData(rec: AirtableRecord) {
  const f = rec.fields as Record<string, unknown>;
  return {
    date: dateOnly(f[F.date]),
    messageOfWeek: str(f[F.messageOfWeek]),
    theGoal: str(f[F.theGoal]),
    phase: selectName(f[F.phase]),
    coreMessage: bool(f[F.coreMessage]),
    internalNote: str(f[F.internalNote]),
    score: selectName(f[F.score]),
    campaignType: str(f[F.campaignType]),
    noOfEmails: num(f[F.noOfEmails]),

    landingPageSessions: num(f[F.landingPageSessions]),
    sublist: num(f[F.sublist]),
    attendees: num(f[F.attendees]),
    spSessions: num(f[F.spSessions]),
    sales: num(f[F.sales]),
    totalDailyRevenue: num(f[F.totalDailyRevenue]),

    officialCalIds: linkIds(f[L.officialCal]),
    initiativeIds: linkIds(f[L.initiative]),
    emailIds: linkIds(f[L.emails]),
    socialAssetIds: linkIds(f[L.socialAllAssets]),
    bannerIds: linkIds(f[L.featureBanner]),
    notificationIds: linkIds(f[L.marketingNotifications]),
    blogIds: linkIds(f[L.blog]),

    // Read-only mirror. roLeadGenGoal is what a campaign week's headline "leads" target is
    // measured against (decision S2).
    roLeadGenGoal: lookupNum(f[RO.leadGenGoal]),
    roTargetRevenue: lookupNum(f[RO.targetRevenue]),
    roProjectName: lookupStr(f[RO.projectName]),
    roStatus: lookupStr(f[RO.status]),
    roWeekday: lookupStr(f[RO.weekday]),
    roNameOfComms: lookupStr(f[RO.nameOfComms]),
  };
}

export async function upsertCommsDaysFromRecords(records: AirtableRecord[]): Promise<number> {
  for (const rec of records) {
    const data = commsDayUpsertData(rec);
    await prisma.commsDay.upsert({
      where: { airtableId: rec.id },
      create: { airtableId: rec.id, ...data },
      update: { ...data, syncedAt: new Date() },
    });
  }
  return records.length;
}
