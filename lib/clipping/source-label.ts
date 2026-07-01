import { anthropic } from '@/lib/clipping/anthropic';

// Small, cheap generation: a human "source title" for a talk — the speaker/author
// plus what it's about — so all clips from the same video group under one readable
// label (instead of "youtube.com"). Best-effort: any failure falls back to the
// caller's provided title, then to an empty string.

const LABEL_MODEL = 'claude-haiku-4-5-20251001';

function clean(s: string): string {
  return s.replace(/^["'\s]+|["'\s]+$/g, '').replace(/\s+/g, ' ').slice(0, 90).trim();
}

/**
 * @param transcript  the source transcript (we only need a slice)
 * @param providedTitle  an optional user-entered title to prefer / fall back to
 */
export async function generateClipSourceLabel(transcript: string, providedTitle?: string): Promise<string> {
  const fallback = clean(providedTitle ?? '');
  const excerpt = transcript.slice(0, 6000);
  if (excerpt.trim().length < 50) return fallback;

  try {
    const resp = await anthropic.messages.create({
      model: LABEL_MODEL,
      max_tokens: 40,
      system:
        'You label source videos for a social clip library. Given a transcript excerpt, reply with ONE short line only: the main speaker/author\'s name, an em dash (—), then a 3–6 word topic. Example: "Vishen Lakhiani — Overcoming camera fear". If the speaker is not identifiable, reply with just the topic (no dash). No quotes, no preamble, no trailing punctuation.',
      messages: [{ role: 'user', content: `Transcript excerpt:\n\n${excerpt}` }],
    });
    const text = resp.content.find((b) => b.type === 'text') as { text: string } | undefined;
    const label = clean(text?.text ?? '');
    return label || fallback;
  } catch {
    return fallback;
  }
}
