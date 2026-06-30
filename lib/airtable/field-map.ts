// Airtable → Postgres reference field map.
//
// Keyed on stable FIELD IDS (fld…), not names — Airtable field renames must not
// break sync. Resolved against the live schema export on 2026-06-25 (see
// context/airtable-schema/RECONCILIATION.md). Records are fetched with
// returnFieldsByFieldId=true so record.fields is keyed by these IDs.

export const BASES = {
  creativeServices: 'appFEFygXo2pRc8AR',
  adsCreativeLib: 'appWYOr2p4RKHf2LR',
  vishenContent: 'appvBtCYdaSrD1y11', // Vishen's personal content base (Major Videos lives here)
  contentComms: 'app9YRZOVeE65fJPA', // 📣 MV Content & Comms — Marketing division's base (Social board + its own Prio table)
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
    assetReadyNotified: 'fld1STKbdnsSc4ovK', // "Asset Ready Notified" (checkbox) — E9.4 dedupe; app-managed
    publishedAt: 'fldq55IEq3aZMDwRn', // "📅 Published Date"
    typeOfRequest: 'fldlfaGYlYlTxNy1s', // "Type of Request" (Video | Design)
    teamServiceLevel: 'fldHGT2p5SObJEzPh', // "Team/Service Level"
    creativeServiceType: 'fldHav5N7f7Rpi08Q', // "Creative Service Type" (multipleSelects) → team
    teamLeadLookup: 'fldXKxwZThvwjpaeU', // "Team Lead (from 🛎️ Asset Type)" (lookup)
    dimensionsLookup: 'fldDSN1qrA8Yqbwb1', // "Dimensions (from 🛎️ Asset Type)" (lookup)
    creativeTeamLookup: 'flddD9CYSvUSB0yVx', // "Creative Team (Editors)" (lookup)
    notes: 'fldVoECGWiDrOhbAt', // "V's Notes" (multilineText)
    score: 'fldjY4VfI44oGmtuS', // "SCORE" (formula) → priorityScore
    // file/link fields → assets (Stage 2a)
    rawFileUrl: 'fldySmTUdhXlv4evT', // "Raw File/URL Links" (url) → kind=raw
    outputLink: 'fldjP3qkJhbZAqh6C', // "Output link" (multilineText)
    final16x9: 'fldM3UIYvwgSEiICF', // "16x9 Final Link"
    final9x16: 'fldExLdKe6qiJvtph', // "9x16 Final Link"
    final4x5: 'fld4BuuOm2rnWYoIR', // "4x5 Final Link"
    assetFolderLink: 'fldRQRCJXQ6U4SKLq', // "Asset Folder Link"
    downloadLink: 'fldrwGSNIJ3pAsO20', // "Download link" (url) — editor download (e.g. Dropbox), distinct from source URL (E9.1)
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

// 📺 Shoots — pre-production filming requests (the "New 🎬 Shoots" form) that feed
// production tickets. Field IDs resolved against the live schema 2026-06-29
// (Context/airtable-schema/creative_services.raw.json). Also the optional raw-source
// link target for a creative ticket (TICKETS.links.shoots → this table).
export const SHOOTS = {
  baseId: BASES.creativeServices,
  tableId: 'tblcZ8OIxfgnlUowC',
  // Field NAME (for filterByFormula, which matches names not IDs).
  statusFieldName: 'Filming Status',
  fields: {
    title: 'fldiXdLvABVQsQx6C', // "Asset Title" (singleLineText, primary)
    status: 'fldfz4B7S765leTIT', // "Filming Status" (singleSelect) — see status_ below
    notes: 'fldTuCEBQmXYnxCZM', // "Notes/Brief" (richText)
    filmingLocation: 'fldTpntyVFFiWCw49', // "📍 Filming Location" (singleSelect: "Studio Time - …" etc.)
    filmingDate: 'fld2d5m4pvwaCkFt4', // "📆 Filming Date" (date)
    format: 'fldI9Zq1MsLmkH1rC', // "Format" (singleSelect) — see format_ below
    productionSupport: 'fldpGBd4gOiCooTOv', // "Production Support" (multilineText)
    vishenApproval: 'fldhqZbEmxjEK703f', // "Vishen's Approval" (checkbox)
    created: 'fld5oUk5TNQvchDx0', // "Created" (createdTime, READ-ONLY)
  },
  links: {
    requestedBy: 'fldnLRFDHVXuUvUba', // "Requester" → 👬 Employees
    authors: 'fldTkTRGlh5dj7cUp', // → Authors 🧠
    eventTypes: 'fldRlBQIifsGQ4LWr', // → 🧩 Event Type
    assetTypes: 'fldqNdJkJxT0kXuxy', // → 🛎️ Creative Asset Type
    postProductionTicket: 'fldK6lVl9cO59ICUt', // "Post-Production Ticket (AT)" → 🎯 Prio Requests
  },
  // singleSelect option values (write the plain name string — note the "New Requests - " prefix).
  status_: {
    approved: 'New Requests - Approved by Vishen',
    needsReview: "New Requests - Needs Vishen's Review",
    toFilm: 'To Film',
    filmed: 'Done - Filmed',
    cancelled: 'Cancelled',
  },
  format_: { studio: 'Studio', vlog: 'VLOG', broll: 'Broll', testimonial: 'Testimonial', livestream: 'Livestream', interview: 'Interview' },
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
    roles: 'fldZmbGqc6GXvLPDq', // "Roles" (multipleSelects) — app access roles, managed from /settings/team
    capacity: 'fldrJNmpjvPvZDhbo', // "Capacity" (number) — weighted load = 100%; blank → global default. From /settings/scoring
  },
} as const;

