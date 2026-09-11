// The app-owned half of a MOW week: the staged→committed workflow state.
//
// ── WHY THIS EXISTS RATHER THAN generatePack() ────────────────────────────────────────────────
//
// `generatePack()` builds a week from Postgres — it calls `resolveBrandsForWeek()`, which reads
// `prisma.messageOfWeek` and `prisma.commsDay`. Both are EMPTY in production, because MOW_BACKEND
// defaults to `airtable` and the reconcile has never run. So it would produce nothing.
//
// Meanwhile the pack page reads Airtable live and never touched `MowWeek` at all, which is why the
// ingest route 404s ("generate the pack first") on a database with no weeks in it. The two halves
// were disconnected: the write path wanted Postgres reference data that does not exist, and the
// read path bypassed Postgres entirely.
//
// `ensureWeek()` closes that gap without putting a reconcile on the critical path (decision AA3).
// It is decision Y5 made concrete, and it matches the architecture note in CLAUDE.md:
//
//     Airtable owns the NOUNS  — message, goal, the plan.       (read live, never written here)
//     Postgres owns the WORK   — staged/committed, who committed. (app state, permanent)
//
// `generatePack` is untouched and takes over the moment MOW_BACKEND flips to postgres.

import { prisma } from '@/lib/prisma';
import { weekStartOf } from './week';
import { canCommitMow } from './pack';
import { defaultSmartNumberKey } from './smart-number';

export type WriteResult = { ok: true } | { ok: false; error: string };

/** Everyone who may commit is checked HERE, not only in the UI. S4. */
function guard(email: string | null | undefined): WriteResult {
  if (!email) return { ok: false, error: 'Not signed in.' };
  if (!canCommitMow(email)) {
    return {
      ok: false,
      error: `${email} cannot commit the pack. Gareth, Glen or Ramya can (decision S4).`,
    };
  }
  return { ok: true };
}

/**
 * Make sure a MowWeek row exists for this brand-week, carrying the message and goal as Airtable
 * currently states them.
 *
 * Idempotent, and deliberately NOT destructive of workflow state: a re-run refreshes the
 * denormalized message/goal but never touches `smartNumberCommitted`, `committedBy` or learnings.
 *
 * On a COMMITTED week it does not even refresh the message — a committed week is a record of what
 * was said at the time, so a later Airtable edit must not rewrite history under it.
 */
export async function ensureWeek(
  weekOf: Date,
  brand: string,
  fields: { message: string | null; goal: string | null; liveCampaign: boolean },
): Promise<{ id: string; committed: boolean }> {
  const weekStart = weekStartOf(weekOf);

  // ONE round trip, where this was three (find, then update or create). The page calls this once
  // per brand on every load, so the difference was two brands × two extra Cloud SQL hops before
  // the pack could render. The "never rewrite a committed week" rule lives in the CASE.
  //
  // `smart_number_key` and `generated_at` are set on INSERT only — a human may change the
  // headline metric (S1) and a later page load must not quietly put it back. S2: a live campaign
  // week defaults the headline to leads; otherwise the primary Offer's own definition decides,
  // and that falls back to leads too because leads is the one metric sourceable for any week.
  //
  // HONEST LIMIT: `offers` has 0 rows, so the non-campaign branch cannot yet resolve to anything
  // but leads either. The detection is wired and discriminates correctly (w/c 31 Aug false,
  // w/c 7 Sep true), but until an Offer carries a `smartNumberDefinition` it cannot change the
  // ANSWER — every week is leads. Worth knowing before anyone concludes the rule is working from
  // the output alone.
  const smartNumberKey = defaultSmartNumberKey({ hasLiveCampaign: fields.liveCampaign, offerDefinition: null });
  const rows = await prisma.$queryRaw<{ id: string; committed_at: Date | null }[]>`
    insert into mow_weeks (week_start, brand, message, goal, smart_number_key, generated_at)
    values (${weekStart}::date, ${brand}, ${fields.message}, ${fields.goal}, ${smartNumberKey}, now())
    on conflict (week_start, brand) do update set
      message    = case when mow_weeks.committed_at is null then excluded.message else mow_weeks.message end,
      goal       = case when mow_weeks.committed_at is null then excluded.goal    else mow_weeks.goal    end,
      updated_at = case when mow_weeks.committed_at is null then now()            else mow_weeks.updated_at end
    returning id, committed_at
  `;
  const row = rows[0];
  return { id: row.id, committed: !!row.committed_at };
}

/** The week as the page needs it: state, number, summary, learnings. */
export async function getWeekState(weekOf: Date, brands: string[]) {
  const weekStart = weekStartOf(weekOf);
  return prisma.mowWeek.findMany({
    where: { weekStart, brand: { in: brands } },
    orderBy: { brand: 'asc' },
    include: { learnings: { orderBy: [{ rank: 'asc' }, { createdAt: 'asc' }] } },
  });
}

/**
 * Commit a brand-week.
 *
 * Copies the staged number and summary into their committed columns rather than flipping a flag,
 * so the committed record is a SNAPSHOT: a later ingest changing the staged figure cannot
 * retroactively alter what the room agreed to. `committedBy` is shown on the page — the room
 * should know whose numbers these are.
 */
