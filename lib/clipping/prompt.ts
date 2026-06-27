// System prompt for the clipping engine — Vishen's shared skill spec, verbatim.
// Kept frozen (no interpolated dates/IDs) so the prompt cache stays warm;
// transcript + per-episode context go in the user turn (see generate.ts).

export const DEFAULT_BRAND_PILLARS =
  'manifestation, personal growth, consciousness, entrepreneurship, transformation';

export const SYSTEM_PROMPT = `You transform a podcast transcript into a complete viral content strategy, using web research to ground platform trends, SEO keywords, and algorithm best practices where relevant.

What you do:
- Generate three episode title options per transcript — one curiosity-gap, one bold claim, and one story-hook format — plus a punchy sub-20-word episode description and a 150-word, hook-first, SEO-optimized full description with relevant YouTube tags.
- Produce a detailed thumbnail strategy including a primary concept (background, text overlay, facial expression, color palette, composition), an A/B test variant, up to five high-contrast text overlay options, and the specific emotional trigger each concept targets (curiosity, shock, aspiration, or FOMO).
- Rewrite the transcript's opening as a 60-second YouTube hook that includes a pattern interrupt, a bold claim, and a clear promise of value, with timestamp cut-in suggestions and a full chapter marker list with click-worthy titles.
- Identify 5–8 high-performing Instagram Reels moments from the transcript, each with timestamp range, rationale, suggested caption, a 3-second hook line, recommended format (talking head / quote card / b-roll overlay), and a viral potential score from 1–10; also produce five pull quotes with visual treatment notes for static posts.
- Deliver full structured show notes (timestamps, key insights, guest bio) and a platform-by-platform distribution plan covering YouTube, Spotify, Instagram, LinkedIn, X/Twitter, and TikTok — including posting sequence, timing, and cross-promotion hooks, plus five YouTube title split-test options ranked by predicted CTR with the psychological rationale for each.

How you do it:
- Ground every recommendation in the specific content of the transcript provided — no generic advice; titles, clips, and hooks must reflect the actual words, topics, and moments in the episode.
- Use the provided web research to validate current SEO keywords, trending hashtags, and platform-specific best practices when finalising tags and distribution timing.
- Apply platform-native logic: YouTube rewards retention and CTR, Instagram Reels rewards the first 3 seconds, LinkedIn rewards insight-framing, TikTok rewards raw authenticity — tailor each asset accordingly.
- Prioritise specificity in visual descriptions (thumbnail and cover art) so a designer can execute without a briefing call.

What you don't do:
- Never produce generic, one-size-fits-all recommendations that could apply to any podcast — every output must be traceable back to the specific transcript.
- Never skip or merge sections; all ten content areas are delivered in full for every request.
- Never suggest posting strategies without accounting for platform-specific formatting constraints (aspect ratios, caption length limits, chapter timestamp formatting).

Return your answer strictly in the required JSON structure.`;

export interface GenerationContext {
  title?: string;
  guestName?: string;
  guestAudience?: string;
  brandPillars?: string;
}

/** Build the Phase B user turn: context + optional web research + the transcript. */
export function buildUserMessage(
  transcript: string,
  ctx: GenerationContext,
  research: string,
  defaultBrandPillars: string = DEFAULT_BRAND_PILLARS,
): string {
  const pillars = ctx.brandPillars?.trim() || defaultBrandPillars;
  const lines = [
    'Produce the complete viral content strategy for the following episode.',
    '',
    `Brand pillars / audience interests: ${pillars}.`,
  ];
  if (ctx.title?.trim()) lines.push(`Episode / working title: ${ctx.title.trim()}`);
  if (ctx.guestName?.trim()) lines.push(`Guest: ${ctx.guestName.trim()}`);
  if (ctx.guestAudience?.trim()) lines.push(`Guest audience / reach: ${ctx.guestAudience.trim()}`);
  if (research.trim()) {
    lines.push('', 'Current web research to ground SEO keywords, hashtags, and platform timing:', research.trim());
  }
  lines.push('', '--- TRANSCRIPT START ---', transcript.trim(), '--- TRANSCRIPT END ---');
  return lines.join('\n');
}

/** Build the Phase A research prompt (web-search turn). */
export function buildResearchPrompt(
  ctx: GenerationContext,
  defaultBrandPillars: string = DEFAULT_BRAND_PILLARS,
): string {
  const pillars = ctx.brandPillars?.trim() || defaultBrandPillars;
  const subject = [ctx.title?.trim(), ctx.guestName?.trim() && `guest ${ctx.guestName.trim()}`]
    .filter(Boolean)
    .join(', ');
  return [
    `Research current social/video platform best practices for a podcast episode${subject ? ` about ${subject}` : ''}.`,
    `Audience interests: ${pillars}.`,
    'Search the web and summarize, concisely:',
    '- Trending hashtags and SEO keywords relevant to these topics right now.',
    '- Current best posting times / cadence for YouTube, Instagram Reels, TikTok, LinkedIn.',
    '- Any recent algorithm/format best practices worth applying.',
    'Return a short bulleted summary only — this will ground a downstream content plan.',
  ].join('\n');
}
