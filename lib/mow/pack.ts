// The Monday pack generator: turn a week of 🗓️ Comms Calendar days into MowWeek + MowSlot rows
// with a staged headline number, ready for a human to commit.
//
// Plan: plans/ref-to-sep-call-zazzy-moth.md · Brief: Sep Calls/Handoff/MOW-HANDOFF.md
//
// Two invariants this file exists to protect:
//
//  1. PROPOSE-ONLY. Generation writes ONLY `*Staged` fields and never touches a `*Committed`
//     one. Re-running is therefore always safe: whatever a human committed survives. This is
//     Glen's condition, and the reason `mow-monday-pack` can be fired repeatedly without anyone
//     having to think about it.
//
//  2. ONE HEADLINE. `smartNumberStaged` is a single object (lib/mow/smart-number.ts). The other
//     candidate metrics go in `drivers` and render smaller.
//
// The generator does NOT fetch metrics. Values arrive separately via the metrics ingest
// (plan §2 — a scheduled Claude agent with the Metabase connector POSTs them in), so a failed
// or missing metrics run leaves a pack with an honest empty number rather than no pack at all.

import { prisma } from '@/lib/prisma';
import { weekBounds, weekStartOf, toYmd, weekdayName } from './week';
import {
  buildSmartNumber,
  defaultSmartNumberKey,
  hasLiveCampaign,
  resolveTarget,
  type SmartNumberKey,
} from './smart-number';
import { deriveWeeks, normaliseBrand, splitJammedName, type MowBrandKey } from './derive-week';

/**
 * The brands a week is generated for when the MOW master has nothing for it yet.
 *
 * Decision S3, confirmed by the 10 Sep workshop: MV and VL each get their OWN MowWeek row —
 * `(weekStart, brand)` is the identity, not a tag on one shared row.
 *
 * This is now only a FALLBACK. `resolveBrandsForWeek` below reads the real brands off the
 * message rows and derives their week (V2); this constant keeps the pack renderable for a week
 * with no message committed at all, which is most weeks today — 6 of the 7 live records are MV
 * and the only VL one is named "test".
 */
export const MOW_BRANDS = ['MV', 'VL'] as const;
export type MowBrand = (typeof MOW_BRANDS)[number];

/**
 * Which brands have a message for this week, and what that message says.
 *
 * The week comes from `MessageOfWeek.weekStarting` when it exists and is DERIVED from the
 * message's linked dates when it doesn't (V2 — see lib/mow/derive-week.ts for why that is sound).
 * A message spanning several weeks belongs to each, so it is returned for each.
 */
export interface MowMessageForWeek {
  id: string;
  name: string;
  goal: string | null;
  spansMultiple: boolean;
  weekSource: string;
  /** How many of this week's days the message actually covers — the primary/related rule. */
  daysInWeek: number;
}

export interface BrandWeek {
  /** The week's message for this brand. */
  primary: MowMessageForWeek;
  /**
   * Other messages that also fall in this week, kept rather than discarded.
   *
   * Real example, w/c 7 Sep: `Expert to Authority` covers six days of the week and is primary;
   * `Jim Kwik (Mention Expert to Authority)` covers Tuesday alone and sits under it. They are not
   * competing — the second is a beat within the first, which is exactly how the team writes them.
   * Dropping one would have hidden a real day's content.
   */
  related: MowMessageForWeek[];
}

