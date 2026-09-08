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
    dateCertainty: 'fldq4jzPRveK5KkJz', // "Date Certainty" (singleSelect) — can the due date move? (app-created 2026-08-27)
    prioStatus: 'fldFH3scvUfjnOwhg', // "Prio. Status" (singleSelect)
    ticketStatus: 'fldanOtkhcohQbnK1', // "Ticket Status" (singleSelect)
    queueRank: 'fldaG3TQINrA1c9X0', // "Priority ranking (Manual)" (rating, star, max 10)
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
    lastModified: 'fld3auCPy53ekstlF', // "App Last Modified (sync)" formula = DATETIME_FORMAT(LAST_MODIFIED_TIME(),'YYYY-MM-DD HH:mm:ss') UTC; inbound-pull cursor
    // file/link fields → assets (Stage 2a)
    rawFileUrl: 'fldySmTUdhXlv4evT', // "Raw File/URL Links" (url) → kind=raw
    outputLink: 'fldjP3qkJhbZAqh6C', // "Output link" (multilineText)
    final16x9: 'fldM3UIYvwgSEiICF', // "16x9 Final Link" (singleLineText)
    final9x16: 'fldExLdKe6qiJvtph', // "9x16 Final Link" (singleLineText)
    final4x5: 'fld4BuuOm2rnWYoIR', // "4x5 Final Link" (singleLineText)
    // NOTE: these two now carry DIFFERENT names in Airtable than the app calls them — the team
    // restructured delivery links (audited 2026-08-28). Field IDs mean data still flows to the
    // same physical columns, but the meaning has drifted:
    //   assetFolderLink -> live name "Feedback Link"            (recent values are Dropbox Replay
    //                                                            review links, not delivery folders)
    //   workingFiles    -> live name "Final Output Folder Link" (7,266 populated — this now looks
    //                                                            like the real delivery folder)
    // maybeNotifyAssetReady keys off assetFolderLink, so it may now be firing on a review link.
    // Left as-is pending Titus's confirmation of intent.
    assetFolderLink: 'fldRQRCJXQ6U4SKLq', // live: "Feedback Link"
    workingFiles: 'fldaOh1PVfKxz5FNR', // live: "Final Output Folder Link"
    //
    // DELETED FROM AIRTABLE (confirmed absent base-wide 2026-08-28, deliberate restructure):
    //   folder16x9   fldvdw7SU93YLeruF  "16x9 Folder"
    //   folder9x16   fldbTDEvPGjOjzUaW  "9x16 Folder"
    //   folder4x5    fldI88FUBPH8yzijN  "4x5 Folder"
    //   downloadLink fldrwGSNIJ3pAsO20  "Download link" (E9.1)
    // Writing any of them returned UNKNOWN_FIELD_NAME and failed the WHOLE ticket push — five
    // tickets sat permanently stuck at max attempts. Reading them was worse but quieter: a
    // missing field reads undefined -> null, so every inbound pull blanked the Postgres copy.
    // The Postgres columns and the app UI stay (the data is real and editors read it in the
    // portal); they are simply app-local now and no longer round-trip.
  },
  // "Date Certainty" option labels. The app stores the lowercase key; Airtable holds the
  // human label, so both directions go through this map rather than guessing at casing.
  certainty_: { fixed: 'Fixed launch', target: 'Target date', evergreen: 'Evergreen' },
  links: {
    eventTypes: 'fldKGGZMuyqnF7gP8', // → 🧩 Event Type
    assetTypes: 'fldPgIBDJCuJng7K1', // → 🛎️ Asset Type
    assignedCreative: 'fldalbq653hBbZvu7', // → Employees
    assignedContractor: 'fldGJvGYPC71lDGKs', // → Contractor/Freelancers (fallback assignee)
    requestedBy: 'fldgw7zf5fD2YK2EL', // → Employees (requester)
    officialCalendar: 'fldGCRBjJXuiHjgw1', // → 📆 Official Calendar
    speakers: 'fldWYaTaYW6zh7G5f', // → Authors (Speakers/Authors)
    shoots: 'fldE0BeC6oUHs7NDk', // → 📺 Shoots & Raw Assets (optional)
    clipSuggestions: 'fldP93wc2HWGsd7SZ', // → 🎬 Clip Suggestions (reverse of CLIP_SUGGESTIONS.links.ticket; auto-maintained by Airtable)
    clipsSync: 'fld8evKonHAt3jBSH', // → Clips (Sync) — set by the ticket-link reconcile so the ticket points at the synced clip (perf/rating live here)
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
    priorityRanking: 'fldNNkk3toYNOgzor', // "Priority Ranking (Manual)" (rating, star, max 10)
    rawFiles: 'fld3EaYUxVfpKyZCM', // "Raw Files" (url)
    platforms: 'fldzADgA2zZfdrXZy', // "Platfom" (multipleSelects) — note the live typo in the field name
    newPrioTicket: 'fldNvoj7UUYkHeLov', // "New Prio Ticket" (checkbox → Airtable automation raises the Prio ticket)
    // Inbound-pull cursor: "App Last Modified (sync)" formula = DATETIME_FORMAT(LAST_MODIFIED_TIME(),
    // 'YYYY-MM-DD HH:mm:ss') (UTC, watches ALL fields). Created via MCP 2026-07-09; pullShoots is
    // registered in pull-registry.ts.
    lastModified: 'fldrfHdoRnXSqp7K3',
  },
  links: {
    requestedBy: 'fldnLRFDHVXuUvUba', // "Requester" → 👬 Employees
    authors: 'fldTkTRGlh5dj7cUp', // → Authors 🧠
    eventTypes: 'fldRlBQIifsGQ4LWr', // → 🧩 Event Type
    assetTypes: 'fldqNdJkJxT0kXuxy', // → 🛎️ Creative Asset Type
    assetLibrary: 'fldLHCrWOWexguMaw', // "📚 Asset Library (WIP)" → Asset Library
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
    // Portal-OWNED, writable (locally-added fields on this synced table). /settings/asset-types
    // edits these. Measured 2026-09-08: populated on 0 of 118 asset types — nobody has ever
    // used the portal editor, which is why the DNA review always saw an empty baseline.
    dnaRequirements: 'fldogRGYGUJq6rHIX', // "DNA / Requirements" (multilineText) — E9.7, edited at /settings/asset-types
    feedbackStandards: 'fldhlP1atHGC6diSS', // "Feedback Standards" (multilineText) — E9.7
    dnaUpdatedBy: 'fldb3LMpdlPikEVKf', // "DNA Updated By" (singleLineText) — last portal editor email (E9.7 audit)

    // ⚠️ READ-ONLY (synced source). This table carries "Sync Source" (fldoAFVIeCt2IXoS3), so
    // these arrive from the upstream base and CANNOT be written back — attempting it fails the
    // whole record push, exactly like the deleted delivery-link fields noted above. These are
    // where the team's real DNA lives: "DNA" is populated on 72 asset types (verified
    // 2026-09-08) while the portal-owned pair above is empty on all of them.
    dna: 'fldK5PcSa9cw8tSj4', // "DNA" (singleLineText, ~2.5–6.7k chars) — the rule-name list per asset type
    viralityDna: 'fldJ6iykUqJWL4loZ', // "Video/Virality DNA" (singleLineText) — same shape, wider rule set
    dnaLink: 'fldN8Nrq7q480lWjx', // "DNA link" (url) — 0/72 populated
    processDnaUrl: 'fldMLua28x8DVMbQd', // "Process DNA" (url) — 0/72; Titus is filling these
    processDnaSummary: 'fldOX3USnD6o8QMp4', // "URL Summary (Process DNA)" (aiText over processDnaUrl)
  },
  // Multi-record links → resolved to our join tables in pass 2.
  links: {
    eventTypes: 'fldCDp2QUGCTbyp3v', // → Event Type
    // ⚠️ MISNAMED: fldwO5GJ7OUoeJHfL is live-named "Sub Lead", not "Team Lead". The real
    // "Team Lead" is fld0cS6VU1olTKkMM and links to the OTHER employees table
    // (tblC0gR8ZVw4WzOwx), whose recIds are disjoint from 👬 Employees — so repointing this
    // needs email-based resolution, not a one-line swap. Tracked as its own task; until then
    // "team lead" means "sub lead" in sync.ts, access.ts, data.postgres.ts and auto-assign.ts.
    teamLeads: 'fldwO5GJ7OUoeJHfL', // → 👬 Employees (LIVE NAME: "Sub Lead")
    preferredEditors: 'fldyynej9y49WBxNm', // → 👬 Employees
    dimensions: 'fld3XvOZ2lJ7foY7t', // → Dimensions
    // "Stakeholder" — who may RAISE this asset type on the intake form. Links to
    // tblC0gR8ZVw4WzOwx ("EMPLOYEES"), a SECOND HR roster whose recIds do NOT exist in
    // 👬 Employees, so these ids can never resolve through `empMap`. Joined on Work Email
    // instead (see STAKEHOLDER_DIRECTORY below). Populated on all 74 active video asset types.
    stakeholders: 'fldeIpc5s5znc3jJn', // → EMPLOYEES (tblC0gR8ZVw4WzOwx)
  },
} as const;

