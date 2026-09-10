// E12.2 — the Remotion renderer service. Bundles once at startup, then renders one EDL
// per POST /render request: brain (E12.1, in the main app) sends an EDL, this returns
// the rendered MP4 bytes directly in the response — no storage layer yet (see the PRD's
// "Draft storage & re-entry" open question). Never talks to Claude; pure translator.

import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createWriteStream } from 'node:fs';
import { mkdtemp, open, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { spawn } from 'node:child_process';
import { timingSafeEqual } from 'node:crypto';
import { pipeline } from 'node:stream/promises';
import { Readable, Transform } from 'node:stream';
import { bundle } from '@remotion/bundler';
import { renderMedia, selectComposition } from '@remotion/renderer';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 8080;

// Shared-secret bearer auth (2026-09-07) — this service was moved to public Cloud Run
// access (IAP blocked legitimate server-to-server calls from the main portal, and there
// was no CLI/IAM path available to grant it access instead). Public + a real secret gate
// is the same pattern already used for this app's other server-to-server calls
// (SYNC_SECRET on /api/sync/*, /api/clips/learn, /api/dna-review/learn) — /health stays
// open (no video/compute cost, useful for uptime checks).
function authorized(req) {
  const secret = process.env.RENDER_SERVICE_SECRET;
  if (!secret) return false; // fail closed if unset, never fail open
  const header = req.headers['authorization'] ?? '';
  const provided = header.startsWith('Bearer ') ? header.slice(7) : '';
  const a = Buffer.from(provided);
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}

// Bundle on first /render call, not eagerly on container start.
//
// Fixed 2026-09-07: the original code kicked off bundle() unconditionally at module load
// on every cold start, regardless of which endpoint the container was about to serve. On
// this Cloud Run container's small memory allocation, that webpack bundling step alone was
// enough to OOM-crash the process before it ever got to handle a request — confirmed via
// runtime logs showing "FATAL ERROR: ... heap out of memory" immediately after the
// "bundling composition" log line, with no request-handling code having run yet. This
// meant every cold start of /extract-frames (E13.2, which never touches Remotion at all)
// was paying for — and sometimes crashing on — a webpack build it doesn't need.
// getBundle() now only starts bundling the first time handleRender() actually needs it.
let bundlePromise = null;
function getBundle() {
  if (!bundlePromise) {
    console.log('[render-service] bundling composition (first /render call)...');
    bundlePromise = bundle({ entryPoint: path.join(__dirname, 'src', 'index.tsx') }).then((location) => {
      console.log('[render-service] bundle ready:', location);
      return location;
    });
    bundlePromise.catch((e) => console.error('[render-service] bundling failed:', e));
  }
  return bundlePromise;
}

/** Post-render loudness normalization to the EDL's target LUFS. Requires the `ffmpeg`
 *  binary (installed via apt in the Dockerfile) — separate from Remotion's own
 *  internally-bundled ffmpeg, which isn't meant to be shelled out to directly. */
function runFfmpegLoudnorm(inputPath, outputPath, targetLufs) {
  return new Promise((resolve, reject) => {
    const args = ['-y', '-i', inputPath, '-af', `loudnorm=I=${targetLufs}:TP=-1.5:LRA=11`, '-c:v', 'copy', outputPath];
    const proc = spawn('ffmpeg', args);
    let stderr = '';
    proc.stderr.on('data', (d) => { stderr += d.toString(); });
    proc.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`ffmpeg loudnorm failed (exit ${code}): ${stderr.slice(-2000)}`))));
    proc.on('error', reject);
  });
}

async function readBody(req) {
  let body = '';
  for await (const chunk of req) body += chunk;
  return body;
}

// ---------------------------------------------------------------------------
// POST /extract-frames (E13.2) — download a video, extract evenly-spaced frames,
// return them base64-inline. No storage layer (same as /render) — frames feed one
// multimodal Claude call in the main app and are discarded, so persisting them here
// would be waste, not a missing feature. Scoped to Dropbox-hosted deliverables for
// v1 (a direct file URL); YouTube sources already get transcript-only enrichment via
// the existing Supadata path in the main app and aren't handled here.
// ---------------------------------------------------------------------------

function runCommand(cmd, args) {
  return new Promise((resolve, reject) => {
    const proc = spawn(cmd, args);
    let stdout = '';
    let stderr = '';
    proc.stdout?.on('data', (d) => { stdout += d.toString(); });
    proc.stderr?.on('data', (d) => { stderr += d.toString(); });
    proc.on('close', (code) => (code === 0 ? resolve(stdout) : reject(new Error(`${cmd} failed (exit ${code}): ${stderr.slice(-2000)}`))));
    proc.on('error', reject);
  });
}

/** Auto-scaled frame budget for SHORT sources — matches the internal /watch skill's +
 *  BlinkLife Recorder's table (see plans/vishen-recorder-dna-review-loop.md). Sensible
 *  defaults so the caller never has to tune it. */
function frameBudgetFor(durationSec) {
  if (durationSec <= 30) return 30;
  if (durationSec <= 60) return 40;
  return 60; // ≤3min
}

/**
 * Frame budget and seek concurrency — both sized by the CONTAINER, not by what the source
 * could support.
 *
 * Learned the hard way 2026-09-09: concurrency 8 (fine locally) took production down with
 * HTTP 503s and no log line at all — the platform SIGKILLs the container on memory
 * exhaustion, so nothing gets printed. Measured peak RSS of one seek against a 1080p/8Mbps
 * master: 100MB with default threading, 62MB with `-threads 1 -an -sn -dn`. Eight of those
 * is ~940MB on what the earlier OOM crashes imply is a ~512MB container. Three is ~180MB,
 * which leaves room for Node.
 *
 * Wall clock at concurrency 3 is ~4s per frame effective (measured: 12s for 3 frames), so
 * 30 frames ≈ 120s — inside the client's 180s abort with headroom for a slower container.
 *
 * Both are env-overridable so the numbers can be raised from the Kessel dashboard after a
 * memory bump, without a code change.
 */
