// Slack notifications (E9.4) — outbound only, via the existing bot token. Every export
// is BEST-EFFORT: it swallows its own errors and returns void so a notification failure
// can never block the ticket write that triggered it. The app is IAP-gated, so this is
// the Web API (chat.postMessage / users.lookupByEmail), not inbound webhooks.

const API = 'https://slack.com/api';

function botToken(): string | null {
  return process.env.SLACK_BOT_TOKEN || null;
}

/** The #content-ready channel id; env override, else the configured default. */
export function contentReadyChannel(): string {
  return process.env.SLACK_CONTENT_READY_CHANNEL_ID || 'C0BDFM1SNDV';
}

async function slackPost(method: string, body: Record<string, unknown>): Promise<{ ok: boolean; data?: unknown }> {
  const token = botToken();
  if (!token) return { ok: false };
  const res = await fetch(`${API}/${method}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify(body),
  });
  if (!res.ok) return { ok: false };
  const json = (await res.json()) as { ok: boolean };
  return { ok: json.ok, data: json };
}

/** Resolve a Slack user id from an email (users:read.email scope). Null if not found. */
async function userIdByEmail(email: string): Promise<string | null> {
  const token = botToken();
  if (!token || !email) return null;
  const res = await fetch(`${API}/users.lookupByEmail?email=${encodeURIComponent(email)}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return null;
  const json = (await res.json()) as { ok: boolean; user?: { id?: string } };
  return json.ok && json.user?.id ? json.user.id : null;
}

/** DM a person by email. No-op (logged) if they can't be resolved or Slack errors. */
export async function dmByEmail(email: string | null | undefined, text: string): Promise<void> {
  try {
    if (!email) return;
    const userId = await userIdByEmail(email);
    if (!userId) return; // external / not in Slack — skip silently
    await slackPost('chat.postMessage', { channel: userId, text, unfurl_links: false });
  } catch (e) {
    console.error('[notify] dmByEmail failed', e);
  }
}

/** Post a message to a channel. Best-effort. */
export async function postToChannel(channel: string, text: string): Promise<void> {
  try {
    if (!channel) return;
    await slackPost('chat.postMessage', { channel, text, unfurl_links: false });
  } catch (e) {
    console.error('[notify] postToChannel failed', e);
  }
}
