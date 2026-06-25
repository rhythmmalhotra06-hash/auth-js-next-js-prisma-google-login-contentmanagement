-- ============================================================================
-- Mindvalley Content Production & Management System
-- Postgres schema (app system-of-record; mirrored one-way from Airtable for
-- reference data, two-way for transactional data)
--
-- NOTE: Field names below are derived from settled architecture in the
-- Blinkwork / Titus / Hackathon meeting notes. Items marked [VERIFY] must be
-- reconciled against the LIVE Airtable bases before first sync:
--   Creative Services: appFEFygXo2pRc8AR
--   Titus Video Base:  appDZnMnJGehbSOo5
--   Ads Creative Lib:  appWYOr2p4RKHf2LR
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ---------------------------------------------------------------------------
-- SYNC INFRASTRUCTURE
-- Every mirrored row keeps its Airtable provenance so reconcile is idempotent.
-- ---------------------------------------------------------------------------
-- Convention: airtable_id is the rec... id; synced_at is last pull/push.

-- ===========================================================================
-- REFERENCE DATA  (one-way: Airtable -> Postgres; team maintains in Airtable)
-- ===========================================================================

-- Employees: replaces Airtable "User" fields everywhere (per governance decision)
CREATE TABLE employees (
    id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    airtable_id     text UNIQUE,                 -- rec... from Employees table
    name            text NOT NULL,
    email           text UNIQUE,
    team            text,                         -- [VERIFY] e.g. Social Media, Content Production, Campaigns
    division        text,                         -- [VERIFY]
    is_team_lead    boolean DEFAULT false,
    employment_type text DEFAULT 'employee',      -- employee | contractor | freelancer
    active          boolean DEFAULT true,         -- "Inactive" flag in Airtable
    synced_at       timestamptz DEFAULT now()
);

-- Dimensions: 9x16, 4x5, 16x9, etc. Linked to asset types.
CREATE TABLE dimensions (
    id          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    airtable_id text UNIQUE,
    label       text NOT NULL,                    -- e.g. "9x16"
    synced_at   timestamptz DEFAULT now()
);

-- Event Types: one of the two taxonomy building blocks. Links to Brain.
CREATE TABLE event_types (
    id            uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    airtable_id   text UNIQUE,
    name          text NOT NULL,                  -- e.g. Masterclass, Mastery, States, MBU, Social Media Promotion, Pathway
    brain_program_id text,                        -- [VERIFY] link to Mindvalley Brain (Programs/Quests/Pathways/Events)
    active        boolean DEFAULT true,
    synced_at     timestamptz DEFAULT now()
);

-- DNA: requirements + feedback standards per asset type (Video/Design DNA).
CREATE TABLE dna (
    id             uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    airtable_id    text UNIQUE,
    name           text NOT NULL,
    requirements   text,                          -- production requirements
    feedback_standards text,                      -- standards for AI-assisted feedback (Phase 2)
    synced_at      timestamptz DEFAULT now()
);

-- Asset Types: the OTHER building block; teams OWN asset types (not event types).
-- Carries team_lead, preferred_editor, dimensions, DNA as references.
CREATE TABLE asset_types (
    id                uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    airtable_id       text UNIQUE,
    name              text NOT NULL,              -- e.g. "Masterclass Trailer", LEFT(name,7) prefix derives request type
    category          text,                       -- digital | print  (print = physical)
    event_type_id     uuid REFERENCES event_types(id),  -- asset type linked to an event type
    team_lead_id      uuid REFERENCES employees(id),
    preferred_editor_id uuid REFERENCES employees(id),  -- nullable: may be empty
    dna_id            uuid REFERENCES dna(id),
    active            boolean DEFAULT true,        -- "Inactive" retires outdated types
    synced_at         timestamptz DEFAULT now()
);

-- Many-to-many: an asset type can carry multiple dimensions.
CREATE TABLE asset_type_dimensions (
    asset_type_id uuid REFERENCES asset_types(id) ON DELETE CASCADE,
    dimension_id  uuid REFERENCES dimensions(id) ON DELETE CASCADE,
    PRIMARY KEY (asset_type_id, dimension_id)
);

-- ===========================================================================
-- TRANSACTIONAL DATA  (two-way sync: app is primary, push back to Airtable)
-- ===========================================================================

