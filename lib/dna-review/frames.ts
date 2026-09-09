// Client for render-service's POST /extract-frames (E13.2). Follows the bounded-retry
// pattern already established for cross-service calls in lib/mcp/client.ts — retry only
// transient upstream faults (429/502/503), not standing conditions. render-service has no
// storage layer; frames come back base64-inline and are meant to be used once, not cached.
//
// render-service is public Cloud Run access (IAP blocked legitimate calls from this app
// with no CLI/IAM path to fix — see plans/... and the PRD's Rules & Logic), gated instead
// by RENDER_SERVICE_SECRET as a bearer token — same shared-secret pattern as this app's
// other server-to-server calls (SYNC_SECRET).

export interface ExtractedFrame {
  timestampMs: number;
  base64: string; // JPEG, no data: prefix
}

export interface ExtractFramesResult {
  ok: boolean;
  durationMs?: number;
  frames?: ExtractedFrame[];
  /** Human sentence, already mapped through RENDER_ERROR_MESSAGE where we know the code. */
  error?: string;
  /** render-service's structured failure code (added 2026-09-08). `undefined` when talking
   *  to an older render-service deploy — callers must degrade to `error` alone. */
  code?: string;
  detail?: string | null;
  /** True when the failure means "this link isn't a downloadable video", i.e. the portal
   *  should offer its paste-a-direct-link box rather than just reporting a failure. */
  needsLink?: boolean;
}

interface RenderErrorBody {
  ok?: boolean;
  code?: string;
  error?: string;
  detail?: string | null;
  durationMs?: number;
  frames?: ExtractedFrame[];
}

/**
 * render-service failure codes -> user-facing copy. The app owns the wording; the
 * service's own `error` string is the fallback for codes we don't recognise (including
 * every code, if the deployed service predates them).
 *
 * Root cause these describe: the four delivery-link fields are free text, so 44% of
 * tickets pointed at something that isn't a video file — a Dropbox folder (whose only
 * no-auth download form is a .zip), a Dropbox Replay page, or a Frame.io review URL. All
 * three used to surface as ffprobe's "moov atom not found".
 */
const RENDER_ERROR_MESSAGE: Record<string, (b: RenderErrorBody) => string> = {
  invalid_url: () => "That isn't a valid https:// link.",
  invalid_body: () => 'Frame extraction was called with a malformed request.',
  blocked_host: () => "That link points at a private or internal address and won't be fetched.",
  unsupported_dropbox_replay: () =>
    'That is a Dropbox Replay link — a review page, not the video file. Open it in Dropbox, then share the video file itself and paste that link.',
  unsupported_dropbox_folder: () =>
    'That Dropbox link is a folder — downloading it gives a .zip, not a video. Open the folder, right-click the final video, Copy link, and paste that.',
  unsupported_host: (b) =>
    `${b.detail ?? 'That host'} links can't be downloaded directly. Export the video and paste a direct Dropbox file link.`,
  unsupported_youtube: () =>
    "YouTube links can't be frame-extracted here — YouTube sources already get transcript-only enrichment.",
  dropbox_folder_unconfigured: () =>
    "That ticket links a Dropbox folder, and Dropbox folder access isn't set up on the render service yet. Paste a direct link to the video file instead.",
  dropbox_folder_unauthorized: () =>
    "We couldn't open that Dropbox folder — it may be restricted or the share may have expired. Paste a direct file link instead.",
  dropbox_folder_no_video: () =>
    "That Dropbox folder has no video file we can read. Paste a direct link to the final video instead.",
  dropbox_folder_video_too_large: (b) =>
    `The video in that Dropbox folder is over the 500MB limit for visual review${b.detail ? ` (${Math.round(Number(b.detail) / 1e6)}MB)` : ''}.`,
  source_empty: () => 'That link returned an empty file — the share may have expired or lost permission.',
  not_a_video: (b) => `That link returned ${b.detail ?? 'something that is not a video'}, not a video file.`,
  probe_failed: () =>
    "That link isn't a readable video — it may be corrupt or still uploading. Try again once the upload finishes.",
  // Since 2026-09-09 large sources are read in place (ffmpeg seeks over HTTP range
  // requests) instead of being staged, so size alone is no longer a limit — real
  // deliverables run 0.5-10GB. This code now only fires for a host that refuses ranged
  // reads, where the file would have to be staged whole in a RAM-backed tmpfs.
  source_too_large: () =>
    'That host does not support partial reads, so this video would have to be downloaded whole — it is too large for that. Paste a direct Dropbox file link instead.',
  download_http_error: (b) =>
    `The host refused the download${b.detail ? ` (HTTP ${b.detail})` : ''} — the link may have expired or require sign-in.`,
  download_truncated: () => 'The download ended early — worth another try.',
  extract_failed: () => "Frame extraction failed on this video. It's been logged for an admin.",
  internal: () => "Frame extraction hit an internal error. It's been logged for an admin.",
};