// The second employees roster, referenced only to resolve Stakeholder recIds → work email.
// Deliberately NOT mirrored into Postgres: we store the resolved emails on asset_types
// instead, so there's no third identity table to keep in sync.
export const STAKEHOLDER_DIRECTORY = {
  baseId: BASES.creativeServices,
  tableId: 'tblC0gR8ZVw4WzOwx', // "EMPLOYEES" — distinct from 👬 Employees (tbllP5vRon54L7Ccf)
  fields: {
    name: 'fldYQS2fz0FExZp03', // "Name"
    workEmail: 'fldpgstGVKnyxbZ88', // "Work Email" — the join key
    department: 'fldFB2jv9Y7ZBKIYi', // "Department"
  },
} as const;

// RESOLVED 2026-09-08 (was: "DNA is deferred from v1 … Revisit when DNA integration is
// designed"). The Asset Type "DNA"/"Video/Virality DNA" free-text fields are now mapped and
// synced above, and getDnaReviewConfig reads them as the baseline when the portal-owned
// fields are empty. The richer rule library still isn't ingested: tbloYIZcaC4ipPZAe
// "Video/Virality DNA" in this base holds one row per rule (Rule, Notes with Do/Don't
// blocks, Priority Level, Component, Yes/No reference images) and joins to asset types by
// NAME TEXT (fldRbfY1EUXoS8XFh matches AssetType.fullName), not by record link — that's the
// next step, not a blocker.

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
    // "Grammar Fallback" (checkbox). Created 2026-08-10. Ticked when STRATEGY_SCHEMA was over
    // the structured-output grammar cap and generation retried WITHOUT output_config. The clips
    // are fine, but the schema needs slimming — this is the durable signal that `console.warn`
    // could not be (Cloud Run runtime logs aren't greppable non-interactively). If any row has
    // it set, escalate: split generateStrategy into two parallel structured calls.
    grammarFallback: 'fldxR0Fbw17uK4zuY',
    error: 'fldmk2jHF9n0whzcu', // "Error" (multilineText)
    submittedDate: 'fld0iEsDj4xv2ABpt', // "Submitted Date" (dateTime) — set on create
    clipsAddedDate: 'fldn3QKcQCIiK6nrr', // "Clips Added Date" (dateTime) — set when clips written
    ticketDueDate: 'fldDfUyOazIWkgq98', // "Ticket Due Date" (date) — default due date for checkbox-created tickets; falls back to today+7
    sourceRecordId: 'fldaSr62jen1C1wgI', // "Source Record ID" (singleLineText) — provenance/dedupe for cross-base sync (Major Videos)
    // Inbound-pull cursor for the read-mirror: "App Last Modified (sync)" formula UTC. Created via MCP 2026-07-09.
    lastModified: 'fld1y92PoEPpLKb0j',
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
    aiSuggested: 'fld4ySW01N27CpmSs', // "AI Suggested" (singleSelect) — set to AI_SUGGESTED_TAG when the portal creates this from an approved AI suggestion
  },
  links: {
    clips: 'fldADk2WtsJawXAQy', // → 🎬 Clips (Vishen's), inverse of VISHEN_CLIPS.links.source
  },
  aiSuggested_: 'AI Suggested', // the single option written into the AI Suggested tag
} as const;

