// Blockers — upstream things the meeting cannot fix by working harder.
//
// ── WHY THIS IS A SEPARATE SECTION AND NOT A RED ROW ──────────────────────────────────────────
//
// `blocked` is NOT `missed`. Glen's Friday — nothing published at all, not even a substitute — is
// a miss and belongs in red on the day table. An asset nobody dated, a goal nobody wrote, a figure
// nobody ingested: none of those are an editor's failure, and colouring them the same way turns
// every meeting into a defence. The design handoff is explicit that these are two conditions with
// two colours, so blockers live in `warning` and never in `danger`.
//
// ── THE RULE EVERY ENTRY OBEYS ────────────────────────────────────────────────────────────────
//
// A blocker with no name against it is just a complaint. Each one carries:
//
//   what   the fact, WITH its number — "204 assets have no Live Date", not "some assets"
//   why    what it stops, in the reader's terms — not a restatement of the fact
//   owner  a person, or an honest statement that the field has no owner at all
//
// That last case is real and is the biggest one here: `Live Date` is owned by nobody, which is
// exactly why 204 of 442 assets lack it and 66 of those are already published. Writing "nobody"
// is the point of the row — naming a person who has not agreed to it would be worse than blank.
//
// ── WHAT IS DELIBERATELY NOT A BLOCKER ────────────────────────────────────────────────────────
//
// Posts Perch could not match. That is coverage, it is stated once at screen level in "Where these
// numbers come from", and repeating it here would make a 43% match rate read as someone's fault.

import type { CalendarWeek } from '@/lib/comms-calendar/types';

export interface Blocker {
  id: string;
  what: string;
  why: string;
  /** A person, or an honest "nobody" — never invented. */
  owner: string;
  /** Where it gets fixed, when there is a page for that. */
  href?: string;
  /** Drives the ordering: how much of the week this hides. */
  weight: number;
}

export interface BlockerInput {
  week: CalendarWeek;
  /** Per brand: does it have a headline figure yet, and is the week committed. */
  brands: { brand: string; label: string; hasFigure: boolean }[];
  /** For the calendar links. */
  weekHref: string;
}

const BRAND_LABEL: Record<string, string> = { MV: 'Mindvalley', VL: 'Vishen' };

/**
 * Everything standing between this week and a complete pack, computed from what is already read.
 *
 * No extra fetch: every input here is something the pack already has in hand, because a section
 * about what is slow must not itself be what makes the page slow.
 */
export function blockersFor({ week, brands, weekHref }: BlockerInput): Blocker[] {
  const out: Blocker[] = [];

  // 1. The structural one. Undated assets are invisible to every date-grouped surface, so this
  //    hides more of the picture than anything else on the list — hence the top weight.
  const nd = week.notDated;
  if (nd.total > 0) {
    out.push({
      id: 'live-date',
      what:
        `${nd.total} assets have no Live Date` +
        (nd.published ? `, and ${nd.published} of them are already published` : ''),
      why:
        'The calendar groups by date, so none of these appear in any week — including the ' +
        'published ones, whose numbers therefore count toward nothing.',
      owner: 'nobody — this field has no owner',
      href: '/studio/comms-calendar/not-dated',
      weight: 1000 + nd.total,
    });
  }

  // 2. A brand with no message is a brand with no week. Never borrowed from the other lane.
  for (const h of week.headers) {
    if (h.message === null) {
      out.push({
        id: `message-${h.brand}`,
        what: `${h.label} has no message committed for this week`,
        why: h.messageIsPlaceholder
          ? 'The record exists but its name is a placeholder, so nothing can be shown against it.'
          : 'Every asset, learning and figure in this lane hangs off the message. Without one there is nothing to group them under.',
        owner: 'Ramya',
        weight: 900,
      });
    }
  }

  // 3. A goal is what turns a number into a verdict. Without one the figure is just a figure.
  for (const brand of week.brandsWithoutGoal) {
    const label = BRAND_LABEL[brand] ?? brand;
    const h = week.headers.find((x) => x.brand === brand);
    // Don't say it twice: a lane with no message obviously has no goal either.
    if (h && h.message === null) continue;
    out.push({
      id: `goal-${brand}`,
      what: `${label}'s message has no goal set`,
      why: 'Nothing can be called on or off track without one — the number renders, but with no target beside it.',
      owner: 'Ramya',
      weight: 800,
    });
  }

  // 4. The headline. A pack whose centrepiece is empty is a report, not a decision.
  for (const b of brands) {
    if (b.hasFigure) continue;
    out.push({
      id: `figure-${b.brand}`,
      what: `No figure has been ingested for ${b.label} this week`,
      why: 'Leads and revenue come from Metabase through a scheduled run on Sunday night. Until it lands the headline is a labelled gap.',
      owner: 'the Sunday ingest',
      weight: 700,
    });
  }

  // 5. Published with nowhere to point. This is what breaks per-post attribution.
  const noLink = week.allPosts.filter((p) => p.live && !p.publishedUrl).length;
  if (noLink > 0) {
    out.push({
      id: 'publish-link',
      what: `${noLink} published post${noLink === 1 ? '' : 's'} this week ${noLink === 1 ? 'has' : 'have'} no link recorded`,
      why: 'Without the live URL a post cannot be opened from here, and it cannot be joined to what it earned.',
      owner: 'Glen',
      href: `/studio/comms-calendar?brand=mv&week=${weekHref}`,
      weight: 400 + noLink,
    });
  }

  // 6. Dated and real, but nothing planned it. A planning gap, not an editing one.
  const unlinked = week.allPosts.filter((p) => p.linkedToCommsDay === false).length;
  if (unlinked > 0 && week.allPosts.length > 0) {
    const pct = Math.round((unlinked / week.allPosts.length) * 100);
    out.push({
      id: 'unlinked',
      what: `${unlinked} of ${week.allPosts.length} posts (${pct}%) are not linked to a comms day`,
      why: 'They went out and they count, but the calendar never planned them — so "what we said we would do" and "what we did" are measuring different sets.',
      owner: 'Glen and Ramya',
      href: `/studio/comms-calendar?brand=mv&week=${weekHref}`,
      weight: 300 + pct,
    });
  }

  return out.sort((a, b) => b.weight - a.weight);
}
