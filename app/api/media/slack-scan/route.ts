import { fetchChannelYouTubeLinks } from '@/lib/media/slack';
import { existingSourceUrls, createMediaSource } from '@/lib/media/repository';

// Node runtime: outbound fetch to Slack + Airtable writes.
export const runtime = 'nodejs';
export const maxDuration = 120;

/**
 * Slack intake (Phase 2) — scan a designated channel for YouTube links shared by the
 * team and add them to the 📺 Media Sources inbox (Status "New", Submitted Via
 * "Slack"), deduped on Source URL. Adds rows only; a human still clicks "Suggest
 * clips". Outbound-only, so it's unaffected by the inbound IAP gate.
 *
 * Same auth pattern as /api/media/discover: Google OIDC (IAP) + x-discover-secret.
 * Configure: SLACK_BOT_TOKEN (scopes channels:history/groups:history, bot in the
 * channel), SLACK_MEDIA_CHANNEL_ID, DISCOVER_SHARED_SECRET.
 */
export async function POST(req: Request) {
  const secret = process.env.DISCOVER_SHARED_SECRET;
  if (secret) {
    const provided = req.headers.get('x-discover-secret');
    if (provided !== secret) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const channelId = process.env.SLACK_MEDIA_CHANNEL_ID;
  if (!process.env.SLACK_BOT_TOKEN || !channelId) {
    return Response.json({ error: 'Slack intake not configured (SLACK_BOT_TOKEN / SLACK_MEDIA_CHANNEL_ID).' }, { status: 501 });
  }

  let links;
  try {
    links = await fetchChannelYouTubeLinks(channelId);
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : 'Slack fetch failed' }, { status: 502 });
  }

  const seenRes = await existingSourceUrls();
  if (!seenRes.ok) return Response.json({ error: seenRes.error.message }, { status: 502 });
  const seen = seenRes.data;

  const added: string[] = [];
  const failed: { url: string; error: string }[] = [];

  for (const link of links) {
    if (seen.has(link.url)) continue;
    const res = await createMediaSource({
      url: link.url,
      title: link.text || null,
      platform: 'YouTube',
      submittedVia: 'Slack',
    });
    if (res.ok) added.push(link.url);
    else failed.push({ url: link.url, error: res.error.message });
  }

  return Response.json({ ok: failed.length === 0, scanned: links.length, added: added.length, failed });
}

export const GET = POST;