// 🎬 Videos — Vishen's complete cross-channel content log in his own base (341 rows,
// team-maintained by hand). The source of truth for the founder "Vishen's Media" section
// (/studio/media). READ-ONLY except Approval + Rating, which the portal writes back on an
// explicit Vishen tap. No inbound automation touches this table, so those writes are loop-safe.
// See plans/jul2-2026-vishen-media-section.md.
export const VISHEN_VIDEOS = {
  baseId: BASES.vishenContent,
  tableId: 'tblcqpctTr76RQsQT',
  fields: {
    name: 'fldKDeSFvDMcbQ1cD', // "Name" (singleLineText, primary)
    rating: 'fldgWdIcUe2Lu5ykj', // "Rating" (rating 1–5) — Vishen writes this
    status: 'fldGv5rhXeoIHUxBN', // "Status" (singleSelect) — 6-stage pipeline (READ)
    medium: 'fld7DTNjp6neU9bUH', // "Medium" (singleSelect) — channel/format
    product: 'fld3SylS2Nf9fEZtx', // "Product" (singleSelect) — what it promotes
    source: 'fldxt25kQecgDdQvR', // "Source" (singleSelect) — who made it (agency/producer)
    format: 'fldZbtkXqwBbIceX2', // "Format" (singleSelect) — shot style
    approval: 'fldGvNhEyTN1rfd9O', // "Approval" (singleSelect) — Vishen's sign-off; portal writes this
    publishedLink: 'fldrym088lQmqfhGg', // "Published Link" (url)
    liveDate: 'fldbdCEjsTMrQYRN7', // "Live Date" (date)
    views24h: 'flduZSKFfHMDwMp9U', // "24h Data" (multilineText) — team logs 24h perf; portal writes this
    modified: 'fldirV7fXg8q7VuVg', // "Modified" (lastModifiedTime, native ISO)
    // Inbound-pull cursor: "App Last Modified (sync)" formula = DATETIME_FORMAT(LAST_MODIFIED_TIME(),
    // 'YYYY-MM-DD HH:mm:ss') UTC. Created via MCP 2026-07-09 (formatted to match the shared pull parser).
    lastModified: 'fld4wVqxMStdAyNAg',
  },
  // singleSelect option values (write the plain name string). Status carries emojis
  // in some options — never write Status from the app (it's read-only here).
  approval_: { toReview: 'To Review', toRefine: 'To Refine', approved: 'Approved', rejected: 'Rejected', parked: 'Parked for later' },
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
    hookLine: 'fldvbSGgjKfZ9U3Oy', // "Hook Line" — Nuclear Hook Title (≤8 words) on generation
    rationale: 'fldFWsyDDe1UMLySB', // "Rationale" (multilineText)
    caption: 'fldPIon3niXYqMG73', // "Caption" (multilineText)
    format: 'fldUC9mA48dyfoxjr', // "Format" (talking_head | quote_card | broll_overlay)
    viralityScore: 'fldCA8JsTQSvM148U', // "Virality Score" (number, 1–10)
    // Viral Clip Extractor fields (app-created 2026-07-15).
    descriptiveTitle: 'flduXEvsmBOV4JkOx', // "Descriptive Title" (singleLineText)
    viralMechanism: 'fldXg3xjaQmnI7onl', // "Viral Mechanism" (singleSelect — see VIRAL_MECHANISMS)
    gates: 'flddia08JHB6jUqTF', // "Virality Gates" (multipleSelects: Controversy | Uncommon Knowledge | Humour)
    coldOpen: 'fldBtBg5lnaogVky1', // "Cold Open" (multilineText) — exact first 3 seconds
    verbatimExtract: 'fld76sSJl4P7HbH5K', // "Verbatim Extract" (multilineText) — word-for-word source
    editNotes: 'fldCGMVr8nRbYfm2n', // "Edit Notes" (multilineText) — cut/b-roll/overlay/pacing
    status: 'fldpnlfTD2UwXS8su', // "Status" (Proposed | Approved | Dismissed)
    addedDate: 'fldwmRqAJf2kcUrp3', // "Added Date" (dateTime) — set on create
    createTicket: 'fldNHVmcWAMuYVeXb', // "Create Ticket" (checkbox) — tick to convert to a ticket; convert cron unchecks it
    vishenClipId: 'fld4Qcvv1Q2biaJAO', // "Vishen Clip ID" (singleLineText) — recId of the mirrored row in Vishen's Clips table
    appTicketId: 'fldtzqljzMbnmcRCD', // "App Ticket ID" (singleLineText) — ticket id created from this clip (Airtable recId or PG uuid); reconcile key. Do not edit by hand.
    cover: 'fldKqhUWK7H3XvVnU', // "Cover" (multipleAttachments, app-created 2026-07-25) — finished 1080×1920 clip cover saved from the Cover Generator
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
    raiseRequest: 'fldrNumf2EpoRetuf', // "Raise Request (Creative)" (checkbox) — the team's manual flow: ticking it fires the live "Social checkbox → Prio ticket" automation (wflhKn1g3jVmS9jtI; script mirrored at scripts/airtable-automations/social-raise-prio-ticket.js). The portal does NOT tick this — it calls createTicket and stamps Creative Ticket ID below, which also makes the automation skip.
    clipSourceUrl: 'fldXi03EEUtKThsBv', // "Clip Source URL" (url) — engine-origin marker + grouping key (app-created 2026-06-30)
    creativeTicketId: 'fldZxIaWrFImce9H9', // "Creative Ticket ID" (singleLineText) — recId of the ticket the portal created in the Creative Services Prio queue (cross-base, so a plain id). Presence ⇒ raised. (app-created 2026-06-30)
    virality: 'fldAXQ9pnLCijAHLQ', // "Clip Virality" (number 1–10) — AI virality score (app-created 2026-07-01)
    timecode: 'flduMYNwWM6dgXRbt', // "Clip Timecode" (singleLineText) — source in/out, e.g. 12:30–13:45 (app-created 2026-07-01)
    sourceTitle: 'fldSCFY9NRsnP95V1', // "Clip Source Title" (singleLineText) — AI label (author — topic) that groups clips from the same talk (app-created 2026-07-01)
    // Inbound-pull cursor: "App Last Modified (sync)" formula = DATETIME_FORMAT(LAST_MODIFIED_TIME(),
    // 'YYYY-MM-DD HH:mm:ss') UTC, watches all fields. Created via MCP 2026-07-09.
    lastModified: 'fldyYNCIzWdMNtys5',
  },
  links: {
    shoots: 'fldFhwiHrpaCIgMlV', // → 📹 Shoots (optional source link)
    officialCal: 'fld0cCEUWfE3G4iNX', // → 📅 Official Cal (same base, COMMS_OFFICIAL_CAL). Writing it
    // auto-fills the "Name of project (from 📅 Official Cal)" lookup on the row.
    // NOTE: the "Creative Request" link (flddCgrgYAcBMFcs9) points at a synced mirror of the
    // Creative Services Prio table — records there can't be created cross-base, so the portal
    // stores the real ticket recId in creativeTicketId instead and reads status from that base.
  },
  // singleSelect option values (write the plain name string).
  status_: {
    proposal: '1: Proposal',
    approved: '2: Approved',
    ticketRaised: '2A. Ticket Raised',
    reject: '13: Reject',
  },
} as const;