export async function resolveBrandsForWeek(weekStart: Date): Promise<{
  brands: string[];
  messages: Map<string, BrandWeek>;
  warnings: string[];
}> {
  const warnings: string[] = [];
  const rows = await prisma.messageOfWeek.findMany({
    where: { active: true },
    select: { id: true, mow: true, brand: true, goal: true, weekStarting: true, commsCalendarIds: true },
  });

  // Resolve the comms-calendar recIds to real dates through the CommsDay mirror. One query for
  // every message's links rather than one per message.
  const allIds = [...new Set(rows.flatMap((r) => r.commsCalendarIds))];
  const dayRows = allIds.length
    ? await prisma.commsDay.findMany({
        where: { airtableId: { in: allIds } },
        select: { airtableId: true, date: true },
      })
    : [];
  const dateByRecId = new Map(dayRows.filter((d) => d.date).map((d) => [d.airtableId as string, d.date as Date]));

  const target = toYmd(weekStart);
  const { start, end } = weekBounds(weekStart);
  const byBrand = new Map<string, MowMessageForWeek[]>();

  for (const r of rows) {
    const brand = normaliseBrand(r.brand);
    if (!brand) {
      if (r.brand) warnings.push(`MOW record "${r.mow ?? r.id}" has an unrecognised Brand "${r.brand}" — skipped.`);
      continue;
    }
    const linked = r.commsCalendarIds.map((id) => dateByRecId.get(id) ?? null);
    const d = deriveWeeks({ weekStarting: r.weekStarting, linkedDates: linked });
    if (!d.weekStarts.some((w) => toYmd(w) === target)) continue;

    // Coverage within THIS week decides which message leads it. A data-driven rule, deliberately
    // not name-matching: the message the team hung most of the week on is the week's message.
    const daysInWeek = linked.filter((x): x is Date => !!x && x >= start && x <= end).length;

    const entry: MowMessageForWeek = {
      id: r.id,
      name: splitJammedName(r.mow, brand as MowBrandKey),
      goal: r.goal,
      spansMultiple: d.spansMultiple,
      weekSource: d.source,
      daysInWeek,
    };
    byBrand.set(brand, [...(byBrand.get(brand) ?? []), entry]);
  }

  const messages = new Map<string, BrandWeek>();
  for (const [brand, entries] of byBrand) {
    entries.sort((a, b) => b.daysInWeek - a.daysInWeek || a.name.localeCompare(b.name));
    const [primary, ...related] = entries;
    messages.set(brand, { primary, related });

    // Only a genuine tie is ambiguous. An uneven split is the normal shape (a campaign message
    // plus a one-day beat inside it) and needs no warning.
    if (related.length && related[0].daysInWeek === primary.daysInWeek) {
      warnings.push(
        `${brand} has ${entries.length} messages for week ${target} with equal coverage ` +
          `(${primary.daysInWeek} day(s) each): leading with "${primary.name}". Confirm which is the week's message.`,
      );
    }
    if (primary.spansMultiple) {
      warnings.push(`${brand} message "${primary.name}" spans more than one week; shown in each, marked.`);
    }
    if (!primary.goal || !primary.goal.trim()) {
      warnings.push(`${brand} message "${primary.name}" has no goal set — the target will read "no target set".`);
    }
  }

  return { brands: [...messages.keys()], messages, warnings };
}

/** Who may commit a pack (decision S4). Enforced here, not just in the UI. */
export const MOW_COMMITTERS = [
  'gareth@mindvalley.com',
  'glen@mindvalley.com',
  'ramya@mindvalley.com',
] as const;

export const canCommitMow = (email: string | null | undefined): boolean =>
  !!email && MOW_COMMITTERS.includes(email.toLowerCase() as (typeof MOW_COMMITTERS)[number]);

export interface PackReport {
  weekStart: string;
  brands: string[];
  commsDays: number;
  weeksCreated: number;
  weeksUpdated: number;
  slotsCreated: number;
  slotsUpdated: number;
  /** Weeks left alone because a human had already committed them. */
  weeksSkippedCommitted: number;
  liveCampaign: boolean;
  smartNumberKey: SmartNumberKey;
  /** 'numeric' | 'inferred' | 'none' — 'inferred' must be surfaced in the UI (finding F8). */
  targetProvenance: string;
  warnings: string[];
}

/**
 * Which channels shipped on a given day, derived from the day's link fields.
 *
 * Email and social are SEPARATE slots for the same date and are intentionally different
 * messages — the brief is explicit that this is not a misalignment to be "fixed". What they
 * share is the destination, not the copy.
 */
function channelsForDay(day: { emailIds: string[]; socialAssetIds: string[] }): string[] {
  const out: string[] = [];
  if (day.emailIds.length) out.push('email');
  if (day.socialAssetIds.length) out.push('social');
  return out;
}

