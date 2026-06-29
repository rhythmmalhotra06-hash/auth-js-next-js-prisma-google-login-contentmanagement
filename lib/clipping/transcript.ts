// Transcript ingestion: normalize pasted/uploaded text and best-effort YouTube
// fetch. Node-runtime only (youtubei.js needs Node networking).

/** Why a YouTube transcript fetch failed — drives the user-facing copy. */
export type TranscriptFailReason = 'blocked' | 'no_captions' | 'unavailable' | 'invalid_url' | 'unknown';

/** Thrown when a YouTube transcript can't be fetched; message is user-facing. */
export class TranscriptFetchError extends Error {
  reason: TranscriptFailReason;
  constructor(message: string, reason: TranscriptFailReason = 'unknown') {
    super(message);
    this.name = 'TranscriptFetchError';
    this.reason = reason;
  }
}

const YT_FALLBACK_MSG =
  "Couldn't fetch captions for this video — it may have captions disabled, be age/region-restricted, or YouTube may be blocking automated access. Paste the transcript or upload a .txt/.vtt/.srt instead.";

/** User-facing copy per failure reason. */
const REASON_MSG: Record<TranscriptFailReason, string> = {
  blocked:
    'YouTube is blocking automated caption access from this server (bot check). Paste the transcript below — or upload a .txt/.vtt/.srt — and we’ll use that instead.',
  no_captions:
    'This video has no captions available (captions disabled, or none generated yet). Paste the transcript below or upload a .txt/.vtt/.srt instead.',
  unavailable:
    'This video is unavailable (private, removed, or region/age-restricted). Paste the transcript below or upload a .txt/.vtt/.srt instead.',
  invalid_url: "That doesn't look like a valid YouTube URL.",
  unknown: YT_FALLBACK_MSG,
};

/** Classify a raw error from youtubei.js into a failure reason. */
function classifyError(e: unknown): TranscriptFailReason {
  const msg = (e instanceof Error ? e.message : String(e ?? '')).toLowerCase();
  if (/sign in to confirm|not a bot|429|too many requests|consent|captcha|forbidden|403/.test(msg)) return 'blocked';
  if (/unavailable|private|removed|age|region|login required|this video is not available/.test(msg)) return 'unavailable';
  if (/transcript|caption|no transcript|disabled/.test(msg)) return 'no_captions';
  return 'unknown';
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Normalize a raw transcript to plain spoken text. Strips WebVTT/SRT cue numbers,
 * timestamp lines, and the WEBVTT header; passes plain text through. Collapses
 * excess blank lines. Safe to run on any input (idempotent on plain text).
 */
/**
 * Best-effort verbatim excerpt for a clip's editor brief (E9.1). The stored transcript
 * is normalized plain text (timestamps stripped), so we can't slice by mm:ss. Instead
 * we anchor on the clip's hook line (a near-verbatim quote): find it in the transcript
 * and return a window of surrounding spoken text. If the hook can't be located, fall
 * back to the opening window and flag it `approximate` so the brief can warn the editor.
 * Returns null when there's no usable transcript.
 */
export function sliceTranscriptForClip(
  transcript: string | null | undefined,
  clip: { hookLine?: string | null },
  windowChars = 1200,
): { text: string; approximate: boolean } | null {
  const text = transcript?.trim();
  if (!text || text.length < 50) return null;

  const hook = clip.hookLine?.trim();
  if (hook) {
    // Hooks are often lightly edited — match on the first several words.
    const anchor = hook.split(/\s+/).slice(0, 6).join(' ');
    if (anchor.length >= 8) {
      const idx = text.toLowerCase().indexOf(anchor.toLowerCase());
      if (idx >= 0) {
        const from = Math.max(0, idx - Math.floor(windowChars / 4));
        const to = Math.min(text.length, idx + windowChars);
        let slice = text.slice(from, to).trim();
        if (from > 0) slice = `…${slice}`;
        if (to < text.length) slice = `${slice}…`;
        return { text: slice, approximate: false };
      }
    }
  }

  // No anchor — opening window, flagged so the editor verifies against the source.
  const head = text.slice(0, windowChars).trim();
  return { text: text.length > windowChars ? `${head}…` : head, approximate: true };
}

export function normalizeTranscript(raw: string): string {
  if (!raw) return '';
  const lines = raw.replace(/\r\n/g, '\n').split('\n');
  const out: string[] = [];

  const tsLine = /^\s*\d{1,2}:\d{2}(:\d{2})?[.,]\d{3}\s*-->\s*\d{1,2}:\d{2}(:\d{2})?[.,]\d{3}/;
  const cueNumber = /^\s*\d+\s*$/;

  for (let line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      if (out.length && out[out.length - 1] !== '') out.push('');
      continue;
    }
    if (/^WEBVTT/i.test(trimmed)) continue;
    if (/^(NOTE|STYLE|REGION)\b/.test(trimmed)) continue;
    if (tsLine.test(trimmed)) continue;
    if (cueNumber.test(trimmed)) continue;
    // Strip inline VTT tags like <00:00:01.000> and <c>...</c>
    line = trimmed.replace(/<[^>]+>/g, '').trim();
    if (line) out.push(line);
  }

  return out.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

/** Extract a video id from common YouTube URL shapes. Returns null if none. */
export function extractYouTubeId(url: string): string | null {
  try {
    const u = new URL(url.trim());
    const host = u.hostname.replace(/^www\./, '');
    if (host === 'youtu.be') return u.pathname.slice(1).split('/')[0] || null;
    if (host.endsWith('youtube.com')) {
      if (u.searchParams.get('v')) return u.searchParams.get('v');
      const parts = u.pathname.split('/').filter(Boolean); // /shorts/<id>, /embed/<id>, /live/<id>
      if (['shorts', 'embed', 'live', 'v'].includes(parts[0])) return parts[1] || null;
    }
    return null;
  } catch {
    return null;
  }
}

// Innertube clients tried in order. WEB is the most bot-checked from datacenter
// IPs (Cloud Run); ANDROID/iOS/TV are often served when WEB is blocked and need
// no PoToken. NOTE: a residential proxy or BotGuard PoToken would raise the
// success rate further but adds heavy deps — the upfront-transcript path
// (paste alongside the link) is the dependable safety net instead.
const YT_CLIENTS = ['ANDROID', 'IOS', 'WEB', 'TV'] as const;

/** Pull transcript text from a getTranscript() response (initial_segments shape). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function segmentsToText(data: any): string {
  const segments = data?.transcript?.content?.body?.initial_segments ?? [];
  return segments
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .map((s: any) => s?.snippet?.text ?? '')
    .filter(Boolean)
    .join(' ')
    .trim();
}

/** Decode the handful of XML/HTML entities timedtext uses. */
function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));
}