export async function commitWeek(weekId: string, email: string | null | undefined): Promise<WriteResult> {
  const g = guard(email);
  if (!g.ok) return g;

  const w = await prisma.mowWeek.findUnique({
    where: { id: weekId },
    select: { id: true, committedAt: true, smartNumberStaged: true, weekSummaryStaged: true },
  });
  if (!w) return { ok: false, error: 'No such week.' };
  if (w.committedAt) return { ok: false, error: 'Already committed.' };

  await prisma.$transaction([
    prisma.mowWeek.update({
      where: { id: weekId },
      data: {
        smartNumberCommitted: w.smartNumberStaged ?? undefined,
        weekSummaryCommitted: w.weekSummaryStaged,
        status: 'set',
        committedBy: email!.toLowerCase(),
        committedAt: new Date(),
      },
    }),
    // Learnings commit with the week. A learning left staged after the meeting is one nobody
    // agreed to, and it should not appear in next week's record as though they had.
    prisma.learning.updateMany({
      where: { weekId, committedAt: null, NOT: { textStaged: null } },
      data: { committedBy: email!.toLowerCase(), committedAt: new Date() },
    }),
  ]);

  // Copy staged text across for the ones just committed. Separate pass because updateMany cannot
  // copy column-to-column.
  const justCommitted = await prisma.learning.findMany({
    where: { weekId, textCommitted: null, NOT: { textStaged: null } },
    select: { id: true, textStaged: true },
  });
  for (const l of justCommitted) {
    await prisma.learning.update({ where: { id: l.id }, data: { textCommitted: l.textStaged } });
  }

  return { ok: true };
}

/** Reopen a committed week. Rare, and deliberately allowed — meetings correct themselves. */
export async function reopenWeek(weekId: string, email: string | null | undefined): Promise<WriteResult> {
  const g = guard(email);
  if (!g.ok) return g;
  await prisma.mowWeek.update({
    where: { id: weekId },
    // The committed snapshot is KEPT, not cleared: reopening should not destroy what was agreed.
    data: { status: 'draft', committedBy: null, committedAt: null },
  });
  return { ok: true };
}

/** Save the week's staged prose summary. Anyone who can commit can draft. */
export async function setWeekSummary(
  weekId: string,
  text: string,
  email: string | null | undefined,
): Promise<WriteResult> {
  const g = guard(email);
  if (!g.ok) return g;
  const w = await prisma.mowWeek.findUnique({ where: { id: weekId }, select: { committedAt: true } });
  if (w?.committedAt) return { ok: false, error: 'This week is committed. Reopen it to edit.' };

  await prisma.mowWeek.update({
    where: { id: weekId },
    data: { weekSummaryStaged: text.trim() || null },
  });
  return { ok: true };
}

/**
 * Add or edit a staged learning.
 *
 * `proposed` marks a line the SYSTEM drafted rather than a person (AA2). It is carried through to
 * the UI so an AI suggestion never quietly reads as a colleague's judgement — Glen's condition was
 * about a plausible-sounding wrong recommendation, and the answer to that is attribution plus a
 * commit gate, not hiding the origin.
 */
export async function stageLearning(opts: {
  weekId: string;
  text: string;
  leverOwner?: string | null;
  proposed?: boolean;
  learningId?: string;
  email: string | null | undefined;
}): Promise<WriteResult> {
  const g = guard(opts.email);
  if (!g.ok) return g;

  const text = opts.text.trim();
  if (!text) return { ok: false, error: 'A learning needs some text.' };

  const w = await prisma.mowWeek.findUnique({ where: { id: opts.weekId }, select: { committedAt: true } });
  if (w?.committedAt) return { ok: false, error: 'This week is committed. Reopen it to edit.' };

  if (opts.learningId) {
    await prisma.learning.update({
      where: { id: opts.learningId },
      // Editing an AI proposal makes it the editor's line, so the `proposed` marker is DROPPED —
      // a human has now put their name behind the words, and it should stop being labelled as
      // something the system said.
      data: { textStaged: text, leverOwner: opts.leverOwner ?? null, proposed: false },
    });
    return { ok: true };
  }

  const count = await prisma.learning.count({ where: { weekId: opts.weekId } });
  await prisma.learning.create({
    data: {
      weekId: opts.weekId,
      textStaged: text,
      rank: count,
      // Lever → owner is free text for 14 Sep (S16); the employee link lands with E10.
      leverOwner: opts.leverOwner ?? null,
      proposed: !!opts.proposed,
    },
  });
  return { ok: true };
}

export async function deleteLearning(learningId: string, email: string | null | undefined): Promise<WriteResult> {
  const g = guard(email);
  if (!g.ok) return g;
  const l = await prisma.learning.findUnique({ where: { id: learningId }, select: { committedAt: true } });
  if (l?.committedAt) return { ok: false, error: 'Committed learnings are part of the record.' };
  await prisma.learning.delete({ where: { id: learningId } });
  return { ok: true };
}
