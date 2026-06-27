// Slack intake (Phase 2) — OUTBOUND read of a designated channel. The app is
// IAP-gated, so an inbound Slack webhook/slash-command would be blocked; instead a
// scheduled scan reads the channel via the Web API and harvests YouTube links.
// Needs a bot token (scopes: channels:history / groups:history) added to the channel.

import { parseVideoId, watchUrl } from '@/lib/media/youtube';

const API = 'https://slack.com/api';

export interface SlackLink {
  url: string; // normalized https://www.youtube.com/watch?v=ID
  text: string; // the surrounding message text (becomes the title fallback)
  ts: string; // Slack message timestamp
}

function botToken(): string {
  const t = process.env.SLACK_BOT_TOKEN;
  if (!t) throw new Error('SLACK_BOT_TOKEN is not set.');
  return t;
}

// Slack renders links as <url> or <url|label>; also catch bare URLs.
const URL_IN_TEXT = /https?:\/\/[^\s|>]+/g;

/**
 * Read recent messages from a channel and return de-duplicated YouTube links found
 * in them (most recent first). `limit` caps messages scanned (Slack max 1000/page;
 * one page is plenty for a frequent scan).
 */
export async function fetchChannelYouTubeLinks(channelId: string, limit = 100): Promise<SlackLink[]> {
  const url = `${API}/conversations.history?channel=${encodeURIComponent(channelId)}&limit=${Math.min(limit, 1000)}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${botToken()}` } });
  if (!res.ok) throw new Error(`Slack conversations.history HTTP ${res.status}: ${await res.text()}`);
  const json = (await res.json()) as { ok: boolean; error?: string; messages?: { text?: string; ts?: string }[] };
  if (!json.ok) throw new Error(`Slack API error: ${json.error ?? 'unknown'}`);

  const seen = new Set<string>();
  const out: SlackLink[] = [];
  for (const m of json.messages ?? []) {
    const text = m.text ?? '';
    for (const raw of text.match(URL_IN_TEXT) ?? []) {
      const id = parseVideoId(raw);
      if (!id) continue;
      const norm = watchUrl(id);
      if (seen.has(norm)) continue;
      seen.add(norm);
      out.push({ url: norm, text: text.replace(URL_IN_TEXT, '').trim().slice(0, 200), ts: m.ts ?? '' });
    }
  }
  return out;
}