// 👷🏼 Contractor/Freelancers — the second pool tickets get assigned to (via Prio
// Requests "Assigned Contractor/Freelancer"). Tickets assign to either an Employee
// creative OR a contractor here; nobody else.
export const CONTRACTORS = {
  baseId: BASES.creativeServices,
  tableId: 'tblRhzXG5vea37rYr',
  fields: {
    name: 'flddODE3TVJ1REDTY', // "Name"
    status: 'fldrpLK9VCaXgykQD', // "Status" (singleSelect) → active = (value === "Active")
    serviceLevel: 'fldJIpVXOavKBOYet', // "Team/Service Level" (singleSelect)
    capacity: 'fldBhNMSaMVZGuAHC', // "Capacity" (number) — weighted load = 100%; blank → global default. From /settings/scoring
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
    loadWeight: 'fldXPpMwgvKWcRwF5', // "Load Weight" (number) — capacity cost per ticket; blank → 1. From /settings/scoring
    tierNorm: 'fldT7qw1xr1B6zMeR', // "Tier Norm" (number 0–1) — priority event tier; blank → name-pattern fallback. From /settings/scoring
  },
} as const;

export const ASSET_TYPES = {
  baseId: BASES.creativeServices,
  tableId: 'tblLbcgob2Bxevugy', // 🛎️ Creative Asset Type
  fields: {
    name: 'fldNRpVclLnbT3jRR', // "Asset type"
    fullName: 'fldP6YGDBvf4DWXld', // "Asset Type (Full title)" — fallback when short name is blank
    category: 'fld86vEJhhWbheWDU', // "Type of Asset" (Print | Digital)
    creativeCategory: 'fldmDywGRsFPjwNPb', // "Category" (Creative Video Type | Creative Brand Design Type | Creative Event Design Type)
    status: 'fldfCsqOjPO2LH9Ye', // "Status" (Active | Inactive)
    loadWeight: 'fld7d85oMy4ELYmDi', // "Load Weight" (number) — capacity cost per ticket; blank → 1. From /settings/scoring
    effortNorm: 'fldKEQQQnkQK9XL3q', // "Effort Norm" (number 0–1) — priority complexity effort; blank → 0.5. From /settings/scoring
    dnaRequirements: 'fldogRGYGUJq6rHIX', // "DNA / Requirements" (multilineText) — E9.7, edited at /settings/asset-types
    feedbackStandards: 'fldhlP1atHGC6diSS', // "Feedback Standards" (multilineText) — E9.7
    dnaUpdatedBy: 'fldb3LMpdlPikEVKf', // "DNA Updated By" (singleLineText) — last portal editor email (E9.7 audit)
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
    downloadUrl: 'fldHS8zfP5K9OtnQi', // "Download URL" (url) — optional editor download link, carried onto tickets (E9.1)
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
    ticketDueDate: 'fldDfUyOazIWkgq98', // "Ticket Due Date" (date) — default due date for checkbox-created tickets; falls back to today+7
    sourceRecordId: 'fldaSr62jen1C1wgI', // "Source Record ID" (singleLineText) — provenance/dedupe for cross-base sync (Major Videos)
  },
  links: {
    submittedBy: 'fldFXpTr3za0Qc8Pd', // → 👬 Employees
    clipSuggestions: 'fldZvIu1lHYlFwPpt', // → 🎬 Clip Suggestions (auto-created reverse link)
    // Default taxonomy inherited by tickets created from this source's clips (checkbox convert).
    ticketEventType: 'fldy1BzsII45RCxlV', // → 🧩 Event Type
    ticketAssetType: 'fldKGgQDQwfm0xVgr', // → 🛎️ Creative Asset Type
    ticketOfficialCalendar: 'fldUsLv1aQEzJErgk', // → 📆 Official Calendar (optional)
  },
  // singleSelect option values (write the plain name string).
  status_: { new: 'New', transcribing: 'Transcribing', clipsSuggested: 'Clips Suggested', error: 'Error', archived: 'Archived' },
  via: { portal: 'Portal', airtable: 'Airtable', slack: 'Slack', autoDiscover: 'Auto-discover' },
} as const;