-- The spine: requests / tickets.
CREATE TABLE tickets (
    id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    airtable_id     text UNIQUE,                  -- null until pushed to Airtable
    title           text NOT NULL,                -- renamed from "Summary" for Dropbox searchability
    creative_brief  text,
    cta             text,                          -- Call to Action: URL / sign-up / social instruction
    positioning     text,                          -- messaging angle (replaces age/gender demo fields)
    audience        text,                          -- 'cold' | 'warm'
    due_date        date,

    event_type_id   uuid REFERENCES event_types(id),
    asset_type_id   uuid REFERENCES asset_types(id),
    assignee_id     uuid REFERENCES employees(id),

    -- Two separate status axes (Hackathon decision):
    prio_status     text,    -- manager-set, externally-facing  [VERIFY enum]
    ticket_status   text,    -- editor/designer-set, internal    [VERIFY enum]

    -- Prioritization (urgency x complexity -> score). Phase 1 manual-assisted.
    urgency         integer,                       -- algorithm input
    complexity      integer,                       -- algorithm input
    priority_score  numeric,                       -- derived; ranks the queue
    queue_rank      integer,                       -- manager-orderable position

    source          text DEFAULT 'app',            -- app | jira_migration | airtable
    created_at      timestamptz DEFAULT now(),
    updated_at      timestamptz DEFAULT now(),
    synced_at       timestamptz
);

CREATE INDEX idx_tickets_queue ON tickets (priority_score DESC, queue_rank);
CREATE INDEX idx_tickets_assignee ON tickets (assignee_id);
CREATE INDEX idx_tickets_status ON tickets (ticket_status);

-- Lifecycle state transitions (audit trail of the full lifecycle).
CREATE TABLE ticket_events (
    id          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    ticket_id   uuid REFERENCES tickets(id) ON DELETE CASCADE,
    from_state  text,
    to_state    text NOT NULL,
    actor_id    uuid REFERENCES employees(id),
    note        text,
    created_at  timestamptz DEFAULT now()
);

-- Approvals: defined approver + state per ticket.
CREATE TABLE approvals (
    id          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    ticket_id   uuid REFERENCES tickets(id) ON DELETE CASCADE,
    approver_id uuid REFERENCES employees(id),
    state       text DEFAULT 'pending',           -- pending | approved | changes_requested
    feedback    text,
    decided_at  timestamptz,
    created_at  timestamptz DEFAULT now()
);

-- Shoots / pre-production: manually linked to post-production tickets.
CREATE TABLE shoots (
    id          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    airtable_id text UNIQUE,
    title       text NOT NULL,
    status      text,                              -- [VERIFY] shoot status enum
    shoot_date  date,
    location    text,
    notes       text,
    synced_at   timestamptz DEFAULT now()
);

-- A shoot can feed multiple tickets; a ticket can draw from multiple shoots.
CREATE TABLE shoot_tickets (
    shoot_id  uuid REFERENCES shoots(id) ON DELETE CASCADE,
    ticket_id uuid REFERENCES tickets(id) ON DELETE CASCADE,
    PRIMARY KEY (shoot_id, ticket_id)
);

-- Assets: raw vs final, output location, distribution link to social calendar.
CREATE TABLE assets (
    id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    airtable_id     text UNIQUE,
    ticket_id       uuid REFERENCES tickets(id) ON DELETE SET NULL,
    kind            text NOT NULL,                 -- 'raw' | 'final'
    file_url        text,                          -- Dropbox / storage link
    distribution_url text,                         -- link to social media calendar entry
    published_at    timestamptz,
    synced_at       timestamptz DEFAULT now()
);

-- Performance: metrics feedback loop. (Deferred decision: whether these live
-- here vs the Prio table -- modeled here as the Library-side home.)
CREATE TABLE performance (
    id          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    asset_id    uuid REFERENCES assets(id) ON DELETE CASCADE,
    metric      text NOT NULL,                     -- e.g. CTR, views, spend, ROAS
    value       numeric,
    captured_at timestamptz DEFAULT now(),
    source      text                               -- e.g. Clarisights, Amplitude, manual
);

-- ===========================================================================
-- ROLE-BASED VIEWS (the standardized first columns the team mandated:
--   Title, Priority, Assigned, Ticket Status, Priority Status)
-- ===========================================================================

CREATE VIEW v_editor_queue AS
SELECT t.id, t.title, t.priority_score, t.queue_rank,
       e.name AS assigned, t.ticket_status, t.prio_status,
       at.name AS asset_type, et.name AS event_type, t.due_date
FROM tickets t
LEFT JOIN employees e   ON e.id  = t.assignee_id
LEFT JOIN asset_types at ON at.id = t.asset_type_id
LEFT JOIN event_types et ON et.id = t.event_type_id
WHERE t.ticket_status NOT IN ('Done', 'Published')   -- [VERIFY enum]
ORDER BY t.priority_score DESC NULLS LAST, t.queue_rank;

CREATE VIEW v_stakeholder_status AS
SELECT t.title, et.name AS event_type, at.name AS asset_type,
       t.prio_status, t.ticket_status,
       a.kind AS asset_stage, a.distribution_url, a.published_at
FROM tickets t
LEFT JOIN asset_types at ON at.id = t.asset_type_id
LEFT JOIN event_types et ON et.id = t.event_type_id
LEFT JOIN assets a       ON a.ticket_id = t.id;
