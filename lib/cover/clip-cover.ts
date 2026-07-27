import type { ClipSuggestion } from '@/lib/media/repository';

// Build the Cover Generator deep-link for a clip. The generator reads these as
// prefill (see app/cover-generator/page.tsx). Hook ← the clip's nuclear hook
// title (falling back to its hook line); author ← the media source's author
// (falls back to "Vishen" in the generator when omitted). Keyword is left for
// the user to choose — there's no reliable single keyword on a clip.
export function coverHrefForClip(clip: ClipSuggestion, author?: string | null): string {
  const hook = (clip.name || clip.hookLine || '').trim();
  const params = new URLSearchParams();
  if (hook) params.set('hook', hook);
  if (author && author.trim()) params.set('author', author.trim());
  // `clip` enables save-back — the generator attaches the finished cover to this record.
  params.set('clip', clip.id);
  return `/cover-generator?${params.toString()}`;
}
