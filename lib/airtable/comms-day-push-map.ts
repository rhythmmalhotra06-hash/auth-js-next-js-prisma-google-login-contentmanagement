// PG comms_day → Airtable 🗓️ Comms Calendar field payload.
//
// WRITABLE SUBSET ONLY. Airtable rejects writes to formula / rollup / lookup / createdTime /
// lastModifiedTime fields, and 31 of this table's 75 are exactly that. Everything mirrored into
// a `ro*` column is therefore absent from this payload by design — including the lead-gen goal
// and target revenue, which are lookups off 📅 Official Cal and must be edited there.
//
// Anything added here MUST be checked against COMMS_DAY.readOnlyFields first. A write to a
// computed field fails the whole PATCH, which surfaces as "the sync is broken" rather than
// "that field isn't ours".

import { COMMS_DAY } from './field-map';

const F = COMMS_DAY.fields;
const L = COMMS_DAY.links;

export interface CommsDayForPush {
  date: Date | null;
  messageOfWeek: string | null;
  theGoal: string | null;
  phase: string | null;
  coreMessage: boolean;
  internalNote: string | null;
  score: string | null;
  campaignType: string | null;
  noOfEmails: number | null;
  landingPageSessions: number | null;
  sublist: number | null;
  attendees: number | null;
  spSessions: number | null;
  sales: number | null;
  totalDailyRevenue: unknown; // Prisma Decimal | null
  officialCalIds: string[];
  initiativeIds: string[];
  emailIds: string[];
  socialAssetIds: string[];
  bannerIds: string[];
  notificationIds: string[];
  blogIds: string[];
}

/** Airtable date fields want a bare "YYYY-MM-DD"; the column is @db.Date so UTC is exact. */
const ymd = (d: Date | null): string | null => (d ? d.toISOString().slice(0, 10) : null);

/** Prisma Decimal serializes via toString(); Airtable currency wants a number. */
function decimal(v: unknown): number | null {
  if (v == null) return null;
  const n = Number(typeof v === 'object' && 'toString' in (v as object) ? (v as object).toString() : v);
  return Number.isFinite(n) ? n : null;
}

export function commsDayToAirtableFields(c: CommsDayForPush): Record<string, unknown> {
  return {
    [F.date]: ymd(c.date),
    [F.messageOfWeek]: c.messageOfWeek,
    [F.theGoal]: c.theGoal,
    [F.phase]: c.phase,
    [F.coreMessage]: c.coreMessage,
    [F.internalNote]: c.internalNote,
    [F.score]: c.score,
    [F.campaignType]: c.campaignType,
    [F.noOfEmails]: c.noOfEmails,
    [F.landingPageSessions]: c.landingPageSessions,
    [F.sublist]: c.sublist,
    [F.attendees]: c.attendees,
    [F.spSessions]: c.spSessions,
    [F.sales]: c.sales,
    [F.totalDailyRevenue]: decimal(c.totalDailyRevenue),
    [L.officialCal]: c.officialCalIds,
    [L.initiative]: c.initiativeIds,
    [L.emails]: c.emailIds,
    [L.socialAllAssets]: c.socialAssetIds,
    [L.featureBanner]: c.bannerIds,
    [L.marketingNotifications]: c.notificationIds,
    [L.blog]: c.blogIds,
  };
}

/** Field ids this payload must never contain. Asserted by the unit guard below. */
export const COMMS_DAY_READ_ONLY_IDS: readonly string[] = Object.values(COMMS_DAY.readOnlyFields);

/**
 * Fail loudly and locally if a computed field ever creeps into the push payload — better than
 * a 422 from Airtable that reads like a broken sync. Called by the push handler before sending.
 */
export function assertNoReadOnlyFields(fields: Record<string, unknown>): void {
  const offenders = Object.keys(fields).filter((k) => COMMS_DAY_READ_ONLY_IDS.includes(k));
  if (offenders.length) {
    throw new Error(
      `comms-day push payload contains read-only Airtable field(s): ${offenders.join(', ')}. ` +
        `These are formula/rollup/lookup fields — edit them upstream (📅 Official Cal), not here.`,
    );
  }
}
