// Supadata transcript API adapter. Used as the primary auto-fetch path because
// it runs its own residential proxies + an AI fallback, so it works from the
// Cloud Run datacenter IP where YouTube blocks youtubei.js (see transcript.ts).
// Docs: https://docs.supadata.ai/get-transcript  (GET /v1/transcript, x-api-key)
import { TranscriptFetchError, normalizeTranscript } from './transcript';
import { secondsToLabel } from './timestamps';

const API_BASE = 'https://api.supadata.ai/v1';

export function isSupadataConfigured(): boolean {
  return !!process.env.SUPADATA_API_KEY?.trim();
}

/**
 * Join Supadata's `content` into a timestamped transcript. In segment mode (no
 * `text=true`) each item carries `offset`/`duration` in ms — preserved as a
 * `[M:SS] text` marker so clip timestamps can be grounded in the real video. If
 * the API still returns a plain string (some plans/modes), it passes through
 * un-timed and the segment index will simply be empty.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function contentToText(content: any): string {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((s: any) => {
        const text = (s?.text ?? '').trim();
        if (!text) return '';
        const ms = Number(s?.offset);
        return Number.isFinite(ms) ? `[${secondsToLabel(ms / 1000)}] ${text}` : text;
      })
      .filter(Boolean)
      .join('\n');
  }
  return '';
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Map a non-2xx Supadata response to a user-facing TranscriptFetchError. */
async function throwForStatus(res: Response): Promise<never> {
  let detail = '';
  try {
    const body = await res.json();
    detail = body?.error || body?.message || '';
  } catch {
    /* non-JSON body */
  }
  if (res.status === 402 || res.status === 429) {
    throw new TranscriptFetchError(
      'The transcript service is out of quota or rate-limited. Paste the transcript below or upload a .txt/.vtt/.srt instead.',
      'blocked',
    );
  }
  if (res.status === 404) {
    throw new TranscriptFetchError(
      'No transcript could be generated for this video. Paste the transcript below or upload a .txt/.vtt/.srt instead.',
      'no_captions',
    );
  }
  throw new TranscriptFetchError(`Transcript service error (${res.status})${detail ? `: ${detail}` : ''}`, 'unknown');
}

/**
 * Fetch a transcript via Supadata. Throws TranscriptFetchError on failure (incl.
 * when not configured, so callers can fall through to the youtubei.js path).
 * `mode=auto` uses native captions and falls back to AI generation when YouTube
 * has none — the case that fails from the datacenter IP.
 */
export async function fetchSupadataTranscript(url: string): Promise<string> {
  const key = process.env.SUPADATA_API_KEY?.trim();
  if (!key) throw new TranscriptFetchError('Transcript service not configured.', 'unknown');

  const headers = { 'x-api-key': key };
  // lang=en: prefer the English track (Vishen's content is English) — without it
  // Supadata may return an arbitrary available language. Falls back automatically
  // if en is unavailable. NOTE: we intentionally DON'T pass text=true — segment
  // mode returns per-line `offset`/`duration` we need to timestamp clips.
  const reqUrl = `${API_BASE}/transcript?url=${encodeURIComponent(url)}&mode=auto&lang=en`;
  const res = await fetch(reqUrl, { headers });
  if (!res.ok && res.status !== 202) await throwForStatus(res);

  const data = await res.json();

  // Sync result.
  if (data?.content !== undefined && !data?.jobId) {
    const text = normalizeTranscript(contentToText(data.content));
    if (text) return text;
    throw new TranscriptFetchError('The transcript came back empty.', 'no_captions');
  }

  // Async job (videos > ~20 min): poll until completed.
  const jobId: string | undefined = data?.jobId ?? data?.id;
  if (!jobId) throw new TranscriptFetchError('Unexpected transcript service response.', 'unknown');

  for (let attempt = 0; attempt < 20; attempt++) {
    await sleep(1500 * Math.min(attempt + 1, 4)); // 1.5s → cap 6s between polls
    const jr = await fetch(`${API_BASE}/transcript/${jobId}`, { headers });
    if (!jr.ok) await throwForStatus(jr);
    const job = await jr.json();
    if (job?.status === 'completed') {
      const text = normalizeTranscript(contentToText(job.content));
      if (text) return text;
      throw new TranscriptFetchError('The transcript came back empty.', 'no_captions');
    }
    if (job?.status === 'failed') {
      throw new TranscriptFetchError(
        `Transcript generation failed${job?.error ? `: ${job.error}` : ''}. Paste the transcript instead.`,
        'unknown',
      );
    }
  }
  throw new TranscriptFetchError('Transcript generation timed out. Paste the transcript instead.', 'unknown');
}
