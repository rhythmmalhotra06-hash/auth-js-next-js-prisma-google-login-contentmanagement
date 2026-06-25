// Airtable → Postgres reference field map.
//
// Keyed on stable FIELD IDS (fld…), not names — Airtable field renames must not
// break sync. Resolved against the live schema export on 2026-06-25 (see
// context/airtable-schema/RECONCILIATION.md). Records are fetched with
// returnFieldsByFieldId=true so record.fields is keyed by these IDs.

export const BASES = {
  creativeServices: 'appFEFygXo2pRc8AR',
  adsCreativeLib: 'appWYOr2p4RKHf2LR',
} as const;

export const EMPLOYEES = {
  baseId: BASES.creativeServices,
  tableId: 'tbllP5vRon54L7Ccf', // 👬 Employees
  fields: {
    name: 'fldaFPL1w7o8lrUcy', // "Name"
    email: 'fldCSlSk6mwmQYK74', // "Work Email"
    team: 'fld40bQ9gPPUF4bX2', // "Creative Team (Editors)"
    division: 'fldnqHMir8EYbAmTc', // "Division"
    employmentStatus: 'fldE56Vg1wJFXgZ7J', // "Employment Status"
    activeStatus: 'fldVpmhLINGDPxJNG', // "Active Status" → active = (value === "Active")
  },
} as const;

export const DIMENSIONS = {
  baseId: BASES.creativeServices,
  tableId: 'tblHSG0MpdvUI9Z4X', // 📦 Dimensions
  fields: {
    label: 'fld5rj6hl3sAKlh7c', // "Name"
  },
} as const;

export const EVENT_TYPES = {
  baseId: BASES.creativeServices,
  tableId: 'tblzTFTZ2ttEvi2j1', // 🧩 Event Type
  fields: {
    name: 'fldAthwfuZIZ1Ip1L', // "Event Type"
    status: 'fld9zPjkF542hVinq', // "Status" → active = (value === "Active")
  },
} as const;

export const ASSET_TYPES = {
  baseId: BASES.creativeServices,
  tableId: 'tblLbcgob2Bxevugy', // 🛎️ Creative Asset Type
  fields: {
    name: 'fldNRpVclLnbT3jRR', // "Asset type"
    fullName: 'fldP6YGDBvf4DWXld', // "Asset Type (Full title)" — fallback when short name is blank
    category: 'fld86vEJhhWbheWDU', // "Type of Asset" (Print | Digital)
    status: 'fldfCsqOjPO2LH9Ye', // "Status" (Active | Inactive)
  },
  // Multi-record links → resolved to our join tables in pass 2.
  links: {
    eventTypes: 'fldCDp2QUGCTbyp3v', // → Event Type
    teamLeads: 'fldwO5GJ7OUoeJHfL', // → Employees
    preferredEditors: 'fldyynej9y49WBxNm', // → Employees
    dimensions: 'fld3XvOZ2lJ7foY7t', // → Dimensions
  },
} as const;

// NOTE: DNA is deferred from v1. The Asset Type "DNA" field is free text + a URL
// (not a record link), and the DNAs table (ads_creative_lib tbl0fsHkGxD6HZz6k) has
// no requirements/feedback_standards fields — so asset_type↔dna can't be auto-resolved
// by link. Revisit when DNA integration is designed.

export const OFFICIAL_CALENDARS = {
  baseId: BASES.creativeServices,
  tableId: 'tblwX47huc5xpkWyk', // 📆 Official Calendar
  fields: {
    name: 'fldjuF4S7ptf7LJvs', // "Name of project"
    status: 'fldcMN9WdUJYlx0pp', // "Status"
    startDate: 'fldtiPnk3piWUJ8sh', // "Start date"
    endDate: 'fldDQ5wle0nFSQXBi', // "End Date"
  },
} as const;

export const AUTHORS = {
  baseId: BASES.creativeServices,
  tableId: 'tblGecx2i4ge9KYmU', // ✍🏻 Authors
  fields: {
    name: 'fldfg4etowAZ0V6Td', // "Name"
    title: 'fld3oF6P49icz2zDT', // "Author's Title"
  },
} as const;