// 🎬 Major Videos — Vishen's manually-maintained film log in his own content base.
// One-way sync into 📺 Media Sources (rows with a Final/Draft URL) so his media reaches the
// production pipeline; the Studio "add media" entry also writes rows back here. See
// lib/media/major-videos.ts. Field names referenced in filterByFormula: "Final URL", "Draft URL".
export const MAJOR_VIDEOS = {
  baseId: BASES.vishenContent,
  tableId: 'tblSrtPXAeiGeLUwW',
  fields: {
    name: 'fldLy51h0yvJy7OP9', // "Name" (singleLineText, primary)
    filmed: 'fldqRI3wSLtqPr93F', // "Filmed" (date)
    select: 'fldoMVNmdmVEPz1Uc', // "Select" (multipleSelects) — content type (Podcast by Vishen, Youtube Long, Masterclass…)
    draftUrl: 'fldsqShd2qV1K1sae', // "Draft URL" (url)
    finalUrl: 'fldxHwImLHdsDWfuL', // "Final URL" (url)
  },
  links: {
    clips: 'fldADk2WtsJawXAQy', // → 🎬 Clips (Vishen's), inverse of VISHEN_CLIPS.links.source
  },
} as const;

// 🧠 Clip Rules — editable config for the clip-generation engine (created 2026-06-27).
// Base system prompt + default brand pillars + appendable rules/learnings, scoped by
// Clip Type. Edited from /settings/clip-rules; read by lib/clipping/config.ts (cached,
// with hardcoded fallback). One app-owned table in the Creative Services base.
export const CLIP_RULES = {
  baseId: BASES.creativeServices,
  tableId: 'tblNTRNmpQyIusmEU',
  fields: {
    name: 'fldOGidWbqO1tqWJ1', // "Name" (singleLineText, primary) — row label
    kind: 'fldj57TsJseA52IJM', // "Kind" (singleSelect: Base Prompt | Brand Pillars | Rule)
    clipType: 'fld6aIBLq5wzlgHrd', // "Clip Type" (singleSelect: All | Reel | Stage Talk | Short)
    content: 'fld0l7jf5UcVoiG67', // "Content" (multilineText) — prompt / pillars / rule text
    active: 'fldY4Q1xzQiFUQHd4', // "Active" (checkbox)
    order: 'fldtzI21fmkchkU7o', // "Order" (number) — sort for appended rules
    section: 'fldTOUl3kFhLjDzvG', // "Section" (singleSelect: General | Clips | Thumbnail | Titles | Distribution)
    note: 'fld3W1tiYjtVnGQ5l', // "Note" (multilineText) — why the learning was added
    updatedBy: 'fld8E6wUBRgQjYs2V', // "Updated By" (singleLineText) — last editor email
    updatedAt: 'fldEMpB30zAw1fOWV', // "Last Modified" (formula LAST_MODIFIED_TIME()) — auto-stamped on any edit, portal or Airtable. Read-only.
  },
  // singleSelect option values (write the plain name string).
  kind_: { basePrompt: 'Base Prompt', brandPillars: 'Brand Pillars', rule: 'Rule' },
} as const;

