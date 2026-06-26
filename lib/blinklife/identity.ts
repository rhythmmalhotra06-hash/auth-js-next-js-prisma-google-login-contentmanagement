// Identity seam for BlinkLife — the one place that decides WHICH account a push
// targets. Today BlinkLife's MCP only writes to the token holder's own account
// (the create_task/update_task tools expose no assignedTo or project sharing), so
// everything lands in a single shared "Content Production" project under one token.
//
// When the BlinkLife team confirms per-user tokens or a team/assignment API (the
// open spike), fill in getToken()/targetProjectName() to route by employee — every
// caller already passes the employee through, so no other code changes.

export const PUSH_ENABLED = process.env.BLINKLIFE_ENABLED === 'true';

const DEFAULT_MCP_URL = 'https://api.blinklife.com/api/v1/mcp';

/** A minimal shape of the employee a push is "for" — the future routing key. */
export interface PushTarget {
  email?: string | null;
  name?: string | null;
}

export function mcpUrl(): string {
  return process.env.BLINKLIFE_MCP_URL || DEFAULT_MCP_URL;
}

/**
 * Bearer token for the account a push targets. Single shared token today;
 * `target` is accepted now so per-user routing is a one-line change later.
 */
export function getToken(_target?: PushTarget): string {
  const t = process.env.BLINKLIFE_TOKEN;
  if (!t) throw new Error('No BlinkLife token (set BLINKLIFE_TOKEN).');
  return t;
}

/** The project content tickets are mirrored into. Shared for everyone for now. */
export function targetProjectName(_target?: PushTarget): string {
  return process.env.BLINKLIFE_PROJECT_NAME || 'Content Production';
}

/** Absolute portal link for a ticket, embedded in task descriptions. */
export function ticketUrl(ticketId: string): string {
  const base = (process.env.APP_BASE_URL || '').replace(/\/$/, '');
  return base ? `${base}/tickets/${ticketId}` : `/tickets/${ticketId}`;
}