export async function generatePack(opts: {
  /** Any date in the target week; normalized to its Monday. */
  weekOf: Date;
  brands?: readonly string[];
}): Promise<PackReport> {
  const weekStart = weekStartOf(opts.weekOf);
  const { start, end } = weekBounds(weekStart);
  const warnings: string[] = [];

  // Brands come from the MOW master where it has messages for this week (V2), and fall back to
  // the constant so a week with nothing committed still produces a pack rather than nothing.
  const resolved = await resolveBrandsForWeek(weekStart);
  warnings.push(...resolved.warnings);
  const brands = opts.brands ?? (resolved.brands.length ? resolved.brands : MOW_BRANDS);
  if (!resolved.brands.length) {
    warnings.push(
      `No MOW message resolves to week ${toYmd(weekStart)}, so both brands render empty. ` +
        `Either no message is committed for it or 'Week starting' is unset and the message has no ` +
        `linked dates — see plan §0 / V2.`,
    );
  }


  const days = await prisma.commsDay.findMany({
    where: { date: { gte: start, lte: end } },
    orderBy: { date: 'asc' },
  });

  if (!days.length) {
    warnings.push(
      `No comms_days rows for ${toYmd(start)}–${toYmd(end)}. Either the 🗓️ Comms Calendar has ` +
        `no entries for that week (Glen's backfill, plan item 0.4) or MOW_BACKEND is still ` +
        `'airtable' so nothing has been pulled.`,
    );
  }

  const live = hasLiveCampaign(days);

  // The week's message and goal are taken from the EARLIEST day that has one — i.e. Monday,
  // deliberately, because the brief is explicit that the MOW is "set at Monday's meeting".
  // `days` is ordered by date ascending, so [0] is that day.
  //
  // This is load-bearing, because the real data disagrees with itself. The week of 7 Sep 2026
  // carries three different goals across its seven days:
  //     Mon 7  "To achieve 35k leads to expert to authority summit"
  //     Tue 8  "Launch Jim Kwik's podcast and scale to 50k views by next week"
  //     Wed–Sun "To achieve 25k leads to expert to authority summit"
  // Picking silently would put an arbitrary target in front of Vishen, so every candidate goes
  // into `warnings` and the pack shows Monday's. A human retargets from there.
  const goals = [...new Set(days.map((d) => d.theGoal).filter((g): g is string => !!g))];
  if (goals.length > 1) {
    warnings.push(
      `Week has ${goals.length} different goals across its days — using Monday's, the day the ` +
        `MOW is set. All candidates: ${goals.join(' | ')}`,
    );
  }
  const prose = goals[0] ?? null;
  const messages = [...new Set(days.map((d) => d.messageOfWeek).filter((m): m is string => !!m))];
  if (messages.length > 1) {
    warnings.push(
      `Week has ${messages.length} different messages across its days — using Monday's. ` +
        `All candidates: ${messages.join(' | ')}`,
    );
  }
  const message = messages[0] ?? null;
  if (!message) {
    warnings.push(
      `No "Message of the week" on any day in this week — the pack will render an empty message. ` +
        `Glen's message-of-the-day auto-tag automation is the fix (plan item 0.5).`,
    );
  }

  // The numeric lead goal is a lookup off 📅 Official Cal and is empty on every record today
  // (finding F8), so this is expected to be null and the target falls back to parsing the prose.
  const numericLeadGoal = days.map((d) => d.roLeadGenGoal).find((v) => v != null) ?? null;
  const target = resolveTarget({ numeric: numericLeadGoal == null ? null : Number(numericLeadGoal), prose });
  if (target.provenance === 'inferred') {
    warnings.push(
      `Lead target ${target.value} was INFERRED from the prose goal because 📅 Official Cal's ` +
        `"Lead gen Goal" is empty. Label it as inferred in the UI; populating that field ` +
        `(plan item 0.11) retires the guess.`,
    );
  }

  const report: PackReport = {
    weekStart: toYmd(weekStart),
    brands: [...brands],
    commsDays: days.length,
    weeksCreated: 0,
    weeksUpdated: 0,
    slotsCreated: 0,
    slotsUpdated: 0,
    weeksSkippedCommitted: 0,
    liveCampaign: live,
    smartNumberKey: 'leads',
    targetProvenance: target.provenance,
    warnings,
  };

  for (const brand of brands) {
    const existing = await prisma.mowWeek.findUnique({
      where: { weekStart_brand: { weekStart, brand } },
      select: { id: true, status: true, committedAt: true, smartNumberKey: true },
    });

    // Each brand carries its OWN message and goal (S3 / 10 Sep change 2). Prefer the brand's
    // resolved MOW record; fall back to the comms calendar's plain-text columns, which are
    // brand-agnostic and are what exists on weeks with no message committed.
    const bw = resolved.messages.get(brand);
    const brandMessage = bw?.primary.name || message;
    const brandGoalProse = (bw?.primary.goal?.trim() || null) ?? prose;

    // The target is resolved per brand too, since the goal prose differs per brand (F8).
    const brandTarget = bw
      ? resolveTarget({ numeric: numericLeadGoal == null ? null : Number(numericLeadGoal), prose: brandGoalProse })
      : target;

    // A human's chosen metric wins over the default — they may have switched it deliberately.
    const key = (existing?.smartNumberKey as SmartNumberKey | null) ??
      defaultSmartNumberKey({ hasLiveCampaign: live, offerDefinition: null });
    report.smartNumberKey = key;

    // Value stays null: the generator never invents a figure. The metrics ingest fills it.
    const staged = buildSmartNumber({ key, value: null, target: brandTarget, source: null, asOf: null });

    if (!existing) {
      const created = await prisma.mowWeek.create({
        data: {
          weekStart,
          brand,
          status: 'draft',
          message: brandMessage,
          goal: brandGoalProse,
          smartNumberKey: key,
          smartNumberStaged: staged as unknown as object,
          generatedAt: new Date(),
        },
        select: { id: true },
      });
      report.weeksCreated++;
      await syncSlots(created.id, brand, days, report);
      continue;
    }

    if (existing.committedAt) {
      // Committed weeks are read-only to the generator. Slots still reconcile — a day genuinely
      // shipping late is new information — but nothing the human wrote is touched.
      report.weeksSkippedCommitted++;
      await syncSlots(existing.id, brand, days, report);
      continue;
    }

    await prisma.mowWeek.update({
      where: { id: existing.id },
      data: {
        message: brandMessage,
        goal: brandGoalProse,
        smartNumberKey: key,
        smartNumberStaged: staged as unknown as object,
        generatedAt: new Date(),
      },
    });
    report.weeksUpdated++;
    await syncSlots(existing.id, brand, days, report);
  }

  return report;
}

