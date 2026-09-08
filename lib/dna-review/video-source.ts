// Resolving a ticket's "video URL" for visual DNA review (E13.2).
//
// The four delivery-link columns are FREE TEXT in Airtable (`url: false` in
// ASSET_LINK_FIELDS), so they hold whatever the creative team typed: a clean Dropbox file
// link, a folder link, a Dropbox Replay page, a Frame.io review URL, an Airtable rich-text
// blob with several labelled links, or a note like "16x9 was not created". The previous
// resolver took the first non-empty field verbatim, which is why 44% of tickets failed —
// render-service downloaded an HTML page or a folder .zip and ffprobe reported
// "moov atom not found".
//
// Measured across 4,689 ticketed links on 2026-09-08:
//   2,625 (56%) bare Dropbox /scl/fi/ file link — works
//   1,306 (28%) Dropbox folder /scl/fo/ or /sh/  — resolved via the Dropbox API in
//               render-service (dl=1 on a folder yields a 1.47GB .zip)
//     231 ( 5%) replay.dropbox.com — an HTML review page, no file form
//     481 (10%) frame.io / airtable / canva / sharepoint / drive / figma — HTML
//      19        prose, not a URL
//      27        rich text with several links, or the usable link in another field
//
// Deliberately pure — no prisma, no fetch — so it can be exercised directly and imported
// from anywhere. `normalizeUrl` is the only import and is itself dependency-free.

import { normalizeUrl } from '@/lib/metrics/social-metric-types';

/** The ticket columns that can hold a delivery link, in preference order. */
export const VIDEO_SOURCE_FIELDS = ['final9x16', 'final16x9', 'final4x5', 'assetFolderLink'] as const;
export type VideoSourceField = (typeof VIDEO_SOURCE_FIELDS)[number];

/** The three ratio columns are the only ones we'd ever write a resolved link back into —
 *  assetFolderLink means a folder, so a file link doesn't belong there. */
export type RatioField = 'final9x16' | 'final16x9' | 'final4x5';

export type VideoSourceKind =
  | 'dropbox-file' // /scl/fi/ or legacy /s/ — verified to serve bytes with dl=1
  | 'direct-file' // any host, path ends in a video extension (CDN/GCS/S3)
  | 'dropbox-folder' // /scl/fo/ or /sh/ — needs the Dropbox API to resolve
  | 'dropbox-replay' // replay.dropbox.com — HTML review page
  | 'unsupported-host' // frame.io, airtable, canva, sharepoint, drive, figma…
  | 'youtube' // handled by the Supadata transcript path, not by frames
  | 'unknown';

export type VideoSourceFailureReason = 'no-link' | 'not-a-url' | 'replay-only' | 'unsupported-host';

export interface LinkedUrl {
  url: string;
  label: string | null;
}

export interface VideoSourceCandidate extends LinkedUrl {
  field: VideoSourceField;
  kind: VideoSourceKind;
  score: number;
  /** Worth sending to render-service at all. */
  attemptable: boolean;
}

export type VideoSourceResolution =
  | { ok: true; chosen: VideoSourceCandidate; candidates: VideoSourceCandidate[] }
  | {
      ok: false;
      reason: VideoSourceFailureReason;
      candidates: VideoSourceCandidate[];
      /** The best rejected value, so the message can name what we actually found. */
      sample: string | null;
    };

// Kept deliberately parallel to UNSUPPORTED_HOSTS in render-service/server.mjs — that is a
// separate npm project and cannot import from this app, so an edit here needs a matching
// edit there.
const UNSUPPORTED_HOST_PATTERNS: RegExp[] = [
  /(^|\.)frame\.io$/i,
  /^f\.io$/i,
  /(^|\.)airtable\.com$/i,
  /(^|\.)canva\.com$/i,
  /^canva\.link$/i,
  /(^|\.)sharepoint\.com$/i,
  /^(drive|docs)\.google\.com$/i,
  /(^|\.)figma\.com$/i,
  /(^|\.)descript\.com$/i,
  /(^|\.)atlassian\.net$/i,
  /(^|\.)notion\.so$/i,
  /(^|\.)wetransfer\.com$/i,
];

// Mirrors render-service's BLOCKED_HOST so a bad paste is refused in the server action
// rather than after a round trip.
const BLOCKED_HOST =
  /^(localhost|\[?::1\]?|0\.0\.0\.0|metadata\.google\.internal)$|\.internal$|^127\.|^10\.|^169\.254\.|^192\.168\.|^172\.(1[6-9]|2\d|3[01])\./i;

const VIDEO_EXT = /\.(mp4|mov|m4v|webm|mkv|avi)$/i;

