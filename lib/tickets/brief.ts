// Normalize free-text fields migrated from Jira/Airtable. Briefs carry markup
// noise: smart-links [<url|url|smart-link>], escaped asterisks (\*), and
// [~accountid:…] mentions. This strips that to clean, readable text.
// Idempotent — safe to run more than once (data layer + presentation).
export function cleanBrief(raw: string | null | undefined): string | null {
  if (raw == null) return null;
  const out = String(raw)
    .replace(/\[~accountid:[^\]]+\]/g, '@someone')          // Jira user mentions
    .replace(/\[<\s*([^|>\s]+)[^\]]*?smart-link\s*>\]/g, '$1') // [<url|url|smart-link>] → first url
    .replace(/\[([^\]|]+)\|[^\]]*?\|smart-link\]/g, '$2')    // [text|url|smart-link] → url
    .replace(/\\([*_|>~`#-])/g, '$1')                        // unescape \* \| etc.
    .replace(/[ \t]{3,}/g, '  ')
    .trim();
  return out || null;
}