/**
 * Reconcile a week's slots against its comms days.
 *
 * Idempotent by (weekId, day, channel): re-running updates rather than duplicating. A slot a
 * human has annotated (blockerNote, or a status they set by hand) keeps that annotation — the
 * generator only ever refreshes what it derived.
 */
async function syncSlots(
  weekId: string,
  brand: string,
  days: {
    id: string;
    date: Date | null;
    emailIds: string[];
    socialAssetIds: string[];
    roWeekday: string | null;
  }[],
  report: PackReport,
): Promise<void> {
  for (const day of days) {
    if (!day.date) continue;
    for (const channel of channelsForDay(day)) {
      const found = await prisma.mowSlot.findFirst({
        where: { weekId, day: day.date, channel, brand },
        select: { id: true, status: true, blockerNote: true },
      });

      if (!found) {
        await prisma.mowSlot.create({
          data: {
            weekId,
            day: day.date,
            channel,
            brand,
            commsDayId: day.id,
            plannedFromSource: 'comms_calendar',
            status: 'planned',
            // The transcript left one editor unverified for the 1 Sep quest-snippet slot; the
            // brief says seed "Editor TBC" rather than guessing a name onto someone's work.
            ownerNameFallback: 'Editor TBC',
          },
        });
        report.slotsCreated++;
      } else {
        await prisma.mowSlot.update({
          where: { id: found.id },
          data: { commsDayId: day.id, plannedFromSource: 'comms_calendar' },
        });
        report.slotsUpdated++;
      }
    }
  }
}

/** Read a generated pack back for rendering. Committed values win over staged, always. */
export async function getPack(weekOf: Date) {
  const weekStart = weekStartOf(weekOf);
  const weeks = await prisma.mowWeek.findMany({
    where: { weekStart },
    orderBy: { brand: 'asc' },
    include: {
      slots: { orderBy: [{ day: 'asc' }, { channel: 'asc' }], include: { commsDay: true, ownerEmployee: true } },
      learnings: { orderBy: { rank: 'asc' } },
      briefs: true,
    },
  });
  return {
    weekStart: toYmd(weekStart),
    weekdayLabels: Object.fromEntries(
      weeks[0]?.slots.map((s) => [toYmd(s.day), weekdayName(s.day)]) ?? [],
    ),
    weeks,
  };
}