const SEEK_CONCURRENCY = Math.max(1, Number(process.env.EXTRACT_CONCURRENCY ?? 3));
const MAX_FRAMES = Math.max(1, Number(process.env.EXTRACT_MAX_FRAMES ?? 30));

const HEAD_WINDOW_SEC = 30; // where hook rules live — sampled densest
const MID_WINDOW_SEC = 120; // captions / safe area / early pacing

/**
 * The timestamps to sample, in seconds.
 *
 * Short sources (≤3min) sample uniformly — front-weighting a 45-second reel is meaningless,
 * and short-form is where most tickets live, so that behaviour is left as it was.
 *
 * Longer sources are FRONT-WEIGHTED, in three proportional bands: a third of the budget in
 * the first 30s (hook), a sixth across the rest of the first two minutes, and the remainder
 * spread evenly over everything after. Almost every DNA rule judges the opening, and uniform
 * sampling of a 65-minute master gives one frame every 39s — enough to prove the file exists,
 * useless for what is being reviewed.
 *
 * Every band is a SHARE of the budget rather than a fixed interval. A fixed mid-interval
 * starved a 4.7-minute video (30 frames in its first two minutes, 3 for the remaining 2.7);
 * proportional bands stay sane at both ends and rescale if MAX_FRAMES is raised.
 */
function frameScheduleFor(durationSec, budget = MAX_FRAMES) {
  if (durationSec <= 180) {
    const count = Math.min(frameBudgetFor(durationSec), budget);
    const interval = durationSec / count;
    return Array.from({ length: count }, (_, i) => i * interval);
  }

  const headCount = Math.max(1, Math.round(budget / 3));
  const midCount = Math.max(1, Math.round(budget / 6));
  const tailCount = Math.max(0, budget - headCount - midCount);
  const times = [];

  const span = (fromSec, toSec, n) => {
    if (n <= 0 || toSec <= fromSec) return;
    const step = (toSec - fromSec) / n;
    for (let i = 0; i < n; i++) times.push(fromSec + i * step);
  };

  span(0, Math.min(HEAD_WINDOW_SEC, durationSec), headCount);
  span(HEAD_WINDOW_SEC, Math.min(MID_WINDOW_SEC, durationSec), midCount);
  span(MID_WINDOW_SEC, durationSec, tailCount);

  // Never seek to the final moments: the last keyframe may be short and some encoders leave
  // an unreadable tail, which would fail a frame for no diagnostic gain.
  return times.filter((t) => t >= 0 && t < durationSec - 1);
}

/** A caller's `maxFrames` may only ever REDUCE the schedule (same contract as before).
 *  Subsampling evenly keeps the front-weighted shape rather than truncating to the opening
 *  and losing all coverage of the rest. */
function capSchedule(times, maxFrames) {
  if (typeof maxFrames !== 'number' || !Number.isFinite(maxFrames) || maxFrames < 1) return times;
  if (maxFrames >= times.length) return times;
  const step = times.length / maxFrames;
  return Array.from({ length: maxFrames }, (_, i) => times[Math.floor(i * step)]);
}

// 500MB guard — a runaway/huge source shouldn't hang the container. NOTE: Cloud Run's /tmp
// is a RAM-backed tmpfs, so this ceiling is effectively a memory ceiling too, on the same
// heap the 2026-09-07 OOM crashes exhausted. Keep it conservative.
const MAX_DOWNLOAD_BYTES = 500 * 1024 * 1024;

/** Below this we stage the file locally even though the host supports ranged reads: one
 *  sequential transfer of a small file beats ~60 network seeks. Above it, seeking in place
 *  is the only option that works at all — real deliverables measured 2026-09-09 were
 *  568MB, 3.5GB, 3.7GB and 10GB, so this is the common case, not the exception. */
const STAGE_LOCALLY_MAX_BYTES = 150 * 1024 * 1024;

/** Typed failure. `code` is contractual — the main app maps it to user-facing copy in
 *  lib/dna-review/frames.ts's RENDER_ERROR_MESSAGE table, and `status` decides whether
 *  that client retries (it retries 429/502/503 ONLY, so standing conditions must be
 *  400/413/422 and genuinely transient ones 502). */
class ExtractError extends Error {
  constructor(code, status, message, detail) {
    super(message);
    this.name = 'ExtractError';
    this.code = code;
    this.status = status;
    this.detail = detail ?? null;
  }
}

// Hosts whose share links serve an HTML app shell, never the file bytes. Measured against
// live production ticket links on 2026-09-08: every one of these answers 200 text/html,
// which the old code wrote verbatim to source.mp4 and only noticed as ffprobe's
// "moov atom not found". 5% of tickets link Dropbox Replay and 10% these others.
// Kept deliberately parallel to UNSUPPORTED_HOST_PATTERNS in lib/dna-review/video-source.ts
// — render-service is a separate npm project and cannot import from the app, so an edit
// here needs a matching edit there.
const UNSUPPORTED_HOSTS = [
  { match: /^replay\.dropbox\.com$/i, code: 'unsupported_dropbox_replay' },
  { match: /^(www\.)?(youtube\.com|youtu\.be)$/i, code: 'unsupported_youtube' },
  { match: /(^|\.)frame\.io$/i, code: 'unsupported_host' },
  { match: /^f\.io$/i, code: 'unsupported_host' },
  { match: /(^|\.)airtable\.com$/i, code: 'unsupported_host' },
  { match: /(^|\.)canva\.com$/i, code: 'unsupported_host' },
  { match: /^canva\.link$/i, code: 'unsupported_host' },
  { match: /(^|\.)sharepoint\.com$/i, code: 'unsupported_host' },
  { match: /^(drive|docs)\.google\.com$/i, code: 'unsupported_host' },
  { match: /(^|\.)figma\.com$/i, code: 'unsupported_host' },
  { match: /(^|\.)descript\.com$/i, code: 'unsupported_host' },
  { match: /(^|\.)atlassian\.net$/i, code: 'unsupported_host' },
  { match: /(^|\.)notion\.so$/i, code: 'unsupported_host' },
  { match: /(^|\.)wetransfer\.com$/i, code: 'unsupported_host' },
];

