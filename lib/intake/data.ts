import { getLiveIntakeReference } from '@/lib/airtable/reference-live';

// Reference data for the intake form — LIVE from Airtable. Option values are
// Airtable recIds, written straight into the ticket's link fields at create time.
// No Postgres fallback: a fallback that returned UUIDs would break the Airtable
// link write, so on failure we surface empty lists (form shows nothing → retry)
// rather than silently submit invalid record IDs.

export interface Option {
  id: string;
  name: string;
}

export interface AssetTypeOption extends Option {
  category: string | null;
  eventTypeIds: string[]; // Asset Type is filtered to those linked to the chosen Event Type
  isVideo: boolean; // Category === "Creative Video Type" — used to restrict the shoot form to video assets
}

export interface IntakeReferenceData {
  employees: Option[];
  eventTypes: Option[];
  assetTypes: AssetTypeOption[];
  officialCalendars: Option[];
  authors: Option[];
  shoots: Option[];
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

const EMPTY: IntakeReferenceData = {
  employees: [], eventTypes: [], assetTypes: [], officialCalendars: [], authors: [], shoots: [],
  teamServiceLevels: TEAM_SERVICE_LEVELS, typesOfRequest: TYPES_OF_REQUEST,
};

export async function getIntakeReferenceData(): Promise<IntakeReferenceData> {
  try {
    const live = await getLiveIntakeReference();
    return {
      employees: live.employees,
      eventTypes: live.eventTypes,
      assetTypes: live.assetTypes,
      officialCalendars: live.officialCalendars,
      authors: live.authors,
      shoots: live.shoots,
      teamServiceLevels: TEAM_SERVICE_LEVELS,
      typesOfRequest: TYPES_OF_REQUEST,
    };
  } catch (err) {
    console.error('[intake] live Airtable reference unavailable:', err);
    return EMPTY;
  }
}
