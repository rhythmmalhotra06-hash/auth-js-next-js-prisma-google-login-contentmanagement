// Postgres-backed intake reference (REFERENCE_BACKEND=postgres). Mirrors the shape of
// getLiveIntakeReference() but reads the mirrored PG tables. Options are keyed by
// Airtable recId (via each row's airtableId) so createTicket's link writes still resolve.

import type { LiveReference } from '@/lib/airtable/reference-live';
import type { Option } from '@/lib/intake/data';
import { SHOOT_STATUS } from '@/lib/shoots/constants';

const SHOOTS_MAX = 500;
const byName = (a: Option, b: Option) => a.name.localeCompare(b.name);
const joinNames = (xs: (string | null | undefined)[]): string | null => {
  const out = xs.filter((x): x is string => !!x);
  return out.length ? [...new Set(out)].join(', ') : null;
};

export async function getPgIntakeReference(): Promise<LiveReference> {
  const { prisma } = await import('@/lib/prisma');

  const [employeeRows, eventTypeRows, assetTypeRows, calendarRows, authorRows, shootRows] = await Promise.all([
    prisma.employee.findMany({ where: { active: true }, select: { airtableId: true, name: true } }),
    prisma.eventType.findMany({ where: { active: true }, select: { airtableId: true, name: true } }),
    prisma.assetType.findMany({
      where: { active: true },
      select: {
        airtableId: true, name: true, fullName: true, category: true, creativeCategory: true,
        eventTypes: { select: { eventType: { select: { airtableId: true } } } },
        teamLeads: { select: { employee: { select: { name: true } } } },
        preferredEditors: { select: { employee: { select: { name: true } } } },
        dimensions: { select: { dimension: { select: { label: true } } } },
      },
    }),
    prisma.officialCalendar.findMany({ select: { airtableId: true, name: true } }),
    prisma.author.findMany({ select: { airtableId: true, name: true } }),
    prisma.shoot.findMany({ where: { NOT: { status: SHOOT_STATUS.cancelled } }, select: { airtableId: true, title: true }, take: SHOOTS_MAX }),
  ]);

  const employees: Option[] = employeeRows
    .filter((r) => r.airtableId)
    .map((r) => ({ id: r.airtableId as string, name: r.name }));

  const eventTypes: Option[] = eventTypeRows
    .filter((r) => r.airtableId)
    .map((r) => ({ id: r.airtableId as string, name: r.name }));

  const assetTypes = assetTypeRows
    .filter((r) => r.airtableId)
    .map((r) => ({
      id: r.airtableId as string,
      name: r.name ?? r.fullName ?? '(unnamed)',
      category: r.category,
      eventTypeIds: r.eventTypes.map((e) => e.eventType.airtableId).filter((x): x is string => !!x),
      isVideo: r.creativeCategory === 'Creative Video Type',
      teamLead: joinNames(r.teamLeads.map((t) => t.employee.name)),
      preferredEditor: joinNames(r.preferredEditors.map((p) => p.employee.name)),
      dimensions: joinNames(r.dimensions.map((d) => d.dimension.label)),
    }));

  const officialCalendars: Option[] = calendarRows
    .filter((r) => r.airtableId)
    .map((r) => ({ id: r.airtableId as string, name: r.name }));

  const authors: Option[] = authorRows
    .filter((r) => r.airtableId)
    .map((r) => ({ id: r.airtableId as string, name: r.name }));

  // Shoots — from the PG mirror (options keyed by recId; unpushed PG-created shoots have
  // no recId yet and are skipped until the drainer assigns one).
  const shoots: Option[] = shootRows
    .filter((r) => r.airtableId)
    .map((r) => ({ id: r.airtableId as string, name: r.title || '(untitled shoot)' }));

  employees.sort(byName); eventTypes.sort(byName); assetTypes.sort(byName);
  officialCalendars.sort(byName); authors.sort(byName); shoots.sort(byName);

  return { employees, eventTypes, assetTypes, officialCalendars, authors, shoots };
}