// SSRF guard. This endpoint is public Cloud Run (secret-gated) and now accepts a
// user-pasted URL forwarded from the portal, so it must never be talked into fetching the
// GCP metadata server or anything on a private range.
const BLOCKED_HOST =
  /^(localhost|\[?::1\]?|0\.0\.0\.0|metadata\.google\.internal)$|\.internal$|^127\.|^10\.|^169\.254\.|^192\.168\.|^172\.(1[6-9]|2\d|3[01])\./i;

/** True for Dropbox share links that address a FOLDER rather than a file. `dl=1` on these
 *  returns a .zip of the whole folder (measured: 1.47GB, content-type application/zip) —
 *  and so does `dl=0` for a non-browser client. 28% of tickets link only a folder, which
 *  is the single largest cause of the "moov atom not found" report. Resolved properly via
 *  the Dropbox API below instead. */
function isDropboxFolderUrl(u) {
  return /(^|\.)dropbox\.com$/i.test(u.hostname) && /^\/(scl\/fo|sh)\//i.test(u.pathname);
}

/** Parse + reject everything we can judge before spending any network I/O.
 *  Returns { url: URL, kind: 'dropbox-folder' | 'plain' }. */
function classifySourceUrl(raw) {
  let u;
  try {
    u = new URL(raw);
  } catch {
    throw new ExtractError('invalid_url', 400, 'videoUrl is not a valid URL.', String(raw).slice(0, 80));
  }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') {
    throw new ExtractError('invalid_url', 400, `Unsupported URL scheme "${u.protocol}".`, u.protocol);
  }
  if (BLOCKED_HOST.test(u.hostname)) {
    throw new ExtractError('blocked_host', 400, 'That URL points at a private or internal address.', u.hostname);
  }
  const bad = UNSUPPORTED_HOSTS.find((h) => h.match.test(u.hostname));
  if (bad) {
    throw new ExtractError(bad.code, 422, `${u.hostname} links cannot be downloaded directly.`, u.hostname);
  }
  return { url: u, kind: isDropboxFolderUrl(u) ? 'dropbox-folder' : 'plain' };
}

/** Dropbox share links (`dl=0`) redirect to an HTML preview, not the file bytes;
 *  `dl=1` redirects to the direct-download CDN URL instead. Verified empirically
 *  against real production links — no Dropbox API/OAuth needed for "anyone with the
 *  link" shares of a single FILE. Non-Dropbox URLs are passed through unchanged.
 *
 *  Rewritten 2026-09-08 — the previous one-liner had three defects: a blind
 *  `url.replace('dl=0','dl=1')` that could hit any occurrence anywhere in the URL
 *  (including inside `rlkey`), an already-`dl=1` test that missed `?dl=1#frag`, and a
 *  loose `/dropbox\.com/` that also matched replay.dropbox.com, where `dl=1` is
 *  meaningless — which is exactly the path that produced the reported bug. */
function toDirectDownloadUrl(u) {
  if (!/(^|\.)dropbox\.com$/i.test(u.hostname)) return u.toString();
  const out = new URL(u.toString());
  out.searchParams.set('dl', '1'); // idempotent; preserves rlkey/st/e and the fragment
  return out.toString();
}

const SNIFF_BYTES = 64 * 1024;

/** The origin's real total size: `content-range` when we got a 206, else `content-length`. */
function totalBytesFrom(headers) {
  const range = headers.get('content-range'); // "bytes 0-65535/82984167"
  if (range) {
    const n = Number(range.split('/')[1]);
    if (Number.isFinite(n) && n > 0) return n;
  }
  const len = Number(headers.get('content-length') ?? 0);
  return Number.isFinite(len) && len > 0 ? len : 0;
}

/** Cheap 64KB ranged GET so we can reject a non-video before committing to the transfer.
 *  Without this, a folder link costs a 1.47GB download before ffprobe complains. */
async function sniffSource(directUrl) {
  const ac = new AbortController();
  let resp;
  try {
    resp = await fetch(directUrl, {
      redirect: 'follow',
      signal: ac.signal,
      headers: { Range: `bytes=0-${SNIFF_BYTES - 1}` },
    });
  } catch (e) {
    throw new ExtractError('download_http_error', 502, `Could not reach that link: ${e.message}`);
  }
  if (!resp.ok && resp.status !== 206) {
    ac.abort();
    throw new ExtractError(
      'download_http_error',
      502,
      `The host refused the download (HTTP ${resp.status}).`,
      String(resp.status),
    );
  }

  const chunks = [];
  let n = 0;
  if (resp.body) {
    for await (const c of resp.body) {
      chunks.push(Buffer.from(c));
      n += c.length;
      if (n >= SNIFF_BYTES) break;
    }
    // A server that ignores Range answers 200 with the FULL body — without this abort we
    // stream the entire file we were trying to avoid downloading.
    ac.abort();
  }

  return {
    head: Buffer.concat(chunks),
    contentType: (resp.headers.get('content-type') ?? '').toLowerCase(),
    contentDisposition: resp.headers.get('content-disposition') ?? '',
    totalBytes: totalBytesFrom(resp.headers),
    // NOTE: the post-redirect URL (`resp.url`) is deliberately NOT returned for reuse.
    // Dropbox's signed dl.dropboxusercontent.com/cd/0/get/... token is single-use — handing
    // it to a second process answers 403 Forbidden (confirmed 2026-09-09 against the 10GB
    // production master). ffmpeg is given the pre-redirect `dl=1` URL and follows the
    // redirect itself, minting its own token per seek.
    // 206 means the origin honoured our Range header, which is exactly the capability the
    // seek-in-place extraction path needs. A 200 here means it ignored Range and started
    // sending the whole file — the case the abort above exists to contain.
    rangeSupported: resp.status === 206,
  };
}

