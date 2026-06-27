import { getMediaSource, updateMediaSource, createClipSuggestions } from '@/lib/media/repository';
import { generateStrategy } from '@/lib/clipping/generate';
import { fetchYouTubeTranscript, normalizeTranscript, TranscriptFetchError } from '@/lib/clipping/transcript';

// Node runtime: Anthropic SDK + youtubei.js need Node; long duration for
// transcript fetch + web search + 10-section generation.
export const runtime = 'nodejs';
export const maxDuration = 300;

const MIN_TRANSCRIPT_CHARS = 50;

/**
 * POST /api/media/:id/suggest — the "Suggest clips" button.
 * Fetches the YouTube transcript for the Media Source, generates the viral
 * strategy, writes Clip Suggestion rows + the full strategy JSON back to Airtable.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const srcRes = await getMediaSource(id);
  if (!srcRes.ok) return Response.json({ error: `Media source not found: ${srcRes.error.message}` }, { status: 404 });
  const source = srcRes.data;

  if (!source.sourceUrl) {
    return Response.json({ error: 'This media source has no URL.' }, { status: 400 });
  }

  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    /* no body is fine */
  }
  const webSearch = body.webSearch === true;
  // Allow a pasted transcript as a fallback when YouTube auto-fetch is blocked.
  const pastedTranscript = typeof body.transcript === 'string' ? normalizeTranscript(body.transcript) : '';

  await updateMediaSource(id, { status: 'Transcribing', error: '' });

  try {
    let transcript = pastedTranscript;
    if (transcript.length < MIN_TRANSCRIPT_CHARS) {
      transcript = normalizeTranscript(await fetchYouTubeTranscript(source.sourceUrl));
    }
    if (transcript.length < MIN_TRANSCRIPT_CHARS) {
      throw new Error('Transcript is too short or empty — paste the transcript instead.');
    }

    const ctx = {
      title: source.title ?? undefined,
      guestName: source.guestShow ?? undefined,
      guestAudience: source.audience ?? undefined,
    };

    const { strategy, usedWebSearch } = await generateStrategy(transcript, ctx, { webSearch });

    const clipRes = await createClipSuggestions(id, strategy.reelsClips);
    if (!clipRes.ok) throw new Error(`Failed to write clips: ${clipRes.error.message}`);

    await updateMediaSource(id, {
      status: 'Clips Suggested',
      usedWebSearch,
      clipsAddedDate: new Date().toISOString(),
      // Airtable long-text caches the full strategy for re-render / provenance.
      strategyJson: JSON.stringify(strategy).slice(0, 95000),
    });

    return Response.json({ ok: true, clips: clipRes.data.count });
  } catch (e) {
    const message =
      e instanceof TranscriptFetchError
        ? e.message
        : e instanceof Error
          ? e.message
          : 'Generation failed';
    await updateMediaSource(id, { status: 'Error', error: message });
    return Response.json({ ok: false, error: message }, { status: 200 });
  }
}
