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

// ---------------------------------------------------------------------------
// Historical migration (one-time backfill) field maps. Resolved against the
// live schema 2026-06-26. Tickets come from the creative_services Prio table;
// the standalone asset library tables come from ads_creative_lib.
// ---------------------------------------------------------------------------

// 🎯 Prio: Creatives Requests (New) — historical tickets.
export const TICKETS = {
  baseId: BASES.creativeServices,
  tableId: 'tblhrRl8GzsDMv0DD',
  fields: {
    name: 'fld59SWr1qd1XPuR0', // "Name" (formula primary, READ-ONLY) → display title
    projectProgram: 'fldxatmiW57hVUL9X', // "Project/Program" (multilineText, WRITABLE) → intake title
    created: 'flde8MIcH6FH9sU0T', // "Created" (dateTime, writable) — set at intake time
    creativeBrief: 'fld5INJXFHCliBAKY', // "Creative Brief" (richText)
    cta: 'fldRUl1jsQefaUz4q', // "Call to action"
    dueDate: 'fldMbzZSolbVNAhGX', // "Due date"
    prioStatus: 'fldFH3scvUfjnOwhg', // "Prio. Status" (singleSelect)
    ticketStatus: 'fldanOtkhcohQbnK1', // "Ticket Status" (singleSelect)
    queueRank: 'fldaG3TQINrA1c9X0', // "Priority ranking (Manual)" (rating)
    publishedAt: 'fldq55IEq3aZMDwRn', // "📅 Published Date"
    typeOfRequest: 'fldlfaGYlYlTxNy1s', // "Type of Request" (Video | Design)
    teamServiceLevel: 'fldHGT2p5SObJEzPh', // "Team/Service Level"
    notes: 'fldVoECGWiDrOhbAt', // "V's Notes" (multilineText)
    score: 'fldjY4VfI44oGmtuS', // "SCORE" (formula) → priorityScore
    // file/link fields → assets (Stage 2a)
    rawFileUrl: 'fldySmTUdhXlv4evT', // "Raw File/URL Links" (url) → kind=raw
    outputLink: 'fldjP3qkJhbZAqh6C', // "Output link" (multilineText)
    final16x9: 'fldM3UIYvwgSEiICF', // "16x9 Final Link"
    final9x16: 'fldExLdKe6qiJvtph', // "9x16 Final Link"
    final4x5: 'fld4BuuOm2rnWYoIR', // "4x5 Final Link"
    assetFolderLink: 'fldRQRCJXQ6U4SKLq', // "Asset Folder Link"
  },
  links: {
    eventTypes: 'fldKGGZMuyqnF7gP8', // → 🧩 Event Type
    assetTypes: 'fldPgIBDJCuJng7K1', // → 🛎️ Asset Type
    assignedCreative: 'fldalbq653hBbZvu7', // → Employees
    assignedContractor: 'fldGJvGYPC71lDGKs', // → Contractor/Freelancers (fallback assignee)
    requestedBy: 'fldgw7zf5fD2YK2EL', // → Employees (requester)
    officialCalendar: 'fldGCRBjJXuiHjgw1', // → 📆 Official Calendar
    speakers: 'fldWYaTaYW6zh7G5f', // → Authors (Speakers/Authors)
    shoots: 'fldE0BeC6oUHs7NDk', // → 📺 Shoots & Raw Assets (optional)
  },
} as const;

// 📺 Shoots & Raw Assets — the raw source/shoot a request can optionally link to.
export const SHOOTS = {
  baseId: BASES.creativeServices,
  tableId: 'tblcZ8OIxfgnlUowC',
  fields: {
    title: 'fldiXdLvABVQsQx6C', // "Asset Title" (primary)
  },
} as const;

// Ad Creatives — standalone content/creative records.
export const AD_CREATIVES = {
  baseId: BASES.adsCreativeLib,
  tableId: 'tbl1AcKpMQvnF05YJ',
  fields: {
    name: 'fldSFSHNV8lnxhzqi', // "Name"
    title: 'fldsoSbmXl8B6yqTV', // "Title" (fallback)
    liveDate: 'fld3jxtoIk8uHOe2M', // "Live Date" → publishedAt
    finalAsset: 'fldHra4Ah0u36wbIj', // "► Final Asset" (richText, may hold link)
    reference: 'fldTKJnxnXoVX2A5F', // "Reference" (multipleAttachments) → fileUrl
    status: 'fldNh9GqWzLjzcibr', // "Status"
  },
} as const;

// (VSL) Final Ad Asset — finished sales-funnel video assets w/ performance.
export const FINAL_AD_ASSET = {
  baseId: BASES.adsCreativeLib,
  tableId: 'tblgiW8VvCt2J68FD',
  fields: {
    code: 'fldOgO5ZdJH5uynyq', // "Video Sale Asset Code" → name
    facebookPost: 'fldpfJ18DVPzjSpRD', // "Facebook Post" (url) → fileUrl
    image: 'fldIuMoRGzVghUtKD', // "Image" (multipleAttachments) fallback
    videoLink: 'fld7TAclvnde5SiCS', // "VIDEO LINK" (lookup) fallback
    created: 'fldHOfllUIXRSseGN', // "Created" (createdTime) → publishedAt
  },
} as const;

