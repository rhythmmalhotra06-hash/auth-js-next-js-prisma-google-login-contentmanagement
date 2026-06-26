import { prisma } from '@/lib/prisma';

// Reference data for the intake form. Mirrors the live "Creative Request
// Submission" form: Requested By, Team/Service Level, Type of Request,
// Event Type → (filters) Asset Type, Official Calendar, Speakers/Authors.

export interface Option {
  id: string;
  name: string;
}

export interface AssetTypeOption extends Option {
  category: string | null;
  eventTypeIds: string[]; // Asset Type is filtered to those linked to the chosen Event Type
}

export interface IntakeReferenceData {
  employees: Option[];
  eventTypes: Option[];
  assetTypes: AssetTypeOption[];
  officialCalendars: Option[];
  authors: Option[];
  teamServiceLevels: string[];
  typesOfRequest: string[];
}

// Live select-option values from the reconciliation (RECONCILIATION.md).
export const TEAM_SERVICE_LEVELS = [
  'Content Video',
  'Ad Creatives Video',
  'Social Media Video',
  'Event Design Graphic',
  'Brand Design Graphic',
  'Pathway Organic',
];
export const TYPES_OF_REQUEST = ['Video', 'Design'];

export async function getIntakeReferenceData(): Promise<IntakeReferenceData> {
  const [employees, eventTypes, assetTypesRaw, officialCalendars, authors] = await Promise.all([
    prisma.employee.findMany({ where: { active: true }, select: { id: true, name: true }, orderBy: { name: 'asc' } }),
    prisma.eventType.findMany({ where: { active: true }, select: { id: true, name: true }, orderBy: { name: 'asc' } }),
    prisma.assetType.findMany({
      where: { active: true },
      select: { id: true, name: true, category: true, eventTypes: { select: { eventTypeId: true } } },
      orderBy: { name: 'asc' },
    }),
    prisma.officialCalendar.findMany({ select: { id: true, name: true }, orderBy: { name: 'asc' } }),
    prisma.author.findMany({ select: { id: true, name: true }, orderBy: { name: 'asc' } }),
  ]);

  return {
    employees,
    eventTypes,
    assetTypes: assetTypesRaw.map((a) => ({
      id: a.id,
      name: a.name,
      category: a.category,
      eventTypeIds: a.eventTypes.map((e) => e.eventTypeId),
    })),
    officialCalendars,
    authors,
    teamServiceLevels: TEAM_SERVICE_LEVELS,
    typesOfRequest: TYPES_OF_REQUEST,
  };
}
