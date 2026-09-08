// Turn an asset type's DNA into scannable checkpoints.
//
// The DNA fields in Airtable ("DNA", "Video/Virality DNA") are a single comma-separated
// run of rule NAMES — 2.5k–6.7k characters of it. Rendered as prose it's a wall nobody
// reads, which is what Titus asked us to fix on 2026-09-08: "can the portal summarise it
// as check points instead of showing the full thing, that is so long."
//
// This SPLITS the existing list rather than paraphrasing it. Deliberate: the DNA is the
// standard editors are judged against, so an LLM summary could quietly drop or reword a
// rule. Every checkpoint here is verbatim from Airtable.

/** Rules that are literally pre-submission checks — surfaced first, since they're the
 *  ones an editor should run through before handing work over. */
const PRE_SUBMIT = /^pre-?submit\s*:\s*/i;

/**
 * Split the comma-separated rule list, respecting double-quoted segments.
 *
 * Quoting matters: Airtable wraps any rule that itself contains a comma, e.g.
 *   "Never start a video with an open mouth of the author, have a thumbnail from Google Photos"
 * A naive split(',') would fabricate two bogus half-rules out of that. Measured on the
 * Masterclass Trailer DNA: 8 quoted segments in 2,840 characters.
 */
export function splitDnaRules(text: string | null | undefined): string[] {
  const raw = (text ?? '').trim();
  if (!raw) return [];

  const out: string[] = [];
  let buf = '';
  let inQuotes = false;
  for (const ch of raw) {
    if (ch === '"') { inQuotes = !inQuotes; continue; } // drop the delimiters themselves
    if (ch === ',' && !inQuotes) { out.push(buf); buf = ''; continue; }
    buf += ch;
  }
  out.push(buf);

  const seen = new Set<string>();
  const rules: string[] = [];
  for (const item of out) {
    // Trailing " . " and stray whitespace are common in the source data.
    const clean = item.trim().replace(/\s+/g, ' ').replace(/\s*\.\s*$/, '');
    if (!clean) continue;
    const key = clean.toLowerCase();
    if (seen.has(key)) continue; // the two DNA fields overlap heavily
    seen.add(key);
    rules.push(clean);
  }
  return rules;
}

export interface DnaCheckpoints {
  /** "Pre-Submit: …" rules, prefix stripped — the hand-over checklist. */
  preSubmit: string[];
  /** Everything else, in source order. */
  rules: string[];
  total: number;
}

/** Parse one or more DNA blobs into checkpoint groups, deduped across all of them. */
export function toDnaCheckpoints(...texts: (string | null | undefined)[]): DnaCheckpoints {
  const all = splitDnaRules(texts.filter(Boolean).join(', '));
  const preSubmit: string[] = [];
  const rules: string[] = [];
  for (const r of all) {
    if (PRE_SUBMIT.test(r)) preSubmit.push(r.replace(PRE_SUBMIT, '').trim());
    else rules.push(r);
  }
  return { preSubmit, rules, total: preSubmit.length + rules.length };
}