// 🎉 Best Videos — curated high-performing reference videos.
export const BEST_VIDEOS = {
  baseId: BASES.adsCreativeLib,
  tableId: 'tbl1oTzzum1OX2VKz',
  fields: {
    name: 'fldli3Jq9OSacePju', // "Name"
    videoUrl: 'fldQT2yoDDQEtGJDc', // "Video URL" (url) → fileUrl
    file: 'fldXO96iHLRbBnV2T', // "File" (multipleAttachments) fallback
    releaseDate: 'fldPLPP4sYRdyP5Kt', // "Release Date" → publishedAt
    status: 'fld9wyDLmDx3eNY5O', // "Status"
  },
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

// ---------------------------------------------------------------------------
// Vishen media → clip pipeline (created 2026-06-27). Two app-owned tables in the
// Creative Services base: the media inbox + its clip suggestions. Airtable-direct.
// ---------------------------------------------------------------------------

// 📺 Media Sources — inbox of external Vishen media links (YouTube first).
export const MEDIA_SOURCES = {
  baseId: BASES.creativeServices,
  tableId: 'tblBQhM2Blqa7uNZX',
  fields: {
    title: 'fldumFfoeH2aMzKFZ', // "Title" (singleLineText, primary)
    sourceUrl: 'fldWw36iQ2Rm6DP41', // "Source URL" (url)
    platform: 'fldYCIo2Dricj0QiQ', // "Platform" (singleSelect: YouTube | Spotify | Apple Podcasts | Other)
    status: 'fldnX0Qu6uWHtmN5I', // "Status" (New | Transcribing | Clips Suggested | Error | Archived)
    guestShow: 'fldRdZmAVVmFcLM1l', // "Guest / Show"
    audience: 'fldX0KZp8UX1pYmgJ', // "Audience" (Cold | Warm)
    submittedVia: 'fldpG2cRTGGLOnKd4', // "Submitted Via" (Portal | Airtable | Slack | Auto-discover)
    transcript: 'fldlHHuu6RZoIGmIb', // "Transcript" (multilineText) — source transcript the strategy was built from
    strategyJson: 'fldcv4HIUI0HflvRG', // "Strategy JSON" (multilineText) — full 10-section output
    usedWebSearch: 'fldBncwhmhQ7vdSCk', // "Used Web Search" (checkbox)
    error: 'fldmk2jHF9n0whzcu', // "Error" (multilineText)
    submittedDate: 'fld0iEsDj4xv2ABpt', // "Submitted Date" (dateTime) — set on create
    clipsAddedDate: 'fldn3QKcQCIiK6nrr', // "Clips Added Date" (dateTime) — set when clips written
  },
  links: {
    submittedBy: 'fldFXpTr3za0Qc8Pd', // → 👬 Employees
    clipSuggestions: 'fldZvIu1lHYlFwPpt', // → 🎬 Clip Suggestions (auto-created reverse link)
  },
  // singleSelect option values (write the plain name string).
  status_: { new: 'New', transcribing: 'Transcribing', clipsSuggested: 'Clips Suggested', error: 'Error', archived: 'Archived' },
  via: { portal: 'Portal', airtable: 'Airtable', slack: 'Slack', autoDiscover: 'Auto-discover' },
} as const;

// 🎬 Clip Suggestions — one row per proposed clip from a Media Source.
export const CLIP_SUGGESTIONS = {
  baseId: BASES.creativeServices,
  tableId: 'tblquXg7eesUZwvSH',
  fields: {
    name: 'fldGD07TIbYEcCYAz', // "Name" (singleLineText, primary) — hook line / label
    index: 'fldoDUIlLBSLtR4ZP', // "Index" (number)
    timestampStart: 'fldlDxa8ZEbo8tEYu', // "Timestamp Start"
    timestampEnd: 'fldxBgaSdriwtpFjk', // "Timestamp End"
    hookLine: 'fldvbSGgjKfZ9U3Oy', // "Hook Line"
    rationale: 'fldFWsyDDe1UMLySB', // "Rationale" (multilineText)
    caption: 'fldPIon3niXYqMG73', // "Caption" (multilineText)
    format: 'fldUC9mA48dyfoxjr', // "Format" (talking_head | quote_card | broll_overlay)
    viralityScore: 'fldCA8JsTQSvM148U', // "Virality Score" (number, 1–10)
    status: 'fldpnlfTD2UwXS8su', // "Status" (Proposed | Approved | Dismissed)
    addedDate: 'fldwmRqAJf2kcUrp3', // "Added Date" (dateTime) — set on create
  },
  links: {
    mediaSource: 'fldcmDia3CiWEWJkI', // → 📺 Media Sources (parent)
    ticket: 'fldTcZh1Z5YvugMFX', // → 🎯 Prio Requests (set on approve)
  },
  status_: { proposed: 'Proposed', approved: 'Approved', dismissed: 'Dismissed' },
} as const;
