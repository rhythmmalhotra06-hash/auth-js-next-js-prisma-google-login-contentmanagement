// Notification triggers (E9.4) — orchestrate the "asset ready" and "assigned" Slack
// messages. Server-only; all best-effort (never throw) so they can't block the ticket
// write that fired them. Postgres is the system of record now: the ticket + the
// requester/editor contacts (name, email) are read from PG; the asset-ready dedupe uses
// the ticket's asset_ready_notified flag (a plain PG update — not synced to Airtable).

import { prisma } from '@/lib/prisma';
import { contentReadyChannel, dmByPerson, postToChannel } from '@/lib/notify/slack';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function ticketUrl(id: string): string {
  const base = (process.env.NEXT_PUBLIC_APP_URL || process.env.AUTH_URL || '').replace(/\/$/, '');
  return base ? `${base}/tickets/${id}` : `/tickets/${id}`;
}

/**
 * Fire the asset-ready notifications (requester DM + #content-ready post) the first time
 * a final asset link is attached. Guarded by the ticket's asset_ready_notified flag so a
 * re-save can't re-notify. Best-effort. `ticketId` is the PG uuid.
 */
export async function maybeNotifyAssetReady(ticketId: string, assetUrl: string): Promise<void> {
  try {
    const where = UUID_RE.test(ticketId) ? { id: ticketId } : { airtableId: ticketId };
    const t = await prisma.ticket.findFirst({
      where,
      select: { id: true, title: true, assetReadyNotified: true, requester: { select: { name: true, email: true } } },
    });
    if (!t || t.assetReadyNotified) return; // not found or already notified

    const title = t.title || 'Asset';
    const url = ticketUrl(t.id);
    const link = assetUrl?.trim() || url;
    const requester = { name: t.requester?.name ?? null, email: t.requester?.email ?? null };

    await dmByPerson(requester, `✅ Your asset is ready: *${title}*\nAsset: ${link}\nTicket: ${url}`);
    await postToChannel(
      contentReadyChannel(),
      `✅ Asset ready: *${title}*${requester.name ? ` (for ${requester.name})` : ''}\n${link}\n<${url}|Open ticket>`,
    );

    await prisma.ticket.update({ where: { id: t.id }, data: { assetReadyNotified: true } });
  } catch (e) {
    console.error('[notify] maybeNotifyAssetReady failed', e);
  }
}

/** DM an editor that a ticket has been assigned to them. `ticketId` is the PG uuid;
 *  `editorRecId` is the Airtable Employees recId (resolved to the PG employee). Best-effort. */
export async function notifyAssignment(ticketId: string, editorRecId: string): Promise<void> {
  try {
    if (!editorRecId) return;
    const where = UUID_RE.test(ticketId) ? { id: ticketId } : { airtableId: ticketId };
    const [t, editor] = await Promise.all([
      prisma.ticket.findFirst({ where, select: { id: true, title: true } }),
      prisma.employee.findUnique({ where: { airtableId: editorRecId }, select: { name: true, email: true } }),
    ]);
    if (!editor) return;
    const title = t?.title || 'a ticket';
    await dmByPerson({ name: editor.name, email: editor.email }, `🎬 You've been assigned: *${title}*\nTicket: ${ticketUrl(t?.id ?? ticketId)}`);
  } catch (e) {
    console.error('[notify] notifyAssignment failed', e);
  }
}
