import { requireSocialAccess } from '@/lib/social/guard';
import { createSocialSuggestions } from '@/lib/social/repository';
import { generateStrategy } from '@/lib/clipping/generate';
import { generateClipSourceLabel } from '@/lib/clipping/source-label';
import { fetchYouTubeTranscript, normalizeTranscript, TranscriptFetchError } from '@/lib/clipping/transcript';
import { DEFAULT_CLIP_TYPE, isClipType } from '@/lib/clipping/clip-types';

// Node runtime: Anthropic SDK + youtubei.js need Node; long duration for transcript
// fetch + web search + generation. Mirrors app/api/media/[id]/suggest/route.ts.
export const runtime = 'nodejs';
export const maxDuration = 300;

const MIN_TRANSCRIPT_CHARS = 50;

/**
 * POST /api/social/suggest — the Marketing "Generate clip suggestions" action.
 * Body: { url, title?, transcript?, webSearch?, clipType? }. Fetches the transcript,
 * generates the clip strategy, and writes one "1: Proposal" row per clip into 📣 Social
 * (Content & Comms base). Propose-only — no tickets are created here.
 */
export async function POST(req: Request) {
  await requireSocialAccess();

  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    /* no body is fine */
  }

  const url = typeof body.url === 'string' ? body.url.trim() : '';
  if (!url) return Response.json({ ok: false, error: 'A media URL is required.' }, { status: 400 });

  const title = typeof body.title === 'string' ? body.title.trim() : '';
  const audience = typeof body.audience === 'string' ? body.audience.trim() : '';
  const webSearch = body.webSearch === true;
  const rawClipType = typeof body.clipType === 'string' ? body.clipType : undefined;
  const clipType = isClipType(rawClipType) ? rawClipType : DEFAULT_CLIP_TYPE;
  const pastedTranscript = typeof body.transcript === 'string' ? normalizeTranscript(body.transcript) : '';

  try {
    let transcript = pastedTranscript;
    if (transcript.length < MIN_TRANSCRIPT_CHARS) {
      transcript = normalizeTranscript(await fetchYouTubeTranscript(url));
    }
    if (transcript.length < MIN_TRANSCRIPT_CHARS) {
      throw new Error('Transcript is too short or empty — paste the transcript instead.');
    }

    const ctx = {
      title: title || undefined,
      guestAudience: audience || undefined,
    };

    const { strategy } = await generateStrategy(transcript, ctx, { webSearch, clipType });

    // A readable "author — topic" label so all clips from this talk group together
    // (falls back to the user-entered title, then the raw link).
    const sourceTitle = await generateClipSourceLabel(transcript, title);

    const res = await createSocialSuggestions(url, sourceTitle, strategy.reelsClips);
    if (!res.ok) throw new Error(`Failed to write suggestions: ${res.error.message}`);

    return Response.json({ ok: true, count: res.data.count });
  } catch (e) {
    const message =
      e instanceof TranscriptFetchError ? e.message : e instanceof Error ? e.message : 'Generation failed';
    return Response.json({ ok: false, error: message }, { status: 200 });
  }
}