// ⚙️ Scoring Config — app-owned global knobs for capacity & priority scoring
// (created 2026-06-29). Key→number rows. Per-type weights live on Event Type /
// Asset Type; per-person capacity on Employees / Contractors. Edited from
// /settings/scoring; read by lib/scoring-config (cached, hardcoded fallback).
export const SCORING_CONFIG = {
  baseId: BASES.creativeServices,
  tableId: 'tbl2a6Qh9Gj6Wpw6b',
  fields: {
    key: 'fldrnwvfBYjUwDCpb', // "Key" (singleLineText, primary) — stable config key
    value: 'fldZ9hzoiQmXf4IBL', // "Value" (number)
    label: 'fld6XjTiIsr6zRfuM', // "Label" (singleLineText) — admin-panel label
    group: 'fldphOgeFY7ss7psS', // "Group" (singleSelect: Capacity | Priority weights | Thresholds)
    note: 'fldspoos8i5d8tk9Y', // "Note" (multilineText)
    updatedBy: 'flduNMv7q1SyXzGDH', // "Updated By" (singleLineText) — last editor email
  },
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
    createTicket: 'fldNHVmcWAMuYVeXb', // "Create Ticket" (checkbox) — tick to convert to a ticket; convert cron unchecks it
    vishenClipId: 'fld4Qcvv1Q2biaJAO', // "Vishen Clip ID" (singleLineText) — recId of the mirrored row in Vishen's Clips table
  },
  links: {
    mediaSource: 'fldcmDia3CiWEWJkI', // → 📺 Media Sources (parent)
    ticket: 'fldTcZh1Z5YvugMFX', // → 🎯 Prio Requests (set on approve)
  },
  status_: { proposed: 'Proposed', approved: 'Approved', dismissed: 'Dismissed' },
} as const;

// ---------------------------------------------------------------------------
// Social Media clip section (created 2026-06-30) — Marketing division's surface.
// Lives in the 📣 MV Content & Comms base (NOT Creative Services). The clip engine
// writes Proposal rows directly into the team's live 📣 Social table; a human sets
// an Asset Type + checks "Raise Request (Creative)" and an Airtable automation fans
// out Prio tickets (same base) with a link-back. The portal is propose-only — it
// never writes tickets. Field IDs verified live against the base on 2026-06-30.
// ---------------------------------------------------------------------------

// 📣 Social — the Marketing content board. Engine proposals are rows with a
// non-empty Clip Source URL (our origin marker — the Source singleSelect is left
// untouched, it has its own meaning for an existing creative-services sync).
export const SOCIAL = {
  baseId: BASES.contentComms,
  tableId: 'tblCcrdkHzOakOGnm',
  fields: {
    title: 'fldBDHsk0YiLMiCqX', // "Title" (multilineText) — clip hook / title
    notes: 'fldJc3ZNwn42yMW35', // "Notes / Brief" (richText) — rationale + caption + timestamps
    status: 'fld8F8Z05DIzh5BJM', // "Status" (singleSelect) — staging gate
    socialFormat: 'fldo8ICzfKnVyLcTG', // "💿 Social Format" (singleSelect) — human-set (engine enum doesn't map 1:1)
    contentType: 'fld8uZNn5D7jzPc3Z', // "🛎️ Content Type" (singleSelect)
    captions: 'fldCpBMCWeGwmyYpx', // "✍️ Social Media Captions" (richText) — engine caption
    transcript: 'fldyonJXP12e5Sbv8', // "► Transcript" (richText) — source transcript segment
    raiseRequest: 'fldrNumf2EpoRetuf', // "Raise Request (Creative)" (checkbox) — the fan-out trigger
    clipSourceUrl: 'fldXi03EEUtKThsBv', // "Clip Source URL" (url) — engine-origin marker + grouping key (app-created 2026-06-30)
    // Read-only mirror lookups (from the linked Creative Request) — surfaced on the card.
    ticketStatusLookup: 'fldUGnlpLFdtiJ7L1', // "Ticket Status (from Creative Request)"
    prioStatusLookup: 'fld64iay3SwDuZ3hY', // "Prio. Status (from Creative Request)"
    assignedCreativeLookup: 'fld14fMuJKBy3q75v', // "Assigned Creative (from Creative Request)"
    assetLinkLookup: 'fldul5ssC2XaZ8FRL', // "🔗 Asset Link (from Creative Request)"
    eventTypeLookup: 'fldkXRTBoribSHwQw', // "Event type (from 📅 Official Cal)" (lookup)
  },
  links: {
    assetType: 'fldWJgCJ10WnRe62U', // → 🛎️ Creative Asset Type (human sets before raising)
    creativeRequest: 'flddCgrgYAcBMFcs9', // → 🎯 Prio Requests (set by the fan-out automation)
    shoots: 'fldFhwiHrpaCIgMlV', // → 📹 Shoots (optional source link)
  },
  // singleSelect option values (write the plain name string).
  status_: {
    proposal: '1: Proposal',
    approved: '2: Approved',
    ticketRaised: '2A. Ticket Raised',
    reject: '13: Reject',
  },
} as const;

