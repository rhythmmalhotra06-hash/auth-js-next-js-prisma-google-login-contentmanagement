import { prisma } from '@/lib/prisma';
import { Prisma } from '@/app/generated/prisma/client';
import { getEmployeeForSession } from '@/lib/employee';
import { CLIP_MODEL } from '@/lib/clipping/anthropic';
import { generateStrategy } from '@/lib/clipping/generate';
import { normalizeTranscript } from '@/lib/clipping/transcript';

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

  try {
    const { strategy, usedWebSearch } = await generateStrategy(transcript, ctx, { webSearch });

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
    // 200 with the id so the client can navigate to the detail page and show the error.
    return Response.json({ strategyId: strategyRow.id, error: message });
  }
}