/** Codes where the fix is "give us a different link", so the UI offers the paste box. */
const NEEDS_LINK_CODES = new Set([
  'invalid_url',
  'blocked_host',
  'unsupported_dropbox_replay',
  'unsupported_dropbox_folder',
  'unsupported_host',
  'unsupported_youtube',
  'dropbox_folder_unconfigured',
  'dropbox_folder_unauthorized',
  'dropbox_folder_no_video',
  'source_empty',
  'not_a_video',
  'probe_failed',
  'download_http_error',
  // The fix is a different link (one on a range-capable host), so offer the paste box
  // rather than just reporting a dead end.
  'source_too_large',
]);

const MAX_RETRIES = 2;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Extract evenly-spaced frames from a video URL via render-service. `maxFrames` caps the
 *  auto-scaled budget render-service computes from the video's own duration; omit to use
 *  the default table. Best-effort caller contract: never throws, returns { ok: false }. */
export async function extractFrames(videoUrl: string, maxFrames?: number): Promise<ExtractFramesResult> {
  const base = process.env.RENDER_SERVICE_URL;
  if (!base) return { ok: false, error: 'RENDER_SERVICE_URL is not configured.' };

  const secret = process.env.RENDER_SERVICE_SECRET;
  if (!secret) return { ok: false, error: 'RENDER_SERVICE_SECRET is not configured.' };

  const url = `${base.replace(/\/$/, '')}/extract-frames`;
  let res: Response | null = null;
  let raw = '';

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${secret}` },
        body: JSON.stringify({ videoUrl, ...(maxFrames ? { maxFrames } : {}) }),
        // Frame extraction downloads a real video file + shells out to ffmpeg — give it
        // real time rather than the platform's short default fetch timeout.
        //
        // Raised 180s -> 240s on 2026-09-09. A frame seek is network-bound (measured 11.6s
        // wall for 0.5s of CPU), so a long master's run is dominated by how fast the origin
        // serves ~30 ranged reads: 131s for a 3.5GB/56min source locally. 180s left too
        // little margin for a slower origin day, and a spurious abort looks identical to a
        // real failure to the person waiting. Stays under Cloud Run's 300s request ceiling.
        signal: AbortSignal.timeout(240_000),
      });
    } catch (err) {
      return { ok: false, error: `Could not reach render-service: ${err instanceof Error ? err.message : String(err)}` };
    }

    raw = await res.text();
    const retryable = res.status === 429 || res.status === 502 || res.status === 503;
    if (!retryable || attempt === MAX_RETRIES) break;
    const after = Number(res.headers.get('retry-after'));
    const backoff = Number.isFinite(after) && after > 0 ? after * 1000 : 2 ** attempt * 1000;
    await sleep(Math.min(backoff, 15_000));
  }

  if (!res) return { ok: false, error: 'extract-frames: no response' };

  let body: RenderErrorBody | null = null;
  try {
    body = JSON.parse(raw) as RenderErrorBody;
  } catch {
    // Non-JSON (e.g. Cloud Run's own HTML 503 page) — fall through to the raw text.
  }

  if (!res.ok || body?.ok === false) {
    const code = body?.code;
    const message =
      (code ? RENDER_ERROR_MESSAGE[code]?.(body ?? {}) : undefined) ??
      body?.error ??
      `extract-frames failed (HTTP ${res.status}): ${raw.slice(0, 300)}`;
    return {
      ok: false,
      code,
      detail: body?.detail ?? null,
      error: message,
      needsLink: code ? NEEDS_LINK_CODES.has(code) : false,
    };
  }

  if (!body?.frames?.length) return { ok: false, error: 'extract-frames: could not parse response body' };
  return { ok: true, durationMs: body.durationMs, frames: body.frames };
}