// 🎯 Prio: Creatives Requests (New) — the Social fan-out ticket target. SAME base as
// 📣 Social (intra-base), so the fan-out is a native Airtable automation. The portal
// only READS ticket state here for the status mirror (most display needs are already
// covered by the lookups on 📣 Social above).
export const SOCIAL_PRIO = {
  baseId: BASES.contentComms,
  tableId: 'tblojUG9wmfTru9Wc',
  fields: {
    name: 'fldcLqx95hRTklFFq', // "Name" (multilineText, primary)
    notes: 'fldcyhu1RbiQkijhp', // "Creatives Ticket Notes" (richText)
    assignedCreative: 'fldOjbSHDCt0RWOD8', // "Assigned Creative" (singleLineText)
    assetLink: 'fldWiQd06dYvjzugW', // "🔗 Asset Link" (multilineText)
    prioStatus: 'fld7kNhgIYw5tk0au', // "Prio. Status" (singleSelect) — new tickets → "New Request"
    ticketStatus: 'fldrNakesPfMX1I08', // "Ticket Status" (singleSelect)
    teamServiceLevel: 'fldHWXRcyhKshGaS2', // "Team/Service Level" (singleSelect) — Social default "Social Media Video"
  },
  links: {
    assetType: 'fldN8xTDWr9wnAPzd', // → 🛎️ Asset Type
    eventType: 'fldmgva6SQHXPAMUr', // → 🧩 Event Type
    social: 'fldaBYvP6gkirDDw8', // → 📣 Social (reciprocal link-back)
  },
  teamServiceLevel_: { socialMediaVideo: 'Social Media Video' },
} as const;

// 🛎️ Creative Asset Type — the Content & Comms base's own asset-type list (distinct
// from Creative Services' table). Target of SOCIAL.links.assetType; listed in the
// portal's "raise request" Asset Type picker.
export const SOCIAL_ASSET_TYPES = {
  baseId: BASES.contentComms,
  tableId: 'tbllRbb2EN4eFyNcF',
  fields: {
    name: 'fld4DjIC4R7fBZNvL', // "Asset Type (Full title)" (multilineText, primary)
    shortName: 'fld7MaxhwLP35BEtv', // "Asset type" (singleLineText)
    status: 'fldyK7xbIBLBYTZwc', // "Status" (singleSelect)
  },
} as const;

// 🎬 Clips — Vishen's own clip list in his content base, linked to Major Videos via Source.
// Two-way synced with 🎬 Clip Suggestions (see plans/vishen-two-way-sync.md). App-generated clips
// are mirrored here (App Clip ID set); clips Vishen adds by hand flow back into Clip Suggestions.
export const VISHEN_CLIPS = {
  baseId: BASES.vishenContent,
  tableId: 'tblgGCaDK7W22UvSG',
  fields: {
    name: 'fldgUxxaSXsYeplFe', // "Name" (singleLineText, primary)
    status: 'fldrBTX1eD26lPZx1', // "Status" (singleSelect: Todo | In progress | Done)
    type: 'fldgy2VapMn4X6iti', // "Type" (singleSelect: duration buckets) — not synced (no app equivalent)
    draft: 'fldFih8GgfX0u5IU5', // "Draft" (url)
    notes: 'fldD5qTTkth62Fuyy', // "Notes" (multilineText)
    appClipId: 'fld8zMOlMzFG4Bn3v', // "App Clip ID" (singleLineText) — recId of the mirrored Clip Suggestion
  },
  links: {
    source: 'fldAyfIU17piBfHZQ', // → 🎬 Major Videos (parent), inverse of MAJOR_VIDEOS.links.clips
  },
  status_: { todo: 'Todo', inProgress: 'In progress', done: 'Done' },
} as const;
