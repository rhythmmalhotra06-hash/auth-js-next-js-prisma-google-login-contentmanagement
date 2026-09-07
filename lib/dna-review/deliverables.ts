// Deterministic, non-LLM check: which dimensions does this asset type require, and which
// of the ticket's delivery-link fields are actually filled. No model call, can't
// hallucinate — this fires even when an asset type's rulebook is empty (day one).
//
// Only three Dimension labels have a corresponding Ticket delivery field today
// (16x9/9x16/4x5 — see `ASSET_LINK_FIELDS` in app/tickets/[id]/actions.ts). Other labels
// (1x1, 1920x1080, 2x3, Custom) have nowhere on the ticket to be filled in, so this check
// deliberately says nothing about them rather than inventing a claim it can't back up.

import { prisma } from '@/lib/prisma';

const DIMENSION_TO_FIELD: Record<string, 'final16x9' | 'final9x16' | 'final4x5'> = {
  '16x9': 'final16x9',
  '9x16': 'final9x16',
  '4x5': 'final4x5',
};

export interface DeliverableFinding {
  dimension: 'deliverable_metadata';
  note: string;
  severity: 'flag';
  evidence: string;
}

/** Missing-deliverable findings for a ticket, derived purely from linked Dimensions vs.
 *  filled delivery fields. Returns [] when everything required is present (or the asset
 *  type requires none of the three mappable dimensions). */
export async function checkDeliverableCompleteness(ticketId: string): Promise<DeliverableFinding[]> {
  const ticket = await prisma.ticket.findUnique({
    where: { id: ticketId },
    select: {
      final16x9: true,
      final9x16: true,
      final4x5: true,
      assetType: {
        select: {
          name: true,
          dimensions: { select: { dimension: { select: { label: true } } } },
        },
      },
    },
  });
  if (!ticket?.assetType) return [];

  const requiredLabels = ticket.assetType.dimensions
    .map((d) => d.dimension.label)
    .filter((label) => label in DIMENSION_TO_FIELD);

  const findings: DeliverableFinding[] = [];
  for (const label of requiredLabels) {
    const field = DIMENSION_TO_FIELD[label];
    const filled = !!ticket[field]?.trim();
    if (!filled) {
      findings.push({
        dimension: 'deliverable_metadata',
        note: `${ticket.assetType.name} requires a ${label} cut — none is attached yet.`,
        severity: 'flag',
        evidence: `${ticket.assetType.name} links the "${label}" dimension; the ticket's corresponding delivery field is empty.`,
      });
    }
  }
  return findings;
}
