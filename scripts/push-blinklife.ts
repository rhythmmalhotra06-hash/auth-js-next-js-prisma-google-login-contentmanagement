// BlinkLife push runner (portal → BlinkLife).
//
//   npx tsx scripts/push-blinklife.ts              # drain the editor-task outbox
//   npx tsx scripts/push-blinklife.ts --review     # also refresh Vishen's review page
//   npx tsx scripts/push-blinklife.ts --dry-run    # report what WOULD push, no BlinkLife calls
//
// Needs BLINKLIFE_ENABLED=true + BLINKLIFE_TOKEN + a reachable DATABASE_URL.
// In prod this runs as a Kessel internal job on a schedule.

import 'dotenv/config';
import { prisma } from '../lib/prisma';
import { drainBlinklifeOutbox, pushVishenReview } from '../lib/blinklife/push';
import { ticketToTask, type TicketForTask } from '../lib/blinklife/map';

const dryRun = process.argv.includes('--dry-run');
const withReview = process.argv.includes('--review');

async function dryRunReport() {
  const rows = await prisma.blinkLifeOutbox.findMany({
    where: { status: 'pending' },
    orderBy: { enqueuedAt: 'asc' },
    select: { ticketId: true },
  });
  const ticketIds = [...new Set(rows.map((r) => r.ticketId))];
  const previews = [];
  for (const id of ticketIds) {
    const t = await prisma.ticket.findUnique({
      where: { id },
      select: {
        id: true, title: true, creativeBrief: true, cta: true, dueDate: true,
        prioStatus: true, ticketStatus: true, queueRank: true, typeOfRequest: true,
        assignee: { select: { name: true } },
        eventType: { select: { name: true } },
        assetType: { select: { name: true } },
      },
    });
    if (!t) continue;
    const shape: TicketForTask = {
      id: t.id, title: t.title, creativeBrief: t.creativeBrief, cta: t.cta, dueDate: t.dueDate,
      prioStatus: t.prioStatus, queueRank: t.queueRank, typeOfRequest: t.typeOfRequest,
      assigneeName: t.assignee?.name ?? null,
      eventTypeName: t.eventType?.name ?? null,
      assetTypeName: t.assetType?.name ?? null,
    };
    previews.push({ ticketStatus: t.ticketStatus, prioStatus: t.prioStatus, task: ticketToTask(shape) });
  }
  return { pending: ticketIds.length, previews };
}

(async () => {
  if (dryRun) {
    const report = await dryRunReport();
    console.log(JSON.stringify(report, null, 2));
    console.log('\nDRY RUN — mapped pending tickets, no BlinkLife calls.');
    return;
  }
  const report = await drainBlinklifeOutbox();
  console.log(JSON.stringify(report, null, 2));
  if (withReview) {
    const review = await pushVishenReview();
    console.log(JSON.stringify(review, null, 2));
  }
  console.log('\nPush complete.');
})()
  .catch((err) => {
    console.error('BlinkLife push failed:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