// Container signatures.
//
// ⚠️ Content-type can NOT be used as an allowlist: the WORKING Dropbox /scl/fi/ path
// answers `content-type: application/binary`, not video/*. Measured 2026-09-08 against a
// real production link (83MB mp4). Turning the check below into `if (!/^video\//) reject`
// would break 56% of tickets — the ones that currently work. Content-type is a denylist
// only; the positive signal is the magic bytes.
const VIDEO_SIGNATURES = [
  // ISO-BMFF: MP4 / MOV / M4V — the box type at offset 4
  (b) => b.length >= 12 && ['ftyp', 'moov', 'mdat', 'free', 'skip', 'wide', 'pnot'].includes(b.toString('latin1', 4, 8)),
  (b) => b.toString('latin1', 0, 4) === 'RIFF' && b.toString('latin1', 8, 12) === 'AVI ',
  (b) => b[0] === 0x1a && b[1] === 0x45 && b[2] === 0xdf && b[3] === 0xa3, // Matroska / WebM
  (b) => b.toString('latin1', 0, 4) === 'OggS',
  (b) => b.toString('latin1', 0, 3) === 'FLV',
  (b) => b[0] === 0x00 && b[1] === 0x00 && b[2] === 0x01 && (b[3] === 0xba || b[3] === 0xb3), // MPEG-PS
  (b) => b.length > 188 && b[0] === 0x47 && b[188] === 0x47, // MPEG-TS
];