// NOTE: tickets for raised social clips are created in the Creative Services Prio table
// (TICKETS, tblhrRl8GzsDMv0DD) via the app's createTicket path — NOT in this base. The
// Content & Comms 🎯 Prio table (tblojUG9wmfTru9Wc) is a read-only synced mirror of that
// Creative Services table, so it can't be written to. The Social raise picker uses the
// shared intake reference data (Creative Services event/asset types).

// 📅 Official Cal — the Content & Comms base's own campaign calendar (distinct from the
// Creative Services OFFICIAL_CALENDARS above). The 📣 Social table links to this table, so
// Glen can tag which calendar entry a batch of generated clips belongs to.
export const COMMS_OFFICIAL_CAL = {
  baseId: BASES.contentComms,
  tableId: 'tbl3PkmIprAMhU4AI',
  fields: {
    name: 'fldtgdoPTbrEPJ3Mx', // "Name of project" (primary, multilineText)
    status: 'fldFBbjSsM2G0bxo8', // "Status" (singleSelect)
    startDate: 'fldWepC3ZFCPjKqIb', // "Start date" (date)
    endDate: 'fldLgI8HMVqw6Kjdd', // "End Date" (date)
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
    status: 'fldrBTX1eD26lPZx1', // "Status" (singleSelect) — mirrored from the ticket's Ticket Status (see clip-ticket-sync)
    type: 'fldgy2VapMn4X6iti', // "Type" (singleSelect: duration buckets) — mirrored from the ticket's Asset Type
    draft: 'fldFih8GgfX0u5IU5', // "Draft" (url)
    notes: 'fldD5qTTkth62Fuyy', // "Notes" (multilineText)
    appClipId: 'fld8zMOlMzFG4Bn3v', // "App Clip ID" (singleLineText) — recId of the mirrored Clip Suggestion
    aiSuggested: 'fldshy239ELkRKxmk', // "AI Suggested" (singleSelect) — set to AI_SUGGESTED_TAG when the portal creates this from an approved AI clip suggestion
  },
  links: {
    source: 'fldAyfIU17piBfHZQ', // → 🎬 Major Videos (parent), inverse of MAJOR_VIDEOS.links.clips
    editorAssigned: 'fldlpgkvMiXsPoJKD', // "Editor Assigned" → Vishen-base 👥 EMPLOYEES (VISHEN_EMPLOYEES); mirrored from the ticket's assigned creative, matched by Work Email
  },
  // singleSelect option names — MUST mirror the live field's choices exactly (the API token can't
  // create options, so an unknown name fails the write). The team owns this field's review workflow;
  // the app only ever WRITES the early-lifecycle values (todo/inProgress/applyFeedback) — see
  // APP_MANAGED_VISHEN_STATUSES in vishen-sync.ts. The rest are human-owned and read-only to the app.
  status_: {
    todo: 'Todo',
    inProgress: 'In progress',
    reviewMarishaGareth: 'Review - Marisha/Gareth', // human review lane (team-owned)
    marishaGarethApproved: 'Marisha/Gareth Approved', // human verdict (team-owned)
    applyFeedback: 'Apply Feedback',
    done: 'Done',
    onHold: 'On Hold', // human-owned
    rejected: 'Rejected',
    published: 'Published',
  },
  type_: { reel: 'Reel (Under 3 mins)', shortForm: 'Short Form (Under 7 mins)', youtubeClip: 'Youtube Clip (5 to 20 mins)' },
  aiSuggested_: 'AI Suggested', // the single option written into the AI Suggested tag (same on Major Videos)
} as const;

