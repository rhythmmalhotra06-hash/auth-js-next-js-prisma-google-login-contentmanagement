// The Mindvalley lane's planned EMAILS — title, audiences, subject, and the Braze links.
//
// ── WHY THIS EXISTS ───────────────────────────────────────────────────────────────────────────
//
// The calendar used to render an email as a synthetic `recXXX:email` chip carrying nothing but
// the word "Email". That was the same mistake the social lane made before AB1 — a count where
// information belongs — and it had a second cost here: with no record resolved, there was no
// subject, and the subject is the only usable join key to Braze's numbers.
//
// ── WHERE THE SUBJECT LIVES, AND WHY IT HAS TO BE PARSED ──────────────────────────────────────
//
// There is no subject field on the table. The subject is the first line of the `📧 Email` rich
// text, and the team writes it three ways, all live on records this week:
//
//   **Sub: OPEN: To unlock a 22-year old secret 🔐**        ← label inside the bold
//   **Subject:** A doctor in Stockholm told me…             ← label bold, subject plain
//   **Subject: Your goal is failing on one of three things**
//
// A `📧 Subject` field on the table would make this unnecessary and is worth asking Ramya for.
// Until then this parses, and reports nothing rather than guessing when the copy has no label.

import { listAll, type AirtableRecord } from '@/lib/airtable/rest';
import { EMAILS } from '@/lib/airtable/field-map';
import { swr } from '@/lib/cache/swr';

export interface PlannedEmail {
  id: string;
  /** The internal name — "Email 3 - Nobody knows I exist (The problem)". */
  title: string;
  /** Parsed from the copy. Null when the copy carries no Sub/Subject label. */
  subject: string | null;
  /** The line after the subject, when the team labelled one. */
  preheader: string | null;
  liveDate: string | null;
  emailType: string | null;
  /** "Daily", "Members", … — normalised from the raw `1,2: Daily` option names. */
  audiences: string[];
  /** Braze DASHBOARD links, one per list. Good for a human, useless as a key — see field-map. */
  brazeUrls: string[];
  ctaUrl: string | null;
  copyDoc: string | null;
  blogLink: string | null;
  stage: string | null;
  purpose: string | null;
  /** The copy itself, for the detail page. */
  body: string | null;
}

const str = (v: unknown): string | null => {
  if (typeof v === 'string') return v.trim() || null;
  if (Array.isArray(v)) return v.length ? str(v[0]) : null;
  return null;
};
const selectName = (v: unknown): string | null => {
  if (v == null) return null;
  if (typeof v === 'string') return v.trim() || null;
  if (Array.isArray(v)) return selectName(v[0]);
  if (typeof v === 'object' && 'name' in (v as object)) return String((v as { name: unknown }).name).trim() || null;
  return null;
};
const selectNames = (v: unknown): string[] =>
  Array.isArray(v) ? v.map(selectName).filter((x): x is string => !!x) : selectName(v) ? [selectName(v)!] : [];

/**
 * `"1,2: Daily"` → `"Daily"`, `"1,2,3: Vishen's List"` → `"Vishen's List"`.
 *
 * The option names carry a list-number prefix the meeting does not read, and Braze's tags carry
 * the bare name — so stripping it here is what lets the two sides be compared at all.
 */
export function normaliseAudience(option: string): string {
  return option.replace(/^[\d,\s]*:\s*/, '').trim();
}

/** Strip the markdown emphasis and the `Sub:` / `Subject:` label from one line. */
function stripLabel(line: string): string | null {
  const bare = line.replace(/\*\*/g, '').replace(/^#+\s*/, '').trim();
  const m = /^(?:sub(?:ject)?|subj)\s*:\s*(.+)$/i.exec(bare);
  return m ? m[1].trim() || null : null;
}

function stripPreheaderLabel(line: string): string | null {
  const bare = line.replace(/\*\*/g, '').replace(/^#+\s*/, '').trim();
  const m = /^(?:pre-?header|pre)\s*:\s*(.+)$/i.exec(bare);
  return m ? m[1].trim() || null : null;
}

/**
 * Pull the subject and preheader out of an email's copy.
 *
 * Scans only the opening lines: the word "Subject:" appears inside body copy often enough
 * ("Subject to change…") that scanning the whole email would find the wrong one.
 */
export function parseSubject(body: string | null | undefined): { subject: string | null; preheader: string | null } {
  if (!body) return { subject: null, preheader: null };
  const lines = body.split('\n').slice(0, 12);
  let subject: string | null = null;
  let preheader: string | null = null;
  for (const line of lines) {
    if (!subject) subject = stripLabel(line);
    if (!preheader) preheader = stripPreheaderLabel(line);
    if (subject && preheader) break;
  }
  return { subject, preheader };
}

export function toPlannedEmail(r: AirtableRecord): PlannedEmail {
  const f = r.fields as Record<string, unknown>;
  const F = EMAILS.fields;
  const body = str(f[F.email]);
  const { subject, preheader } = parseSubject(body);
  return {
    id: r.id,
    title: str(f[F.title]) ?? str(f[F.name]) ?? '(untitled email)',
    subject,
    preheader,
    liveDate: str(f[F.liveDate])?.slice(0, 10) ?? null,
    emailType: selectName(f[F.emailType]),
    audiences: selectNames(f[F.audience]).map(normaliseAudience),
    // One URL per line in a multiline field, interleaved with the list names.
    brazeUrls: (str(f[F.brazeUrl]) ?? '').split(/\s+/).filter((s) => s.startsWith('http')),
    ctaUrl: str(f[F.ctaUrl]),
    copyDoc: str(f[F.copyDoc]),
    blogLink: str(f[F.blogLink]),
    stage: selectName(f[F.stage]),
    purpose: selectName(f[F.purpose]),
    body,
  };
}

/** Airtable rejects very long formulas, so ids are requested in batches. Same cap as the social reader. */
const ID_BATCH = 40;

/**
 * Resolve a set of 📧 Emails record ids.
 *
 * By id, not by scanning: same reasoning as `getSocialPosts` — a week links a handful of emails
 * and the table holds years of them. Memoised through the shared SWR memo so the calendar, the
 * pack and the message page share one read.
 */
export async function getPlannedEmails(ids: string[]): Promise<Map<string, PlannedEmail>> {
  const wanted = [...new Set(ids)].filter(Boolean);
  if (!wanted.length) return new Map();

  const batches: string[][] = [];
  for (let i = 0; i < wanted.length; i += ID_BATCH) batches.push(wanted.slice(i, i + ID_BATCH));

  const results = await Promise.all(
    batches.map((b) =>
      swr(`emails:${b.join(',')}`, async () => {
        const res = await listAll(EMAILS.baseId, EMAILS.tableId, {
          filterByFormula: `OR(${b.map((id) => `RECORD_ID()='${id}'`).join(',')})`,
        });
        if (!res.ok) throw new Error(`📧 Emails: ${res.error.message}`);
        return res.data;
      }).catch(() => [] as AirtableRecord[]),
    ),
  );

  const out = new Map<string, PlannedEmail>();
  for (const rows of results) for (const r of rows) out.set(r.id, toPlannedEmail(r));
  return out;
}

/** One email by id, for the detail page. */
export async function getPlannedEmail(id: string): Promise<PlannedEmail | null> {
  return (await getPlannedEmails([id])).get(id) ?? null;
}
