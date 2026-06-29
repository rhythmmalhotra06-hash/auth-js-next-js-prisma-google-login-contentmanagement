import Anthropic from '@anthropic-ai/sdk';

// Singleton Anthropic client. Reads ANTHROPIC_API_KEY from the environment.
// Node-runtime only — never import this from edge code or middleware.

const globalForAnthropic = globalThis as unknown as { anthropic?: Anthropic };

export const anthropic =
  globalForAnthropic.anthropic ?? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

if (process.env.NODE_ENV !== 'production') globalForAnthropic.anthropic = anthropic;

export const CLIP_MODEL = 'claude-opus-4-8';

/**
 * Translate an Anthropic SDK error into a clear, user-facing sentence.
 * Returns null when `e` isn't a recognizable API error, so callers can fall
 * back to the raw message. The usage-limit case is a billing cap on the
 * workspace (HTTP 400, invalid_request_error) — distinct from a 429 rate limit.
 */
export function friendlyAnthropicError(e: unknown): string | null {
  if (!(e instanceof Anthropic.APIError)) return null;

  // The human-readable text lives in the parsed body for known errors; the
  // SDK's own `.message` is a "<status> <json>" string we'd rather not show.
  const body = (e as { error?: { error?: { message?: string } } }).error;
  const raw = body?.error?.message ?? '';

  if (/usage limit/i.test(raw)) {
    const reset = raw.match(/regain access on[^.]*/i)?.[0];
    return `AI generation is paused — the Anthropic workspace has hit its API usage limit${
      reset ? `. You will ${reset.trim()}` : ''
    }. An admin can raise the limit in the Anthropic Console.`;
  }

  switch (e.status) {
    case 401:
    case 403:
      return 'AI generation is misconfigured — the API key is missing or invalid. Contact an admin.';
    case 429:
      return 'AI generation is rate-limited right now — wait a moment and try again.';
    case 529:
      return 'The AI service is temporarily overloaded — try again in a minute.';
    default:
      if (e.status >= 500) return 'The AI service had a server error — try again shortly.';
      return null;
  }
}
