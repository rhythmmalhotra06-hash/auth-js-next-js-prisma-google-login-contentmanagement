import { getLiveIntakeReference } from '@/lib/airtable/reference-live';
import { referenceIsPostgres } from '@/lib/reference/backend';

// Reference data for the intake form. Option values are Airtable recIds, written
// straight into the ticket's link fields at create time — true whether we read LIVE
// from Airtable (default) or from the mirrored Postgres tables (REFERENCE_BACKEND=postgres),
// since PG rows expose their airtableId as the option id. No silent fallback across
// backends: on failure we surface empty lists (form shows nothing → retry) rather than
// submit invalid record IDs.

export interface Option {
  id: string;
  name: string;
}

/** Employee option — carries the work email so the intake form can apply the asset-type
 *  entitlement rule to the SELECTED requester, not just the signed-in user (raising a
 *  request on a colleague's behalf is normal here). See lib/intake/entitlement.ts. */
export interface EmployeeIntakeOption extends Option {
  email: string | null;
}

export interface AssetTypeOption extends Option {
  fullName: string | null; // Airtable "Asset Type (Full title)" — shown in the dropdown to disambiguate same-named types across event contexts
  category: string | null;
  eventTypeIds: string[]; // Asset Type is filtered to those linked to the chosen Event Type
  isVideo: boolean; // Category === "Creative Video Type" — used to restrict the shoot form to video assets
  /**
   * Work emails allowed to RAISE this asset type (Airtable "Stakeholder"). Empty means
   * unrestricted — a blank field must never hide an asset type from everyone, which is the
   * trap the `Category`/isVideo field already sprang once.
   */
  stakeholderEmails: string[];
  // Locked lookups shown on the intake form once an asset type is picked (resolved to names).
  teamLead: string | null;
  preferredEditor: string | null;
  dimensions: string | null;
}

export interface IntakeReferenceData {
  employees: EmployeeIntakeOption[];
  eventTypes: Option[];
  assetTypes: AssetTypeOption[];
  officialCalendars: Option[];
  authors: Option[];
  shoots: Option[];
  teamServiceLevels: string[];
  typesOfRequest: string[];
}

// Live select-option values for the Airtable "Team/Service Level" single-select
// (fldHGT2p5SObJEzPh). The token can't create new options, so this list MUST stay in
// sync with the field's choices — verified against the live schema 2026-07-06.
export const TEAM_SERVICE_LEVELS = [
  'Video Team - Non Campaign',
  'Video Team - Campaign [Events, etc]',
  'Event Design Graphic',
  'Brand Design Graphic',
];
export const TYPES_OF_REQUEST = ['Video', 'Design'];

const EMPTY: IntakeReferenceData = {
  employees: [], eventTypes: [], assetTypes: [], officialCalendars: [], authors: [], shoots: [],
  teamServiceLevels: TEAM_SERVICE_LEVELS, typesOfRequest: TYPES_OF_REQUEST,
};

export async function getIntakeReferenceData(): Promise<IntakeReferenceData> {
  try {
    const live = referenceIsPostgres()
      ? await (await import('@/lib/reference/intake.postgres')).getPgIntakeReference()
      : await getLiveIntakeReference();
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