// Airtable rich text: [label|url] and [label|url|smart-link].
const RICH_LINK = /\[([^\]|]+)\|(https?:\/\/[^\]|\s]+)(?:\|[^\]]*)?\]/g;
// Widened from lib/media/slack.ts's URL_IN_TEXT, which excludes `|` but not `]`.
const BARE_URL = /https?:\/\/[^\s|>\]}"'<)]+/g;
const TRAILING_JUNK = /[.,;:!)\]}>]+$/;

/**
 * Every http(s) URL in one free-text/rich-text field value, in document order.
 *
 * Rich-text links are matched FIRST and blanked out of a working copy, so the trailing `]`
 * of `[16x9|https://…/scl/fo/abc]` can't leak into a bare-URL match. Handles the real
 * observed shape: `Dropbox: [16x9|https://…] | [Working Files (Pending)|https://…]`.
 *
 * Note: do NOT route this through cleanBrief() in lib/tickets/brief.ts — its
 * `[text|url|smart-link]` rule has one capture group but replaces with `$2`, so it emits
 * the literal string `$2`. Pre-existing bug, unrelated to this path.
 */
export function extractLinkedUrls(raw: string | null | undefined): LinkedUrl[] {
  const text = (raw ?? '').trim();
  if (!text) return [];

  const found: LinkedUrl[] = [];
  let remaining = text;

  for (const m of text.matchAll(RICH_LINK)) {
    found.push({ label: m[1].trim() || null, url: m[2] });
    // Blank the whole match so offsets stay stable for the bare-URL pass.
    remaining = remaining.replace(m[0], ' '.repeat(m[0].length));
  }
  for (const m of remaining.matchAll(BARE_URL)) {
    found.push({ label: null, url: m[0] });
  }

  const seen = new Set<string>();
  const out: LinkedUrl[] = [];
  for (const item of found) {
    const url = item.url.replace(TRAILING_JUNK, '');
    if (!url) continue;
    try {
      new URL(url);
    } catch {
      continue;
    }
    // normalizeUrl is a DEDUPE KEY ONLY — it strips query params, which would destroy
    // Dropbox's mandatory rlkey, so the original string is what we keep.
    const key = normalizeUrl(url) ?? url;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ url, label: item.label });
  }
  return out;
}