const NON_VIDEO_SIGNATURES = [
  { what: 'a .zip archive', test: (b) => b.toString('latin1', 0, 2) === 'PK' },
  { what: 'an HTML page', test: (b) => /^\s*(<!doctype|<html|<\?xml|<head)/i.test(b.toString('utf8', 0, 256)) },
  { what: 'a JSON response', test: (b) => /^\s*[{[]/.test(b.toString('utf8', 0, 64)) },
  { what: 'a PDF', test: (b) => b.toString('latin1', 0, 4) === '%PDF' },
  {
    what: 'a still image',
    test: (b) =>
      b.toString('latin1', 0, 3) === 'GIF' ||
      (b[0] === 0x89 && b.toString('latin1', 1, 4) === 'PNG') ||
      (b[0] === 0xff && b[1] === 0xd8),
  },
];

const DENIED_CONTENT_TYPES = [/^text\//, /^application\/(zip|x-zip-compressed|json|xml|pdf)/, /^multipart\//, /^image\//];

function isVideoBytes(head) {
  return VIDEO_SIGNATURES.some((t) => {
    try {
      return t(head);
    } catch {
      return false;
    }
  });
}

/** Throws a precise ExtractError, or returns quietly for a plausible video.
 *
 *  The size ceiling deliberately lives on the DOWNLOAD path (see assertDownloadable), not
 *  here: it is a memory guard, and the seek-in-place path never stages the file, so a 10GB
 *  master is fine there. Checking it here would reject every real deliverable — which is
 *  exactly the bug this split fixes. */
function assertVideoSource(u, sniff) {
  if (sniff.head.length === 0) {
    throw new ExtractError('source_empty', 422, 'That link returned an empty response.');
  }

  const looksZipped = /filename\*?=[^;]*\.zip/i.test(sniff.contentDisposition);
  const shape = NON_VIDEO_SIGNATURES.find((s) => s.test(sniff.head));
  const isDropbox = /(^|\.)dropbox\.com$/i.test(u.hostname);

  // A zip from Dropbox means the link addressed a folder — name it as such rather than as
  // a generic non-video, since the fix is completely different.
  if ((shape?.what === 'a .zip archive' || looksZipped) && isDropbox) {
    throw new ExtractError(
      'unsupported_dropbox_folder',
      422,
      'That Dropbox link downloads as a .zip of a folder, not a video file.',
      'zip',
    );
  }
  if (shape) {
    throw new ExtractError(
      'not_a_video',
      422,
      `That link returned ${shape.what}${sniff.contentType ? ` (${sniff.contentType})` : ''}, not a video file.`,
      shape.what,
    );
  }
  if (DENIED_CONTENT_TYPES.some((re) => re.test(sniff.contentType))) {
    throw new ExtractError(
      'not_a_video',
      422,
      `That link returned content-type ${sniff.contentType}, not a video file.`,
      sniff.contentType,
    );
  }
  if (!isVideoBytes(sniff.head)) {
    throw new ExtractError(
      'not_a_video',
      422,
      `The first bytes of that file are not a known video container${sniff.contentType ? ` (content-type ${sniff.contentType})` : ''}.`,
      sniff.head.toString('hex', 0, 12),
    );
  }
}

/** Shared 500MB mid-stream ceiling for both download paths. */
function makeSizeGuard(counter) {
  return new Transform({
    transform(chunk, _enc, cb) {
      counter.total += chunk.length;
      if (counter.total > MAX_DOWNLOAD_BYTES) {
        cb(new ExtractError('source_too_large', 413, 'Source file exceeded the 500MB guard mid-download.'));
        return;
      }
      cb(null, chunk);
    },
  });
}

/** Post-transfer sanity: 0 bytes, absurdly small, or short of what the origin promised.
 *  The bytes-vs-content-length reconciliation is the check that was entirely missing — a
 *  server that closes cleanly after a partial body used to be reported as a success, and
 *  the truncated file then surfaced as "moov atom not found". */
function assertTransferComplete(total, expected) {
  if (total === 0) throw new ExtractError('source_empty', 422, 'The download produced a 0-byte file.');
  if (total < 1024) {
    throw new ExtractError('not_a_video', 422, `The download produced only ${total} bytes — not a video file.`, String(total));
  }
  // Only meaningful when the origin declared a length; chunked responses don't.
  if (expected && total < expected) {
    throw new ExtractError(
      'download_truncated',
      502,
      `The download ended early — got ${total} of ${expected} bytes.`,
      `${total}/${expected}`,
    );
  }
}

/**
 * Streams the download straight to disk — near-constant memory regardless of file size.
 * Fixed 2026-09-07 after real production OOM crashes: the original implementation
 * buffered the entire video in an array + Buffer.concat before writing, which worked only
 * by accident for small test files and reliably crashed the container (small Cloud Run
 * memory, plus Remotion's own bundling step competing for the same heap) on real videos —
 * see plans/now-lets-plan-this-reflective-thunder.md's "render-service OOM-crashing" note.
 *
 * Extended 2026-09-08 with the pre-flight sniff + post-transfer reconciliation, so a link
 * that isn't a video fails in ~1s with a diagnosis instead of after a full download with
 * an ffprobe stack trace.
 */
async function downloadVideo(u, destPath, presniffed) {
  const direct = toDirectDownloadUrl(u);
  const sniff = presniffed ?? (await sniffSource(direct));
  if (!presniffed) assertVideoSource(u, sniff);
  assertDownloadable(sniff);

  const resp = await fetch(direct, { redirect: 'follow' });
  if (!resp.ok || !resp.body) {
    throw new ExtractError('download_http_error', 502, `Download failed: HTTP ${resp.status}`, String(resp.status));
  }
  const expected = totalBytesFrom(resp.headers);
  if (expected > MAX_DOWNLOAD_BYTES) {
    throw new ExtractError('source_too_large', 413, `Source file is ${Math.round(expected / 1e6)}MB (max 500MB).`);
  }

  const counter = { total: 0 };
  await pipeline(Readable.fromWeb(resp.body), makeSizeGuard(counter), createWriteStream(destPath));
  assertTransferComplete(counter.total, expected);
}

/** The memory guard, applied only where the file actually gets staged in tmpfs. Reached
 *  only when the origin refused Range, since a range-capable host takes the seek path
 *  regardless of size. */
function assertDownloadable(sniff) {
  if (sniff.totalBytes && sniff.totalBytes > MAX_DOWNLOAD_BYTES) {
    throw new ExtractError(
      'source_too_large',
      413,
      `Source file is ${Math.round(sniff.totalBytes / 1e6)}MB and that host does not support ranged reads, so it would have to be staged whole (max 500MB).`,
      String(sniff.totalBytes),
    );
  }
}

// ---------------------------------------------------------------------------
// Dropbox folder links (2026-09-08). 28% of tickets link only a Dropbox FOLDER, whose
// only no-auth download form is a .zip of everything in it. Resolved instead via the
// Dropbox API:
//   files/list_folder            {path:"", shared_link:{url}}   user auth, files.metadata.read
//   sharing/get_shared_link_file {url, path:"/name.mp4"}        app|user, sharing.read
// list_folder permits user auth only, so an app key/secret pair isn't enough — this needs
// a one-time offline OAuth grant and the resulting refresh token. Absent the creds we
// return dropbox_folder_unconfigured and the portal falls back to its paste-a-link box.
// ---------------------------------------------------------------------------

const VIDEO_EXT = /\.(mp4|mov|m4v|webm|mkv|avi)$/i;
const DEPRIORITISED = /working|raw|source|proxy|draft|wip|textless|pending/i;

function dropboxConfigured() {
  return Boolean(process.env.DROPBOX_APP_KEY && process.env.DROPBOX_APP_SECRET && process.env.DROPBOX_REFRESH_TOKEN);
}

let dropboxToken = { value: null, expiresAt: 0 };

/** Short-lived access token from the long-lived refresh token, memoized just under
 *  Dropbox's ~4h expiry. */
async function dropboxAccessToken() {
  if (dropboxToken.value && Date.now() < dropboxToken.expiresAt) return dropboxToken.value;

  const basic = Buffer.from(`${process.env.DROPBOX_APP_KEY}:${process.env.DROPBOX_APP_SECRET}`).toString('base64');
  const resp = await fetch('https://api.dropboxapi.com/oauth2/token', {
    method: 'POST',
    headers: { Authorization: `Basic ${basic}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: process.env.DROPBOX_REFRESH_TOKEN }),
  });
  const body = await resp.text();
  if (!resp.ok) {
    throw new ExtractError(
      'dropbox_folder_unauthorized',
      422,
      'Dropbox rejected our stored credentials — the refresh token may have been revoked.',
      `${resp.status}: ${body.slice(0, 200)}`,
    );
  }
  const parsed = JSON.parse(body);
  dropboxToken = {
    value: parsed.access_token,
    expiresAt: Date.now() + Math.max(60, (parsed.expires_in ?? 14400) - 300) * 1000,
  };
  return dropboxToken.value;
}

/** Dropbox-API-Arg must be HTTP-header-safe ASCII, and real filenames carry en-dashes and
 *  accents (a live example: "Viral Clip Creation – Vishen Lakhiani…"), so every non-ASCII
 *  codepoint has to go out as a \uXXXX escape. */
function asciiJson(obj) {
  return JSON.stringify(obj).replace(/[\u007f-\uffff]/g, (c) => `\\u${c.charCodeAt(0).toString(16).padStart(4, '0')}`);
}

async function dropboxRpc(endpoint, arg) {
  const token = await dropboxAccessToken();
  const resp = await fetch(`https://api.dropboxapi.com/2/${endpoint}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(arg),
  });
  const body = await resp.text();
  if (!resp.ok) {
    const code = resp.status === 401 || resp.status === 403 ? 'dropbox_folder_unauthorized' : 'dropbox_folder_no_video';
    throw new ExtractError(
      code,
      422,
      resp.status === 401 || resp.status === 403
        ? 'We do not have permission to open that Dropbox folder.'
        : 'Dropbox could not list that folder link.',
      `${resp.status}: ${body.slice(0, 200)}`,
    );
  }
  return JSON.parse(body);
}

/** One level of a shared folder. `prefix` is the path relative to the share root ('' at
 *  the top). Paginates; entries come back tagged file/folder. */
async function listSharedFolder(shareUrl, prefix = '') {
  const entries = [];
  let page = await dropboxRpc('files/list_folder', { path: prefix, shared_link: { url: shareUrl } });
  for (;;) {
    for (const e of page.entries ?? []) {
      entries.push({ tag: e['.tag'], name: e.name, size: e.size ?? 0, path: `${prefix}/${e.name}` });
    }
    if (!page.has_more) break;
    page = await dropboxRpc('files/list_folder/continue', { cursor: page.cursor });
  }
  return entries;
}

/** Best video file in a listing: playable extension, within the size ceiling, then
 *  ratio-named files first and working/raw/textless variants last, largest as tiebreak. */
function pickVideoEntry(entries) {
  const scored = entries
    .filter((e) => e.tag === 'file' && VIDEO_EXT.test(e.name) && e.size > 0 && e.size <= MAX_DOWNLOAD_BYTES)
    .map((e) => {
      let score = 0;
      if (/9\s*[x×]\s*16/i.test(e.name)) score += 6;
      else if (/16\s*[x×]\s*9/i.test(e.name)) score += 4;
      else if (/4\s*[x×]\s*5/i.test(e.name)) score += 2;
      if (DEPRIORITISED.test(e.path)) score -= 8;
      if (/final/i.test(e.name)) score += 3;
      return { entry: e, score };
    })
    .sort((a, b) => b.score - a.score || b.entry.size - a.entry.size);
  return scored[0]?.entry ?? null;
}

/** Stream one file out of a shared folder link. This is a download-style endpoint on the
 *  content host, so the arg travels in a header and the body is the raw bytes. */
async function streamSharedLinkFile(shareUrl, relPath, destPath) {
  const token = await dropboxAccessToken();
  const resp = await fetch('https://content.dropboxapi.com/2/sharing/get_shared_link_file', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Dropbox-API-Arg': asciiJson({ url: shareUrl, path: relPath }),
    },
  });
  if (!resp.ok || !resp.body) {
    const body = await resp.text().catch(() => '');
    throw new ExtractError(
      'dropbox_folder_unauthorized',
      422,
      `Dropbox refused to download "${relPath}" from that folder.`,
      `${resp.status}: ${body.slice(0, 200)}`,
    );
  }
  const expected = totalBytesFrom(resp.headers);
  const counter = { total: 0 };
  await pipeline(Readable.fromWeb(resp.body), makeSizeGuard(counter), createWriteStream(destPath));
  assertTransferComplete(counter.total, expected);
}

/** Resolve a Dropbox folder share to the best video inside it and download that. */
async function downloadFromDropboxFolder(u, destPath) {
  if (!dropboxConfigured()) {
    throw new ExtractError(
      'dropbox_folder_unconfigured',
      422,
      'That Dropbox link is a folder, and Dropbox folder access is not configured on this service.',
      u.pathname.split('/').slice(1, 3).join('/'),
    );
  }
  const shareUrl = u.toString();

  let entries = await listSharedFolder(shareUrl);
  let chosen = pickVideoEntry(entries);

  // Descend one level when the top holds only subfolders ("Working Files (Pending)",
  // "16x9", … are the common shapes). Capped so a deep share can't fan out.
  if (!chosen) {
    const subs = entries.filter((e) => e.tag === 'folder').slice(0, 6);
    for (const sub of subs) {
      const inner = await listSharedFolder(shareUrl, sub.path);
      entries = entries.concat(inner);
    }
    chosen = pickVideoEntry(entries);
  }

  if (!chosen) {
    const oversize = entries.find((e) => e.tag === 'file' && VIDEO_EXT.test(e.name) && e.size > MAX_DOWNLOAD_BYTES);
    if (oversize) {
      throw new ExtractError(
        'dropbox_folder_video_too_large',
        413,
        `The video in that folder ("${oversize.name}") is ${Math.round(oversize.size / 1e6)}MB, over the 500MB limit.`,
        String(oversize.size),
      );
    }
    throw new ExtractError(
      'dropbox_folder_no_video',
      422,
      'That Dropbox folder has no video file we can read.',
      `${entries.length} entries`,
    );
  }

  console.log(`[render-service] dropbox folder resolved to "${chosen.path}" (${chosen.size} bytes)`);
  await streamSharedLinkFile(shareUrl, chosen.path, destPath);
}

/** Magic-byte check on what actually landed on disk. Cheap, and it turns a corrupt or
 *  wrong-type file into a precise message rather than an ffprobe stack. */
async function assertVideoFileOnDisk(filePath) {
  const fh = await open(filePath, 'r');
  try {
    const buf = Buffer.alloc(512);
    const { bytesRead } = await fh.read(buf, 0, 512, 0);
    const head = buf.subarray(0, bytesRead);
    const shape = NON_VIDEO_SIGNATURES.find((s) => s.test(head));
    if (shape) {
      throw new ExtractError('not_a_video', 422, `The downloaded file is ${shape.what}, not a video.`, shape.what);
    }
  } finally {
    await fh.close();
  }
}

const isRemoteInput = (input) => /^https?:\/\//i.test(input);

/** HTTP-protocol options for a remote input: survive a dropped connection mid-seek rather
 *  than failing the frame. Only valid on an http(s) input — ffmpeg rejects them for a
 *  local file. Must precede `-i`. */
const REMOTE_INPUT_FLAGS = ['-reconnect', '1', '-reconnect_streamed', '1', '-reconnect_delay_max', '5'];

/** Duration of a local path OR a remote URL. ffprobe handles both; against a range-capable
 *  host it range-requests just the header and footer, so this costs ~2.6s even on a 10GB
 *  file (measured) rather than a download. */
async function probeDurationSec(input) {
  let out;
  try {
    out = await runCommand('ffprobe', [
      '-v', 'error',
      ...(isRemoteInput(input) ? REMOTE_INPUT_FLAGS : []),
      '-show_entries', 'format=duration', '-of', 'csv=p=0',
      input,
    ]);
  } catch (e) {
    // A valid ftyp header with no moov yet is the real "still uploading" case — the one
    // situation where the original bare ffprobe error was actually informative.
    throw new ExtractError(
      'probe_failed',
      422,
      'That link is not a readable video — it may be corrupt or still uploading.',
      String(e.message ?? e).slice(-400),
    );
  }
  const seconds = parseFloat(out.trim());
  if (!Number.isFinite(seconds) || seconds <= 0) {
    throw new ExtractError('probe_failed', 422, 'Could not determine the video duration (ffprobe read no duration).', out.slice(0, 200));
  }
  return seconds;
}

/**
 * Extract one frame per requested timestamp, by seeking to each.
 *
 * `-ss` goes BEFORE `-i`, which is the entire point: input seeking makes ffmpeg jump to the
 * timestamp (a range request, on a remote input) instead of decoding from zero. That is what
 * lets this read a 10GB master without downloading it — measured at 5-7s per frame whether
 * the target is 30s or 3600s in, i.e. flat with depth.
 *
 * Replaces a single `fps=1/interval` pass. That was cheaper for a local file, but it can only
 * sample uniformly and it requires the whole file on disk — and on Cloud Run "disk" is
 * RAM-backed tmpfs, which is why the old design capped sources at 500MB and therefore
 * rejected essentially every real deliverable.
 */
async function extractFramesAt(input, workDir, timesSec) {
  const remote = isRemoteInput(input);
  const results = new Array(timesSec.length).fill(null);
  let cursor = 0;
  const failures = [];

  async function worker() {
    for (;;) {
      const i = cursor++;
      if (i >= timesSec.length) return;
      const t = timesSec[i];
      const file = path.join(workDir, `frame_${String(i).padStart(4, '0')}.jpg`);
      try {
        await runCommand('ffmpeg', [
          '-nostdin', '-loglevel', 'error', '-y',
          // `-threads 1` is a memory decision, not a speed one: it cut peak RSS from 100MB
          // to 62MB per process, and the container has ~1 CPU anyway so extra decode
          // threads buy nothing. See the SEEK_CONCURRENCY note.
          '-threads', '1',
          ...(remote ? REMOTE_INPUT_FLAGS : []),
          '-ss', String(t),
          '-i', input,
          // Nothing but video is wanted — don't allocate for audio/subtitle/data streams.
          '-an', '-sn', '-dn',
          '-frames:v', '1',
          '-vf', `scale='min(1024,iw)':'min(1024,ih)':force_original_aspect_ratio=decrease`,
          '-q:v', '3',
          file,
        ]);
        results[i] = { file, timestampMs: Math.round(t * 1000) };
      } catch (e) {
        // One unreadable timestamp shouldn't lose the other 59 frames — a damaged GOP or a
        // momentary connection drop is a partial result, not a failed review.
        failures.push(`${t}s: ${String(e.message ?? e).slice(-120)}`);
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(SEEK_CONCURRENCY, timesSec.length) }, worker));

  const frames = results.filter(Boolean);
  if (frames.length === 0) {
    throw new ExtractError(
      'extract_failed',
      500,
      'ffmpeg could not extract any frames from this video.',
      failures.slice(0, 3).join(' | ').slice(-400),
    );
  }
  if (failures.length) {
    console.warn(`[extract-frames] ${failures.length}/${timesSec.length} timestamps failed:`, failures.slice(0, 3));
  }
  return frames;
}

async function handleExtractFrames(req, res) {
  let payload;
  try {
    payload = JSON.parse(await readBody(req));
  } catch {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: false, code: 'invalid_body', error: 'Request body must be JSON.' }));
    return;
  }

  const videoUrl = payload?.videoUrl;
  if (typeof videoUrl !== 'string' || !videoUrl.trim()) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: false, code: 'invalid_body', error: 'Body must be { videoUrl: string }.' }));
    return;
  }

  let workDir = null;

  try {
    // Judged before any temp dir or network I/O, so an unsupported link costs nothing.
    const { url, kind } = classifySourceUrl(videoUrl.trim());

    workDir = await mkdtemp(path.join(tmpdir(), 'extract-frames-'));

    // What ffprobe/ffmpeg read: either a staged local file or the source URL itself.
    let input;

    if (kind === 'dropbox-folder') {
      // The folder path resolves through a Dropbox content endpoint that streams bytes
      // rather than handing back a range-seekable public URL, so it still stages locally
      // (and still carries the 500MB ceiling). Unblocking multi-GB folder videos needs
      // either ffmpeg `-headers` with the Dropbox auth or files/get_temporary_link — and
      // the folder path is credential-blocked today anyway.
      input = path.join(workDir, 'source.mp4');
      await downloadFromDropboxFolder(url, input);
      await assertVideoFileOnDisk(input);
    } else {
      const sniff = await sniffSource(toDirectDownloadUrl(url));
      assertVideoSource(url, sniff);

      // Prefer seeking in place. Stage locally only when the origin refuses Range (seeks
      // would be impossible) or the file is small enough that one transfer beats ~60
      // network round-trips.
      const small = sniff.totalBytes > 0 && sniff.totalBytes <= STAGE_LOCALLY_MAX_BYTES;
      if (!sniff.rangeSupported || small) {
        input = path.join(workDir, 'source.mp4');
        await downloadVideo(url, input, sniff);
        await assertVideoFileOnDisk(input);
      } else {
        // The pre-redirect `dl=1` URL, not the signed one the sniff landed on — see the
        // note in sniffSource. ffmpeg re-follows the redirect per seek, which costs one
        // extra request each and is the only form that actually works.
        input = toDirectDownloadUrl(url);
      }
    }

    const durationSec = await probeDurationSec(input);

    // `probeOnly` answers "is this link usable?" without paying for ffmpeg or the
    // downstream Claude call — useful for validating a pasted link in the portal.
    if (payload?.probeOnly === true) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true, probeOnly: true, durationMs: Math.round(durationSec * 1000) }));
      return;
    }

    const frameFiles = await extractFramesAt(input, workDir, capSchedule(frameScheduleFor(durationSec), Math.min(payload?.maxFrames ?? MAX_FRAMES, MAX_FRAMES)));

    const frames = await Promise.all(
      frameFiles.map(async ({ file, timestampMs }) => ({
        timestampMs,
        base64: (await readFile(file)).toString('base64'),
      })),
    );

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true, durationMs: Math.round(durationSec * 1000), frames }));
  } catch (e) {
    const err = e instanceof ExtractError
      ? e
      : new ExtractError('internal', 500, e instanceof Error ? e.message : 'Frame extraction failed');
    // One line per failure, with the code first so runtime-logs can be grepped by cause.
    console.error(`[render-service] extract-frames ${err.code}: ${err.message}`, err.detail ?? '');
    if (err.code === 'internal' || err.code === 'extract_failed') console.error(e);
    res.writeHead(err.status, { 'Content-Type': 'application/json' });
    // `error` stays a human sentence: the currently-deployed client reads only that field,
    // so an old app talking to this service still gets a better message than before.
    res.end(JSON.stringify({ ok: false, code: err.code, error: err.message, detail: err.detail }));
  } finally {
    if (workDir) await rm(workDir, { recursive: true, force: true });
  }
}

