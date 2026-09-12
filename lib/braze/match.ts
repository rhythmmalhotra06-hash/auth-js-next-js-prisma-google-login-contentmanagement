// Matching a planned email in Airtable to the Braze campaigns that actually sent it.
//
// ── WHY THERE IS NO KEY TO JOIN ON ────────────────────────────────────────────────────────────
//
// The Airtable records carry `📧 Braze email URL` — one dashboard link per audience list, each
// with a 24-hex id in it. It is tempting and wrong to treat that as the join key: those are
// Braze DASHBOARD ObjectIds and the REST API identifies campaigns by a different id entirely.
// The two do not convert in either direction (the Braze Ops hub records the same dead end from
// the opposite side: it cannot build dashboard URLs from its REST ids).
//
// So this is a fuzzy match, the same shape as the Perch caption match in
// lib/comms-calendar/social-posts.ts — and it carries the same obligation: a miss must read as
// "not matched", never as a zero. A zero here is a claim that an email reached nobody.
//
// ── WHAT MAKES IT WORK ───────────────────────────────────────────────────────────────────────
//
// The subject line. Braze's `/campaigns/details` returns it per variant, and Airtable's copy
// carries it as the first line (parsed in lib/comms-calendar/emails.ts). Subjects are long,
// distinctive and identical on both sides because the same string was pasted into Braze.
//
// Two things corrupt them and are normalised away: Liquid personalisation, which renders
// differently on each side (`{{${first_name} | default: 'Mindvalley Subscriber'}}`), and the
// `&#13;` carriage returns that trail about a third of the team's subjects.
//
// ── IF THE RATE IS POOR ──────────────────────────────────────────────────────────────────────
//
// The answer is NOT a cleverer string metric. It is one `Braze Campaign ID` field on the
// Airtable table, filled at planning time — a workflow ask for Ramya. Ship the measurement
// first; that conversation needs a number in it.

/** How much of a subject has to agree for a prefix match. Long enough that two emails cannot collide. */
const PREFIX_LEN = 45;

/** Below this, a candidate is not a match at all. */
export const MATCH_FLOOR = 0.6;
/** At or above this, the match is taken without a human looking. */
export const MATCH_CONFIDENT = 0.9;

/** How many days either side of the planned Live Date a send still counts as the same email. */
const DAY_WINDOW_MS = 36 * 3600_000;

/**
 * Normalise a subject for comparison.
 *
 * Aggressive on purpose — emoji, punctuation, Liquid and HTML entities all differ between what
 * was written in Airtable and what Braze reports, while the words do not.
 */
export function normSubject(s: string | null | undefined): string {
  if (!s) return '';
  return s
    .replace(/\{\{[\s\S]*?\}\}/g, ' ') // Liquid personalisation, rendered differently each side
    .replace(/\{%[\s\S]*?%\}/g, ' ')
    .replace(/&#\d+;|&[a-z]+;/gi, ' ') // &#13; and friends
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Words too common to identify anything — the fallback scores on what is left. */
const STOP = new Set([
  'the', 'a', 'an', 'and', 'or', 'of', 'to', 'for', 'in', 'on', 'at', 'is', 'it', 'this', 'that',
  'with', 'your', 'you', 'my', 'we', 'email', 'emails', 'sequence', 'campaign', 'mindvalley',
]);

function tokens(s: string): string[] {
  return normSubject(s).split(' ').filter((w) => w.length > 2 && !STOP.has(w));
}

export interface MatchCandidate {
  brazeCampaignId: string;
  campaignName: string;
  subject: string | null;
  audience: string | null;
  firstSentAt: Date | string | null;
}

export interface MatchTarget {
  id: string;
  title: string;
  subject: string | null;
  liveDate: string | null;
  audiences: string[];
}

export interface Match {
  candidate: MatchCandidate;
  score: number;
  /** Why it matched — shown on the detail page so a human can judge a 0.6. */
  reason: 'subject' | 'subject-prefix' | 'name-overlap';
}

function sameDayish(liveDate: string | null, sentAt: Date | string | null): boolean {
  if (!liveDate || !sentAt) return false;
  const planned = new Date(`${liveDate}T00:00:00Z`).getTime();
  const sent = new Date(sentAt).getTime();
  if (Number.isNaN(planned) || Number.isNaN(sent)) return false;
  // The window is asymmetric in effect rather than intent: sends go out in the MYT morning, so
  // the UTC timestamp usually lands on the planned day, and 36 hours covers a late-evening send
  // slipping past midnight without reaching the next day's email.
  return Math.abs(sent - planned) <= DAY_WINDOW_MS;
}

/**
 * Score one candidate against one planned email. Returns null when it is not a match.
 *
 * The date is a GATE, not a score: two emails in a campaign sequence share a vocabulary, so
 * without the date bound a name-overlap match would routinely pick the wrong day's email.
 */
export function scoreCandidate(target: MatchTarget, candidate: MatchCandidate): Match | null {
  if (!sameDayish(target.liveDate, candidate.firstSentAt)) return null;

  // The audience is a second gate when BOTH sides know it — one planned email fans out to six
  // or more lists, each its own campaign, and they are only distinguishable this way.
  if (candidate.audience && target.audiences.length && !target.audiences.includes(candidate.audience)) {
    return null;
  }

  const a = normSubject(target.subject);
  const b = normSubject(candidate.subject);
  if (a && b) {
    if (a === b) return { candidate, score: 1, reason: 'subject' };
    const n = Math.min(PREFIX_LEN, a.length, b.length);
    if (n >= 25 && a.slice(0, n) === b.slice(0, n)) return { candidate, score: 0.9, reason: 'subject-prefix' };
    // Both sides named a subject and they are different emails. STOP HERE — do not fall through
    // to the name. A launch sequence's campaigns share almost all of their name vocabulary
    // ("EAS Sep 2026 — Email N — Daily"), so the fallback below would happily attach Email 3's
    // numbers to Email 1 on a day that ran both. Disagreeing subjects are the strongest evidence
    // available that these are two different sends.
    return null;
  }

  // A subject is missing on one side — fall back to the internal name, which the team tends to
  // echo in the Braze campaign name ("Email 1 - …" both sides). Weak, hence 0.6 and a label the
  // UI shows, so a human can see the guess rather than inherit it.
  const want = tokens(target.title);
  if (want.length) {
    const have = new Set(tokens(candidate.campaignName));
    const overlap = want.filter((w) => have.has(w)).length / want.length;
    if (overlap >= 0.5) return { candidate, score: 0.6, reason: 'name-overlap' };
  }
  return null;
}

/**
 * Every campaign that plausibly sent this email, best first.
 *
 * Plural by design: one planned email IS several campaigns, one per audience list, and the whole
 * point of keeping them apart is that Daily and Members perform differently.
 */
export function matchEmail(target: MatchTarget, candidates: MatchCandidate[]): Match[] {
  const matches: Match[] = [];
  for (const c of candidates) {
    const m = scoreCandidate(target, c);
    if (m && m.score >= MATCH_FLOOR) matches.push(m);
  }
  // Best score first; within a score, the bigger send first — if two campaigns tie, the main
  // list is the one the meeting means.
  return matches.sort((x, y) => y.score - x.score || x.candidate.campaignName.localeCompare(y.candidate.campaignName));
}
