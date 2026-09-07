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
  error?: string;
}

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
        signal: AbortSignal.timeout(180_000),
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
  if (!res.ok) return { ok: false, error: `extract-frames failed (HTTP ${res.status}): ${raw.slice(0, 300)}` };

  try {
    const parsed = JSON.parse(raw) as ExtractFramesResult;
    if (!parsed.ok) return { ok: false, error: parsed.error ?? 'extract-frames returned ok:false' };
    return parsed;
  } catch {
    return { ok: false, error: 'extract-frames: could not parse response body' };
  }
}
