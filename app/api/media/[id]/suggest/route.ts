import { getMediaSource, updateMediaSource, createClipSuggestions } from '@/lib/media/repository';
import { generateStrategy } from '@/lib/clipping/generate';
import { rememberFeedbackAsLearning, type RememberResult } from '@/lib/clipping/learn';
import { fetchYouTubeTranscript, normalizeTranscript, TranscriptFetchError } from '@/lib/clipping/transcript';
import { DEFAULT_CLIP_TYPE, isClipType, RULE_SCOPE_ALL, type RuleScope } from '@/lib/clipping/clip-types';
import { auth } from '@/lib/auth';

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
  const rawClipType = typeof body.clipType === 'string' ? body.clipType : undefined;
  const clipType = isClipType(rawClipType) ? rawClipType : DEFAULT_CLIP_TYPE;
  // Allow a pasted transcript as a fallback when YouTube auto-fetch is blocked.
  const pastedTranscript = typeof body.transcript === 'string' ? normalizeTranscript(body.transcript) : '';
  // Editor feedback steers this run; `remember` also persists it as a learning.
  const feedback = typeof body.feedback === 'string' ? body.feedback.trim() : '';
  const remember = body.remember === true && feedback.length > 0;
  const rememberScope: RuleScope = isClipType(body.rememberScope as string)
    ? (body.rememberScope as RuleScope)
    : body.rememberScope === RULE_SCOPE_ALL
      ? RULE_SCOPE_ALL
      : clipType;

  await updateMediaSource(id, { status: 'Transcribing', error: '' });

  try {
    // Prefer a transcript we already have so we never need a YouTube round-trip:
    // (a) pasted with this request, (b) captured on the source at submit, then
    // (c) fall back to a live fetch only when neither is present.
    let transcript = pastedTranscript;
    if (transcript.length < MIN_TRANSCRIPT_CHARS && source.transcript) {
      transcript = normalizeTranscript(source.transcript);
    }
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

    const { strategy, usedWebSearch } = await generateStrategy(transcript, ctx, { webSearch, clipType, feedback });

    const clipRes = await createClipSuggestions(id, strategy.reelsClips);
    if (!clipRes.ok) throw new Error(`Failed to write clips: ${clipRes.error.message}`);

    // Best-effort: persist the feedback as a durable learning if the editor asked.
    let learning: RememberResult | undefined;
    if (remember) {
      const session = await auth();
      learning = await rememberFeedbackAsLearning({
        feedback,
        clipType,
        scope: rememberScope,
        email: session?.user?.email ?? null,
        date: new Date().toISOString(),
      });
    }

    // NOTE: clips are NOT pushed to Vishen's base here. They stay in the portal as Proposed
    // suggestions until a human approves them (convertClipsToTickets), which is the only path
    // that mirrors them into Vishen's Clips table (tagged AI Suggested). See app/media/actions.ts.

    await updateMediaSource(id, {
      status: 'Clips Suggested',
      usedWebSearch,
      clipsAddedDate: new Date().toISOString(),
      transcript: transcript.slice(0, 95000),
      // Airtable long-text caches the full strategy for re-render / provenance.
      strategyJson: JSON.stringify(strategy).slice(0, 95000),
    });

    return Response.json({ ok: true, clips: clipRes.data.count, learning });
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
