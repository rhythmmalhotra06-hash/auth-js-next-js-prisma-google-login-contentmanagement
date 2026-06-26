// Transcript ingestion: normalize pasted/uploaded text and best-effort YouTube
// fetch. Node-runtime only (youtubei.js needs Node networking).

/** Thrown when a YouTube transcript can't be fetched; message is user-facing. */
export class TranscriptFetchError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TranscriptFetchError';
  }
}

const YT_FALLBACK_MSG =
  "Couldn't fetch captions for this video — it may have captions disabled, be age/region-restricted, or YouTube may be blocking automated access. Paste the transcript or upload a .txt/.vtt/.srt instead.";

/**
 * Normalize a raw transcript to plain spoken text. Strips WebVTT/SRT cue numbers,
 * timestamp lines, and the WEBVTT header; passes plain text through. Collapses
 * excess blank lines. Safe to run on any input (idempotent on plain text).
 */
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

/** Best-effort YouTube transcript fetch. Throws TranscriptFetchError on any failure. */
export async function fetchYouTubeTranscript(url: string): Promise<string> {
  const id = extractYouTubeId(url);
  if (!id) throw new TranscriptFetchError("That doesn't look like a valid YouTube URL.");

  try {
    const { Innertube } = await import('youtubei.js');
    const yt = await Innertube.create({ retrieve_player: false });
    const info = await yt.getInfo(id);
    const data = await info.getTranscript();
    // youtubei.js shape: transcript.content.body.initial_segments[].snippet.text
    const segments =
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (data as any)?.transcript?.content?.body?.initial_segments ?? [];
    const text = segments
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((s: any) => s?.snippet?.text ?? '')
      .filter(Boolean)
      .join(' ')
      .trim();
    if (!text) throw new TranscriptFetchError(YT_FALLBACK_MSG);
    return normalizeTranscript(text);
  } catch (e) {
    if (e instanceof TranscriptFetchError) throw e;
    throw new TranscriptFetchError(YT_FALLBACK_MSG);
  }
}