async function handleRender(req, res) {
  let payload;
  try {
    payload = JSON.parse(await readBody(req));
  } catch {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: false, error: 'Request body must be JSON.' }));
    return;
  }

  const edl = payload?.edl;
  if (!edl || typeof edl.source_uri !== 'string' || typeof edl.in !== 'number' || typeof edl.out !== 'number') {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: false, error: 'Body must be { edl: Edl } with at least source_uri, in, out.' }));
    return;
  }

  const workDir = await mkdtemp(path.join(tmpdir(), 'edl-render-'));
  const rawOut = path.join(workDir, 'raw.mp4');
  const finalOut = path.join(workDir, 'final.mp4');

  try {
    const bundleLocation = await getBundle();
    const composition = await selectComposition({ serveUrl: bundleLocation, id: 'EdlClip', inputProps: { edl } });

    await renderMedia({
      composition,
      serveUrl: bundleLocation,
      codec: 'h264',
      outputLocation: rawOut,
      inputProps: { edl },
      // The flag the Remotion docs call out as critical for containerized/headless environments.
      chromiumOptions: { enableMultiProcessOnLinux: true },
    });

    let outputPath = rawOut;
    if (edl.audio?.normalize && typeof edl.audio.target_lufs === 'number') {
      await runFfmpegLoudnorm(rawOut, finalOut, edl.audio.target_lufs);
      outputPath = finalOut;
    }

    const video = await readFile(outputPath);
    res.writeHead(200, { 'Content-Type': 'video/mp4', 'Content-Length': video.length });
    res.end(video);
  } catch (e) {
    console.error(`[render-service] render failed for clip ${edl.clip_id}:`, e);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: false, error: e instanceof Error ? e.message : 'Render failed' }));
  } finally {
    await rm(workDir, { recursive: true, force: true });
  }
}

const server = http.createServer((req, res) => {
  if (req.method === 'POST' && (req.url === '/render' || req.url === '/extract-frames')) {
    if (!authorized(req)) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: false, error: 'unauthorized' }));
      return;
    }
  }
  if (req.method === 'POST' && req.url === '/render') {
    handleRender(req, res).catch((e) => {
      console.error('[render-service] unhandled error:', e);
      if (!res.headersSent) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, error: 'Internal error' }));
      }
    });
    return;
  }
  if (req.method === 'POST' && req.url === '/extract-frames') {
    handleExtractFrames(req, res).catch((e) => {
      console.error('[render-service] unhandled error:', e);
      if (!res.headersSent) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, error: 'Internal error' }));
      }
    });
    return;
  }
  if (req.method === 'GET' && req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true }));
    return;
  }
  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ ok: false, error: 'Not found' }));
});

server.listen(PORT, () => {
  console.log(`[render-service] listening on :${PORT}`);
});
