// Media title lookup via the provider's public oEmbed endpoint.
//
// Media Source titles are *inherited*, never fetched: the auto-discover route uses
// the uploader's title and the Slack scanner uses the link text. A URL pasted by
// hand carries neither, so the row lands with title=null and the portal renders a
// bare link (and generation loses the title as context — see the GenerationContext
// passed in app/api/media/[id]/suggest/route.ts).
//
// oEmbed closes that gap with one unauthenticated GET — no API key, no quota.
// Best-effort by design: every failure path returns null and the caller proceeds
// untitled, exactly as it does today.

interface OEmbedProvider {
  /** Matched against URL.hostname, so it covers www./m. subdomains. */
  readonly match: RegExp;
  readonly endpoint: string;
}

const PROVIDERS: readonly OEmbedProvider[] = [
  { match: /(?:^|\.)youtube\.com$/i, endpoint: 'https://www.youtube.com/oembed' },
  { match: /(?:^|\.)youtu\.be$/i, endpoint: 'https://www.youtube.com/oembed' },
  { match: /(?:^|\.)vimeo\.com$/i, endpoint: 'https://vimeo.com/api/oembed.json' },
];

/** Airtable's Title is a singleLineText; keep it comfortably inside a sane bound. */
const MAX_TITLE_CHARS = 250;
const TIMEOUT_MS = 5_000;

/**
 * Resolve a human-readable title for a media URL, or null when unavailable.
 * Never throws — a lookup failure must not block creating the media source.
 */
export async function fetchOEmbedTitle(url: string): Promise<string | null> {
  let hostname: string;
  try {
    hostname = new URL(url).hostname;
  } catch {
    return null; // not a URL we can parse — nothing to look up
  }

  const provider = PROVIDERS.find((p) => p.match.test(hostname));
  if (!provider) return null;

  // AbortSignal.timeout isn't available on every runtime we deploy to; do it manually.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(
      `${provider.endpoint}?format=json&url=${encodeURIComponent(url)}`,
      { signal: controller.signal },
    );
    // 401/403 on private or age-gated videos, 404 on deleted ones — all expected.
    if (!res.ok) return null;

    const body: unknown = await res.json();
    const title = (body as { title?: unknown })?.title;
    if (typeof title !== 'string') return null;

    const trimmed = title.trim();
    return trimmed ? trimmed.slice(0, MAX_TITLE_CHARS) : null;
  } catch {
    return null; // timeout, DNS, malformed JSON — all non-fatal
  } finally {
    clearTimeout(timer);
  }
}
