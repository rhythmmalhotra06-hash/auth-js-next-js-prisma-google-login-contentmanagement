// Notification triggers (E9.4) — orchestrate the "asset ready" and "assigned" Slack
// messages. Server-only; all best-effort (never throw) so they can't block the ticket
// write that fired them. Emails are resolved from the Employees table; dedupe for the
// asset-ready notification uses the "Asset Ready Notified" checkbox.

import { TICKETS, EMPLOYEES } from '@/lib/airtable/field-map';
import { getRecord, updateRecord } from '@/lib/airtable/rest';
import { contentReadyChannel, dmByEmail, postToChannel } from '@/lib/notify/slack';

const F = TICKETS.fields;
const L = TICKETS.links;

const str = (v: unknown): string | null => {
  if (v == null) return null;
  if (typeof v === 'string') return v || null;
  if (typeof v === 'object' && 'name' in (v as object)) return String((v as { name: unknown }).name);
  return String(v);
};
const firstLinkedId = (v: unknown): string | null => {
  if (!Array.isArray(v) || v.length === 0) return null;
  const x = v[0];
  return typeof x === 'string' ? x : x && typeof x === 'object' && 'id' in x ? String((x as { id: unknown }).id) : null;
};

function ticketUrl(id: string): string {
  const base = (process.env.NEXT_PUBLIC_APP_URL || process.env.AUTH_URL || '').replace(/\/$/, '');
  return base ? `${base}/tickets/${id}` : `/tickets/${id}`;
}

async function employeeContact(recId: string): Promise<{ name: string | null; email: string | null }> {
  const res = await getRecord(EMPLOYEES.baseId, EMPLOYEES.tableId, recId);
  if (!res.ok) return { name: null, email: null };
  const f = res.data.fields as Record<string, unknown>;
  return { name: str(f[EMPLOYEES.fields.name]), email: str(f[EMPLOYEES.fields.email]) };
}

/**
 * Fire the asset-ready notifications (requester DM + #content-ready post) the first time
 * a final asset link is attached. Guarded by the "Asset Ready Notified" checkbox so a
 * re-save can't re-notify. Best-effort.
 */
export async function maybeNotifyAssetReady(ticketId: string, assetUrl: string): Promise<void> {
  try {
    const res = await getRecord(TICKETS.baseId, TICKETS.tableId, ticketId);
    if (!res.ok) return;
    const f = res.data.fields as Record<string, unknown>;
    if (f[F.assetReadyNotified] === true) return; // already notified

    const title = str(f[F.name]) ?? 'Asset';
    const url = ticketUrl(ticketId);
    const link = assetUrl?.trim() || url;
    const reqId = firstLinkedId(f[L.requestedBy]);
    const requester = reqId ? await employeeContact(reqId) : { name: null, email: null };

    await dmByEmail(requester.email, `✅ Your asset is ready: *${title}*\nAsset: ${link}\nTicket: ${url}`);
    await postToChannel(
      contentReadyChannel(),
      `✅ Asset ready: *${title}*${requester.name ? ` (for ${requester.name})` : ''}\n${link}\n<${url}|Open ticket>`,
    );

    await updateRecord(TICKETS.baseId, TICKETS.tableId, ticketId, { [F.assetReadyNotified]: true });
  } catch (e) {
    console.error('[notify] maybeNotifyAssetReady failed', e);
  }
}

/** DM an editor that a ticket has been assigned to them (manual assign or auto-assign). Best-effort. */
export async function notifyAssignment(ticketId: string, editorRecId: string): Promise<void> {
  try {
    if (!editorRecId) return;
    const [tRes, editor] = await Promise.all([
      getRecord(TICKETS.baseId, TICKETS.tableId, ticketId),
      employeeContact(editorRecId),
    ]);
    const title = tRes.ok ? str((tRes.data.fields as Record<string, unknown>)[F.name]) ?? 'a ticket' : 'a ticket';
    await dmByEmail(editor.email, `🎬 You've been assigned: *${title}*\nTicket: ${ticketUrl(ticketId)}`);
  } catch (e) {
    console.error('[notify] notifyAssignment failed', e);
  }
}
