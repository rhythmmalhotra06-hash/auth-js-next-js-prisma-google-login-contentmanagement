import { prisma } from '@/lib/prisma';
import { Prisma } from '@/app/generated/prisma/client';
import { getEmployeeForSession } from '@/lib/employee';
import { CLIP_MODEL } from '@/lib/clipping/anthropic';
import { generateStrategy } from '@/lib/clipping/generate';
import { normalizeTranscript } from '@/lib/clipping/transcript';
import { createMediaSource, updateMediaSource, createClipSuggestions } from '@/lib/media/repository';
import type { Strategy } from '@/lib/clipping/schema';

// Node runtime: the Anthropic SDK + youtubei.js need Node; generous duration for
// the web-search + 10-section generation (can run a couple of minutes).
export const runtime = 'nodejs';
export const maxDuration = 300;

const MIN_TRANSCRIPT_CHARS = 50;

/** Suggestion title (≤40-char ticket title is derived later, at conversion). */
function clipTitle(c: { hookLine?: string; caption?: string; rationale?: string }, i: number): string {
  const base = (c.hookLine || c.caption || c.rationale || `Clip ${i + 1}`).trim();
  return base.length > 90 ? `${base.slice(0, 89)}…` : base;
}

export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const transcript = normalizeTranscript(String(body.transcript ?? ''));
  if (transcript.length < MIN_TRANSCRIPT_CHARS) {
    return Response.json({ error: 'Transcript is too short or empty — paste a full transcript.' }, { status: 400 });
  }

  const ctx = {
    title: typeof body.title === 'string' ? body.title : undefined,
    guestName: typeof body.guestName === 'string' ? body.guestName : undefined,
    guestAudience: typeof body.guestAudience === 'string' ? body.guestAudience : undefined,
    brandPillars: typeof body.brandPillars === 'string' ? body.brandPillars : undefined,
  };
  const webSearch = body.webSearch === true;
  const sourceType = ['paste', 'file', 'youtube'].includes(String(body.sourceType)) ? String(body.sourceType) : 'paste';

  const employee = await getEmployeeForSession();

  const source = await prisma.contentSource.create({
    data: {
      title: ctx.title?.trim() || 'Untitled transcript',
      sourceType,
      sourceUrl: typeof body.sourceUrl === 'string' && body.sourceUrl.trim() ? body.sourceUrl.trim() : null,
      guestName: ctx.guestName?.trim() || null,
      guestAudience: ctx.guestAudience?.trim() || null,
      brandPillars: ctx.brandPillars?.trim() || null,
      transcript,
      createdById: employee?.id ?? null,
    },
  });

  const strategyRow = await prisma.clipStrategy.create({
    data: { contentSourceId: source.id, model: CLIP_MODEL, status: 'generating', usedWebSearch: false },
  });

  // Mirror the submission into the Airtable backend (📺 Media Sources), best-effort
  // so an Airtable hiccup never breaks the Postgres-backed response. The transcript
  // is captured up front so it lands even if generation fails.
  const sourceUrl = typeof body.sourceUrl === 'string' && body.sourceUrl.trim() ? body.sourceUrl.trim() : null;
  const audience = /^(cold|warm)$/i.test(ctx.guestAudience?.trim() ?? '')
    ? (ctx.guestAudience!.trim()[0].toUpperCase() + ctx.guestAudience!.trim().slice(1).toLowerCase())
    : null;
  let mediaId: string | null = null;
  try {
    const ms = await createMediaSource({
      url: sourceUrl,
      title: ctx.title?.trim() || 'Untitled transcript',
      platform: sourceType === 'youtube' ? 'YouTube' : 'Other',
      guestShow: ctx.guestName?.trim() || null,
      audience,
      submittedVia: 'Portal',
      submittedByRecId: employee?.airtableId ?? null,
      transcript,
      status: 'Transcribing',
    });
    if (ms.ok) mediaId = ms.data.id;
  } catch { /* best-effort */ }

  async function captureClips(strategy: Strategy, usedWebSearch: boolean) {
    if (!mediaId) return;
    try {
      await createClipSuggestions(mediaId, strategy.reelsClips);
      await updateMediaSource(mediaId, {
        status: 'Clips Suggested',
        usedWebSearch,
        clipsAddedDate: new Date().toISOString(),
        strategyJson: JSON.stringify(strategy).slice(0, 95000),
      });
    } catch { /* best-effort */ }
  }

  try {
    const { strategy, usedWebSearch } = await generateStrategy(transcript, ctx, { webSearch });

    await captureClips(strategy, usedWebSearch);

    await prisma.clipStrategy.update({
      where: { id: strategyRow.id },
      data: {
        status: 'complete',
        usedWebSearch,
        output: strategy as unknown as Prisma.InputJsonValue,
        clips: {
          create: strategy.reelsClips.map((c, i) => ({
            index: i,
            title: clipTitle(c, i),
            timestampStart: c.timestampStart,
            timestampEnd: c.timestampEnd,
            rationale: c.rationale,
            caption: c.caption,
            hookLine: c.hookLine,
            format: c.format,
            platform: 'instagram',
            viralityScore: c.viralityScore,
          })),
        },
      },
    });

    return Response.json({ strategyId: strategyRow.id });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Generation failed';
    await prisma.clipStrategy.update({ where: { id: strategyRow.id }, data: { status: 'error', error: message } });
    if (mediaId) {
      try { await updateMediaSource(mediaId, { status: 'Error', error: message }); } catch { /* best-effort */ }
    }
    // 200 with the id so the client can navigate to the detail page and show the error.
    return Response.json({ strategyId: strategyRow.id, error: message });
  }
}
