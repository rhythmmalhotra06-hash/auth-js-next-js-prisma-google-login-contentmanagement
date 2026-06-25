# Productization — Content Ops as a Blinkwork app

> How the Creative Services system stops being a Mindvalley-internal tool and
> becomes an **app others can enable** on the Blinkwork platform — the same way
> Page Builder, Ad Campaign Manager, and OKR Manager are enable-able apps on a
> shared core.

This is an architectural shift from the earlier standalone spec
(`CLAUDE.md` + `schema.sql` assumed Airtable→Postgres mirror). Read this as the
revision that productizes it.

---

## What "an app" means in Blinkwork

From the platform overview, an app is NOT a standalone codebase with its own DB
and auth. An app is:

1. **A code manifest** that declares what it needs — which connectors, which
   brains, what it deploys, what permissions it requires.
2. **Enabled + configured per entity** (company). The same app, turned on by
   many companies, each scoped to its own data — multi-tenant by construction.
3. **Runs on the shared core** — identity/permissions, connectors, the agent,
   and organizational memory (the brain). It reads from and writes back to the
   brain.
4. **All API access over MCP**, credentials server-side. Skills carry no secrets
   — they're the know-how, not the keys.

So "make it a product others use" = repackage Content Ops as one of these
manifested, enable-able apps. The intelligence layer above then comes largely
for free, because it runs on the brain every other app shares.

---

## The core reframe: brain nodes instead of a private schema

The earlier schema modeled event_types, asset_types, assets, performance as
Postgres tables. Blinkwork already has these as **brain node types**:

| Content Ops concept        | Maps to brain node        |
|----------------------------|---------------------------|
| Asset (raw/final)          | Asset                     |
| Performance metric         | Metric / KPI              |
| Event type / campaign      | Event / Project / Initiative |
| Editor / team lead / requester | Person                |
| Channel (IG, TikTok, Meta) | Channel                   |
| Program / Quest / Pathway  | Product / Offering        |
| DNA requirement / brand rule | Rule / Principle        |
| "What worked" learning     | Insight                   |
| Audience (cold/warm)       | Customer Avatar           |
| Prioritization decision    | Decision                  |

What stays app-specific (not a brain node): the **transactional workflow state**
— tickets, queue rank, ticket_status/prio_status, approvals. Those are
operational records the app owns. The *nouns* live in the brain; the *workflow*
lives in the app. This split is the key design decision.

Airtable's role in this model: it remains the **editing surface** for the team
that likes it (taxonomy maintenance), wired in as a **connector** — a source
in. It is no longer the system of record; the brain is. Companies that don't use
Airtable enable a different source connector (or edit in-app).

---

## Anatomy of the Content Ops app manifest

What the manifest declares (conceptual — match the real manifest format in the
repo's apps framework):

- **Connectors required**
  - a taxonomy/source connector (Airtable for MV; configurable per entity)
  - performance connectors (Clarisights / Amplitude / Ahrefs, or generic ad
    connectors) — for the intelligence layer
  - a distribution connector (social calendar / publishing target)
- **Brains it binds to** — the company brain (for Person, Product, Channel,
  Insight nodes) and optionally a topical "creative" brain (DNA, brand rules).
  Binding sandboxes the app to exactly that knowledge.
- **Deploy targets** — where finished assets/links go (e.g. social calendar).
- **Permissions / roles** — manager, editor, stakeholder, requester (see below).
- **Skills it ships** — `/intake`, `/prioritize`, `/draft-brief`,
  `/asset-insight`, `/dna-review` — the capabilities, carrying no secrets.

When another company enables the app, they configure their own connectors and
brains. Same code, their data, their brand — multi-tenant with no cross-entity
leakage (the overview's explicit guarantee).

---

## How others use it (the multi-tenant story)

A different company — say a small agency — enables Content Ops:
1. Turns the app on for their entity.
2. Configures connectors: their asset source, their ad accounts, their
   publishing destination.
3. Binds it to their brain (their people, products, brand rules).
4. Their team uses the same four role-based surfaces (queue / editor /
   stakeholder / library) and the same intelligence layer — now reasoning over
   *their* assets and *their* performance data.

Nothing about the workflow logic, the prioritization algorithm, the version
stacking, or the brief generation is Mindvalley-specific. The taxonomy
(event types, asset types) is *data they populate*, not code. That's what makes
it a product rather than an internal build.

Two ways in, same as every Blinkwork app: the hosted **side chat** (light model,
everyday asks) or **Claude Code over MCP** (frontier model, serious work) — both
authenticated to the entity, permission-scoped, no API keys on the user's
machine.

---

## Roles map to platform permissions

The four mockup surfaces become role-gated views, enforced by the platform's
identity/permissions layer (not a sidebar toggle):

| Role        | Sees                                   | Can do                         |
|-------------|----------------------------------------|--------------------------------|
| Manager     | Prioritization queue, all tickets      | reorder, assign, set prio_status, approve |
| Editor      | Personal queue, assigned tickets       | set ticket_status, upload assets |
| Stakeholder | Status & performance (read-only)       | view, comment (free — unlimited)|
| Requester   | Intake form                            | submit requests                |

The free unlimited stakeholder/commenter role is the Ziflow pattern and the
reason per-seat cost isn't a constraint — it's a platform permission tier, not a
license SKU.

---

## What this changes vs. the earlier spec

- **System of record:** brain (not Postgres mirror).
- **Airtable:** a connector / editing surface (not the source of truth).
- **Auth:** platform identity/permissions (not app-built auth).
- **API access:** all over MCP, credentials server-side (not direct API calls).
- **Intelligence:** runs on the shared brain, so insight/brief/conversational
  capabilities are native, not bolted on.
- **Reusability:** a manifest other entities enable, not a one-off deployment.

What stays valid from the earlier work: the workflow decisions (event→asset
chain, two status axes, queue model, raw/final, the five-column header), the
prioritization algorithm, and all the UI mockups. Those are the app's product
surface regardless of where data lives.

---

## Build path

1. Confirm the real apps-framework manifest format + brain-node API in the repo.
2. Model the nouns as brain nodes; keep tickets/queue/approvals as app state.
3. Wire Airtable as the MV taxonomy connector (one-way in for reference data).
4. Build the four role surfaces from `packages/ui` (shadcn/CVA) in `apps/web`.
5. Ship the skills (`/intake`, `/prioritize`, `/draft-brief`, `/asset-insight`).
6. Layer intelligence (intelligence-layer.md), propose-only, on the brain.
7. Generalize: prove a second entity can enable it with their own connectors.

> The earlier `CLAUDE.md`/`schema.sql` remain useful as the workflow + data-shape
> reference. This document supersedes their *architecture* (standalone → Blinkwork
> app on the shared brain).
