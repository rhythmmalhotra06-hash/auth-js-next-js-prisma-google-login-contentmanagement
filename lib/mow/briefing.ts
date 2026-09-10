// The Monday briefing — the computed half of what Glen writes by hand.
//
// His report opens with "5 of 6 content pillars landed on their day — only Friday came up empty",
// then a smart number with its caveat, then four actions each naming an owner. Four of those five
// parts are judgement. This module computes the parts that are FACTS, so the human writing the
// prose starts from evidence instead of from a blank page — and so the meeting can see the same
// numbers the sentences were written from.
//
// ── WHAT COULD NOT BE COMPUTED, AND WHY IT IS NOT FAKED ───────────────────────────────────────
//
// The pillar-vs-plan line is the report's headline and it is NOT derivable. Checked on 10 Sep:
//   • `Phase` on the comms day is Promotions/Retention — a marketing phase, not a content pillar.
//   • `🛎️ Content Type` on 📣 Social reads "Social" on 101 of 110 posts. No variance, no signal.
//   • Post TITLES do carry it — "Pathway:: Manifesting - Podcast Snippet" — and the formats that
//     fall out are exactly Glen's pillars (Stage Talk 41, Carousel 18, Quest Snippet 16). But only
//     29% of titles follow that convention; the rest are "Carousel ES - 5 Zen principles" and
//     similar.
//
// So this reports the FORMAT MIX for the posts that name themselves and states the coverage, which
// is true. It does not claim "5 of 6 pillars landed", which would be a sentence built on 29% of
// the data. Closing that gap is a naming convention, not a feature.
//
// Glen's other two analytical lines are blocked on data we do not have at all: CTR against the 7%
// target needs YouTube Analytics (we hold a Data API key, which cannot reach it), and the
// funnel-leak line needs the IG→YouTube pairing, which nothing records.

import type { CalendarWeek } from '@/lib/comms-calendar/types';
import type { PackDay } from './week-pack';

export interface BriefingFact {
  /** Short label for the fact, e.g. 'Friday was dark'. */
  headline: string;
  /** One sentence of detail. Never a recommendation — facts here, judgement in the learnings. */
  detail: string;
  tone: 'good' | 'warn' | 'neutral';
}

export interface Briefing {
  /** Days that planned something and delivered nothing. Glen's "not even a substitute". */
  misses: { date: string; weekday: string; planned: number }[];
  /** The week's strongest post by reach, when Perch matched one. */
  standout: { id: string; title: string; reach: number; platforms: string[] } | null;
  /** Format mix from post titles, with the coverage stated rather than implied. */
  formats: { name: string; count: number }[];
  formatCoverage: { named: number; total: number };
  /** Reach and engagement per platform, never summed across them. */
  platforms: { platform: string; posts: number; reach: number | null; engagements: number | null }[];
  /** Ready-made lines a human can turn into learnings. Facts only. */
  facts: BriefingFact[];
}

/**
 * Pull the format out of a post title.
 *
 * The convention is `Programme:: Topic - Format - hook`. Deliberately strict: a loose parse would
 * turn "Carousel ES - 5 Zen principles" into a format called "5 Zen principles" and quietly
 * pollute the mix. Better to not recognise a title than to invent a category from it.
 */
export function formatFromTitle(title: string): string | null {
  const m = /^[^:]+::\s*[^-]+?\s*-\s*([^-]+?)\s*(?:-|$)/.exec(title);
  if (!m) return null;
  const raw = m[1].trim();
  if (raw.length < 3 || raw.length > 28) return null;
  // "Text on B" and "Text on B Roll" are the same format split by the hyphen in "B-roll".
  return /^text on b/i.test(raw) ? 'Text on B-roll' : raw;
}