/**
 * Parse YouTube timedtext XML (srv1 `<text>` / srv3 `<p>` cues) into plain text.
 * This is the format caption-track base_urls actually return — `getTranscript()`
 * is currently broken (HTTP 400) in youtubei.js, so this is the primary path.
 */
function parseTimedText(xml: string): string {
  const blocks = xml.match(/<(?:p|text)\b[^>]*>([\s\S]*?)<\/(?:p|text)>/g) ?? [];
  return blocks
    .map((b) => decodeEntities(b.replace(/<[^>]+>/g, '')).replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Fetch a caption track's timedtext and turn it into plain spoken text. */
async function fetchCaptionTrack(baseUrl: string): Promise<string> {
  const res = await fetch(baseUrl);
  if (!res.ok) return '';
  const body = await res.text();
  // base_urls return timedtext XML (the fmt param is ignored); parse that.
  // Tolerate a VTT/SRT body too in case YouTube ever serves one.
  return body.trimStart().startsWith('<') ? parseTimedText(body) : normalizeTranscript(body);
}

/**
 * Best-effort YouTube transcript fetch. Tries several Innertube clients, then a
 * direct caption-track fetch, with light retries. Throws TranscriptFetchError
 * (carrying a classified `reason`) on failure so callers can show honest copy.
 */
export async function fetchYouTubeTranscript(url: string): Promise<string> {
  const id = extractYouTubeId(url);
  if (!id) throw new TranscriptFetchError(REASON_MSG.invalid_url, 'invalid_url');

  // Primary path when configured: Supadata runs its own proxies + AI fallback, so
  // it works from the Cloud Run datacenter IP where YouTube blocks youtubei.js.
  // On any failure we fall through to the best-effort direct fetch below.
  const { isSupadataConfigured, fetchSupadataTranscript } = await import('./supadata');
  if (isSupadataConfigured()) {
    try {
      return await fetchSupadataTranscript(url);
    } catch {
      /* fall through to youtubei.js */
    }
  }

  const { Innertube } = await import('youtubei.js');
  let sawCaptionTracks = false;
  let lastReason: TranscriptFailReason = 'unknown';

  for (const client of YT_CLIENTS) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const yt = await Innertube.create();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const info = await yt.getInfo(id, { client } as any);

        // Primary: caption-track timedtext (reliable). getTranscript() currently
        // 400s in youtubei.js, so the player's caption tracks are the real source.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const tracks = (info as any)?.captions?.caption_tracks ?? [];
        if (tracks.length) {
          sawCaptionTracks = true;
          // Prefer a manual (non-asr) English track, else the first.
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const pick = tracks.find((t: any) => t.kind !== 'asr' && /^en/i.test(t.language_code)) ?? tracks[0];
          const text = await fetchCaptionTrack(pick.base_url);
          if (text) return text;
        }

        // Secondary: structured transcript endpoint (cheap to try; works if/when
        // youtubei.js fixes get_transcript).
        try {
          const text = segmentsToText(await info.getTranscript());
          if (text) return normalizeTranscript(text);
        } catch (e) {
          lastReason = classifyError(e);
        }
      } catch (e) {
        lastReason = classifyError(e);
        if (lastReason === 'blocked' || lastReason === 'unknown') {
          await sleep(300 * (attempt + 1)); // brief backoff, then retry this client
          continue;
        }
      }
      break; // non-retryable for this client → move to next client
    }
  }

  // No client yielded text. If we saw caption tracks but couldn't read them it's
  // most likely a block; if we never saw any, the video genuinely has no captions.
  const reason: TranscriptFailReason = sawCaptionTracks
    ? lastReason === 'unknown'
      ? 'blocked'
      : lastReason
    : lastReason === 'unknown'
      ? 'no_captions'
      : lastReason;
  throw new TranscriptFetchError(REASON_MSG[reason], reason);
}
