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

// Name → user-id map, built once from users.list. Lets us DM by name when we lack the
// users:read.email scope (users:read alone can list members, just not their emails).
const norm = (s: string): string => s.toLowerCase().trim().replace(/\s+/g, ' ');
let nameMapPromise: Promise<Map<string, string>> | null = null;

async function nameToUserId(): Promise<Map<string, string>> {
  if (nameMapPromise) return nameMapPromise;
  nameMapPromise = (async () => {
    const token = botToken();
    const map = new Map<string, string>();
    if (!token) return map;
    // Paginate: the workspace has >1000 members (mostly deactivated), so active users can
    // sit on later pages. Follow the cursor to the end (a handful of pages, well within limits).
    let cursor = '';
    for (let page = 0; page < 20; page++) {
      const qs = `limit=1000${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`;
      const res = await fetch(`${API}/users.list?${qs}`, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) break;
      const json = (await res.json()) as {
        ok: boolean;
        members?: { id?: string; deleted?: boolean; is_bot?: boolean; name?: string; real_name?: string; profile?: { display_name?: string; real_name?: string } }[];
        response_metadata?: { next_cursor?: string };
      };
      if (!json.ok) break;
      for (const m of json.members ?? []) {
        if (!m.id || m.deleted || m.is_bot) continue;
        // First writer wins per key; register the richer names first.
        for (const n of [m.real_name, m.profile?.real_name, m.profile?.display_name, m.name]) {
          if (n && n.trim() && !map.has(norm(n))) map.set(norm(n), m.id);
        }
      }
      cursor = json.response_metadata?.next_cursor ?? '';
      if (!cursor) break;
    }
    return map;
  })();
  return nameMapPromise;
}

/** Resolve a Slack user id by matching a display/real name (users:read scope). Null if no match. */
async function userIdByName(name: string): Promise<string | null> {
  if (!name || !name.trim()) return null;
  const map = await nameToUserId();
  return map.get(norm(name)) ?? null;
}

/**
 * DM a person, resolving them by email first (needs users:read.email) then by name (needs
 * only users:read). No-op (logged) if unresolved or Slack errors — never throws.
 */
export async function dmByPerson(
  person: { name?: string | null; email?: string | null },
  text: string,
): Promise<void> {
  try {
    let userId: string | null = null;
    if (person.email) userId = await userIdByEmail(person.email);
    if (!userId && person.name) userId = await userIdByName(person.name);
    if (!userId) return; // external / not in Slack / unmatched — skip silently
    await slackPost('chat.postMessage', { channel: userId, text, unfurl_links: false });
  } catch (e) {
    console.error('[notify] dmByPerson failed', e);
  }
}

/** DM a person by email. No-op (logged) if they can't be resolved or Slack errors. */
export async function dmByEmail(email: string | null | undefined, text: string): Promise<void> {
  return dmByPerson({ email }, text);
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