// 👥 EMPLOYEES — Vishen's own content-base employee directory. The Vishen Clips "Editor Assigned"
// link points here, so mirroring a ticket's assigned creative (which lives in the Creative Services
// EMPLOYEES table, a DIFFERENT base) requires a cross-base match by Work Email.
export const VISHEN_EMPLOYEES = {
  baseId: BASES.vishenContent,
  tableId: 'tblvpsk2UzHHVkNjF',
  fields: {
    name: 'fldPzYAzUnJjTB30C', // "Name" (multilineText, primary)
    email: 'fldueWTRT1DfteQts', // "Work Email"
  },
} as const;

// Clips (Sync) — the read-only Airtable sync mirror of Vishen's 🎬 Clips, living inside the
// Creative Services base. Carries the live clip signals (Rating, "24 Data", Released, Feedback).
// The ticket-link reconcile (lib/media/ticket-links.ts) matches a mirror row to an app clip via
// "App Clip ID" (a synced copy of VISHEN_CLIPS.appClipId = the Clip Suggestion recId) and links
// it to the Prio ticket.
//
// RESOLVED 2026-08-10: "App Clip ID" IS in the sync's field set and resolves — verified live,
// populated on ~100 of 129 mirror rows. The reconcile's Clips (Sync) step is NOT a no-op. (The
// previous note here said the opposite and was carried forward as an open action item for a
// month after it stopped being true.)
export const CLIPS_SYNC = {
  baseId: BASES.creativeServices,
  tableId: 'tblRXoSfDBFnpYk7G',
  // Matched by field NAME in filterByFormula (Airtable formulas resolve names, not ids), so the
  // reconcile works the moment the field is added to the sync — no field id needed here.
  appClipIdName: 'App Clip ID',
  // Outcome signals for the clip-learning loop (lib/media/clip-signals.ts). Re-verified live
  // 2026-08-10: all five carry real values (Rating 2–5, Released "VL Insta"/"MV Insta",
  // "24 Data" view counts, Feedback Loom/Docs links), so the weekly clip-learn cron is reading
  // genuine signal — its {"proposed":0} responses mean "no new rule worth proposing", not
  // "no data". Do not re-file this as an open Airtable task.
  fields: {
    appClipId: 'fldnKMR6Ddc7yrg1z', // "App Clip ID" (singleLineText) = mirrored Clip Suggestion recId
    rating: 'fldZ2a6sfhmVOAyot', // "Rating" (rating) — performance proxy
    released: 'fldjluotR0yrj3uBk', // "Released" (multipleSelects) — non-empty ⇒ the clip was released
    notes: 'fld0EsWNWnue7getv', // "Notes" (multilineText) — qualitative feedback text
    data24: 'fldHIilibHMKKCASC', // "24 Data" (multilineText) — 24-hour performance numbers
    feedbackUrl: 'fld4M8AKRn7WSFz42', // "Feedback" (url) — Loom review link (presence only; not text)
  },
  links: {
    prioTicket: 'fldBpNRq3e0oXka5F', // → 🎯 Prio: Creatives Requests (New) (reverse of TICKETS.links.clipsSync)
  },
} as const;