export function buildBriefing(week: CalendarWeek, days: PackDay[]): Briefing {
  const today = new Date().toISOString().slice(0, 10);

  // A miss is a PAST day that planned something and delivered nothing. A quiet day that planned
  // nothing is not a miss, and a future day has not had its chance yet.
  const misses = days
    .filter((d) => d.date < today && d.planned > 0 && d.delivered === 0)
    .map((d) => ({ date: d.date, weekday: d.weekday, planned: d.planned }));

  // The standout, from real Perch numbers. Never a guess.
  const standout = week.allPosts
    .filter((p) => p.results?.reach)
    .sort((a, b) => (b.results!.reach ?? 0) - (a.results!.reach ?? 0))[0];

  const fmt = new Map<string, number>();
  let named = 0;
  for (const p of week.allPosts) {
    const f = formatFromTitle(p.title);
    if (!f) continue;
    named++;
    fmt.set(f, (fmt.get(f) ?? 0) + 1);
  }

  const plat = new Map<string, { posts: number; reach: number; eng: number; anyReach: boolean; anyEng: boolean }>();
  for (const p of week.allPosts) {
    for (const pl of p.platforms ?? []) {
      const cur = plat.get(pl) ?? { posts: 0, reach: 0, eng: 0, anyReach: false, anyEng: false };
      cur.posts++;
      if (p.results?.reach != null) { cur.reach += p.results.reach; cur.anyReach = true; }
      if (p.results?.engagements != null) { cur.eng += p.results.engagements; cur.anyEng = true; }
      plat.set(pl, cur);
    }
  }

  const facts: BriefingFact[] = [];

  // ── A miss is an ACCUSATION, so the wording has to survive being wrong ──────────────────────
  //
  // Glen can write "Friday came up empty — not even a substitute" because he checked. We infer it
  // from two partial signals: an asset marked published in Airtable, and a post Perch captured on
  // that date. Publish links sit at 3% and Perch matches about 57%, so a day where work genuinely
  // went out can still look silent to us.
  //
  // The finding is worth surfacing either way — a dark Friday is exactly what the meeting is for —
  // but it is phrased as what we can SEE rather than what happened, and it says which two things
  // it looked at. Naming the wrong person's day as a failure once would cost the page its
  // credibility for good.
  if (misses.length) {
    facts.push({
      headline: misses.length === 1 ? `Nothing recorded on ${misses[0].weekday}` : `${misses.length} days have nothing recorded`,
      detail:
        `${misses.map((m) => m.weekday).join(', ')} planned work, and neither a published asset nor a ` +
        `matched post was found. Worth confirming it was actually dark — publish links are filled on ` +
        `few posts, so this can read as a miss when the work went out untracked.`,
      tone: 'warn',
    });
  } else if (days.some((d) => d.date < today && d.planned > 0)) {
    facts.push({
      headline: 'Every planned day has something recorded',
      detail: 'No planned day this week is completely silent in the data.',
      tone: 'good',
    });
  }

  if (standout?.results?.reach) {
    facts.push({
      headline: 'The week’s strongest post',
      detail: `“${standout.title}” reached ${standout.results.reach.toLocaleString('en-US')} on ${
        (standout.platforms ?? []).join(' and ') || 'social'
      }.`,
      tone: 'good',
    });
  }

  // The gap that makes half the week unmeasurable is itself a finding worth surfacing.
  const matched = week.allPosts.filter((p) => p.results?.reach).length;
  if (week.allPosts.length && matched < week.allPosts.length) {
    facts.push({
      headline: `${week.allPosts.length - matched} of ${week.allPosts.length} posts have no numbers`,
      detail:
        'Results are matched from Hootsuite by caption. The unmatched ones usually carry a briefing note in the caption field rather than the copy that went out.',
      tone: 'neutral',
    });
  }

  return {
    misses,
    standout: standout
      ? {
          id: standout.id,
          title: standout.title,
          reach: standout.results!.reach!,
          platforms: standout.platforms ?? [],
        }
      : null,
    formats: [...fmt.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count),
    formatCoverage: { named, total: week.allPosts.length },
    platforms: [...plat.entries()]
      .map(([platform, v]) => ({
        platform,
        posts: v.posts,
        // Null, not zero: a platform Perch never matched has NO reading, which is a different
        // statement from a platform that reached nobody.
        reach: v.anyReach ? v.reach : null,
        engagements: v.anyEng ? v.eng : null,
      }))
      .sort((a, b) => b.posts - a.posts),
    facts,
  };
}