export function classifyVideoUrl(url: string): VideoSourceKind {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return 'unknown';
  }
  const host = u.hostname;

  if (/^replay\.dropbox\.com$/i.test(host)) return 'dropbox-replay';
  if (/^(www\.)?(youtube\.com|youtu\.be)$/i.test(host)) return 'youtube';
  if (/(^|\.)dropbox\.com$/i.test(host)) {
    if (/^\/(scl\/fo|sh)\//i.test(u.pathname)) return 'dropbox-folder';
    if (/^\/(scl\/fi|s)\//i.test(u.pathname)) return 'dropbox-file';
    return 'unknown';
  }
  if (UNSUPPORTED_HOST_PATTERNS.some((re) => re.test(host))) return 'unsupported-host';
  if (VIDEO_EXT.test(u.pathname)) return 'direct-file';
  return 'unknown';
}

/** https/http, publicly routable. Guards the user-pasted override before it becomes an
 *  outbound fetch from render-service. */
export function isSafePublicHttpUrl(url: string): boolean {
  try {
    const u = new URL(url.trim());
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return false;
    return !BLOCKED_HOST.test(u.hostname);
  } catch {
    return false;
  }
}

const ATTEMPTABLE: VideoSourceKind[] = ['dropbox-file', 'direct-file', 'dropbox-folder'];

/** Worth handing to render-service: a shape it knows how to turn into video bytes. */
export function isAttemptableVideoLink(url: string): boolean {
  return isSafePublicHttpUrl(url) && ATTEMPTABLE.includes(classifyVideoUrl(url));
}

const BASE_SCORE: Record<VideoSourceKind, number> = {
  'dropbox-file': 100,
  'direct-file': 90,
  // Below the direct kinds: resolving one costs a Dropbox API round trip.
  'dropbox-folder': 60,
  'dropbox-replay': 0,
  'unsupported-host': 0,
  youtube: 0,
  unknown: 0,
};

const FIELD_BONUS: Record<VideoSourceField, number> = {
  final9x16: 12,
  final16x9: 8,
  final4x5: 4,
  assetFolderLink: 0,
};

const RATIO_9X16 = /9\s*[x×]\s*16/i;
const RATIO_16X9 = /16\s*[x×]\s*9/i;
const RATIO_4X5 = /4\s*[x×]\s*5/i;
const DEPRIORITISED = /working|raw|source|proxy|pending|draft|wip|textless/i;

function scoreCandidate(url: string, label: string | null, field: VideoSourceField, kind: VideoSourceKind): number {
  let score = BASE_SCORE[kind];
  if (score === 0) return 0;

  score += FIELD_BONUS[field];

  let filename = '';
  try {
    filename = decodeURIComponent(new URL(url).pathname.split('/').pop() ?? '');
  } catch {
    filename = '';
  }
  if (VIDEO_EXT.test(filename)) score += 30;

  const hay = `${label ?? ''} ${filename}`;
  if (RATIO_9X16.test(hay)) score += 6;
  else if (RATIO_16X9.test(hay)) score += 4;
  else if (RATIO_4X5.test(hay)) score += 2;

  if (DEPRIORITISED.test(hay)) score -= 8;

  return score;
}

/**
 * Pick the best usable video link across all four delivery-link fields.
 *
 * Scanning every field (rather than taking the first non-empty one) is what fixes the
 * tickets whose only direct file link sits in `assetFolderLink` while `final9x16` holds a
 * folder link. The `assetFolderLink` fallback itself dates from a33e581: per
 * lib/tickets/write.airtable.ts's own note on the "asset ready" trigger, non-ads tickets
 * have no ratio links, so the Asset Folder Link is their delivery signal instead.
 */
export function resolveVideoSource(fields: Partial<Record<VideoSourceField, string | null>>): VideoSourceResolution {
  const candidates: VideoSourceCandidate[] = [];

  for (const field of VIDEO_SOURCE_FIELDS) {
    for (const { url, label } of extractLinkedUrls(fields[field])) {
      const kind = classifyVideoUrl(url);
      const safe = isSafePublicHttpUrl(url);
      candidates.push({
        url,
        label,
        field,
        kind,
        score: safe ? scoreCandidate(url, label, field, kind) : 0,
        attemptable: safe && ATTEMPTABLE.includes(kind),
      });
    }
  }

  // Stable sort: Array.prototype.sort is stable, and candidates were pushed in
  // (field order, document order), so equal scores keep that ordering.
  const ranked = [...candidates].sort((a, b) => b.score - a.score);
  const chosen = ranked.find((c) => c.attemptable);
  if (chosen) return { ok: true, chosen, candidates: ranked };

  const anyText = VIDEO_SOURCE_FIELDS.map((f) => (fields[f] ?? '').trim()).find((v) => v.length > 0);

  if (candidates.length === 0) {
    return anyText
      ? { ok: false, reason: 'not-a-url', candidates: ranked, sample: anyText.slice(0, 80) }
      : { ok: false, reason: 'no-link', candidates: ranked, sample: null };
  }

  const replay = ranked.find((c) => c.kind === 'dropbox-replay');
  if (replay) return { ok: false, reason: 'replay-only', candidates: ranked, sample: replay.url };

  return { ok: false, reason: 'unsupported-host', candidates: ranked, sample: ranked[0]?.url ?? null };
}

/** "a" vs "an" for a host name — the messages read as prose, and "a app.frame.io link"
 *  is the kind of wrongness people notice. */
function article(word: string): string {
  return /^[aeiou]/i.test(word) ? 'an' : 'a';
}

function hostOf(url: string | null): string {
  if (!url) return 'that host';
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return 'that host';
  }
}

/** User-facing copy per failure reason. The app owns this wording; render-service's own
 *  `error` string is only the fallback for codes we don't recognise. */
export const VIDEO_SOURCE_FAILURE_MESSAGE: Record<VideoSourceFailureReason, (sample: string | null) => string> = {
  'no-link': () =>
    'No delivery link is attached to this ticket yet — add a 9×16 / 16×9 / 4×5 Final Link, or the Asset Folder Link, under Delivery links.',
  'not-a-url': (sample) =>
    `The delivery-link fields hold a note rather than a link (“${sample ?? ''}”). Paste a direct link to the final video below.`,
  'replay-only': () =>
    'This ticket only links Dropbox Replay, which is a review page rather than the file itself. Open it in Dropbox, then share the video file and paste that link below.',
  'unsupported-host': (sample) => {
    const host = hostOf(sample);
    const tail =
      /youtu/.test(host)
        ? ' YouTube sources already get transcript-only enrichment, which does not need frames.'
        : '';
    return `The only link on this ticket is ${article(host)} ${host} link, which can't be downloaded directly. Export the video and paste a direct Dropbox file link below.${tail}`;
  },
};

/** Which ratio column a link belongs in, read off its filename or label. Real deliverables
 *  are named for their ratio (a live example: `16x9-TAM-S26-Easy-to-get-healthy.mp4`), so
 *  this is right far more often than not — and the UI always shows the choice before
 *  anything is written. */
export function inferRatioField(url: string, label?: string | null): RatioField | null {
  let filename = '';
  try {
    filename = decodeURIComponent(new URL(url).pathname.split('/').pop() ?? '');
  } catch {
    filename = url;
  }
  const hay = `${label ?? ''} ${filename}`;
  if (RATIO_9X16.test(hay)) return 'final9x16';
  if (RATIO_16X9.test(hay)) return 'final16x9';
  if (RATIO_4X5.test(hay)) return 'final4x5';
  return null;
}
