# Vendor Manager — App 4 for BlinkWork

## Context

BlinkWork already has 3 apps (Page Builder, Ad Campaign Manager, OKR Manager) on its platform. The ask is to add a **Vendor Manager** as the fourth app, porting the concepts and business rules from the existing **OneFlow** vendor portal (an Airtable-backed Next.js app at `/auth-js-next-js-prisma-google-login-vendorportal`). 

OneFlow is Mindvalley's live spend & vendor governance system covering the full vendor lifecycle: spend request → multi-level approval → governance onboarding (Privacy/InfoSec/Legal/IT/Finance/HRBP) → vendor directory → updates → offboarding. The goal is to bring this into BlinkWork as a first-class app — benefiting from the platform's org memory (so vendor learnings compound), AI skills (RFP drafting, vendor scoring, compliance checking), MCP tooling, and unified identity/permission model.

**Why now:** OneFlow works but it's a separate system with no AI layer and no institutional memory. BlinkWork's platform makes vendor decisions smarter over time.

---

## What BlinkWork Already Provides (Reuse)

| Platform Service | How Vendor Manager Reuses It |
|---|---|
| **Identity & Permissions** | Add 12 `vendors.*` permission keys to the existing `PERMISSIONS` constant and Permission seed. Named roles (vendor-approver, governance-reviewer) use the existing `NamedRole` model. |
| **Apps Framework** | Register `vendor-manager.manifest.ts` — manifest-only addition, zero framework code change. |
| **Org Memory (TIE)** | Create a `vendors` topical brain. Vendor decisions, evaluations, and RFP outcomes are ingested fire-and-forget. Skills read from this brain. |
| **MCP Server** | Inject 5 new handlers into the existing `ToolRegistry.all()`. Follows the identical `SkillsListHandler` pattern. |
| **Decision state machine** | `VendorDecision` model mirrors `CampaignDecision` (Proposed → Approved → Acted → Reverted, `authorizationQuote` required). |

---

## Vendor Lifecycle (from OneFlow → BlinkWork)

```
SPEND REQUEST  →  APPROVAL CHAIN  →  GOVERNANCE REVIEW  →  ACTIVE
   (any user)      L1 Mgr → L2 Exec → L3 CEO (if ≥$1k)   O1–O6 sequential

    ↓                                                          ↓
OFFBOARDING ←──────────────────── UPDATE REQUEST ──────────── ┘
 (effective date auto-closes)      (vendor owner → exec → reviewer)
```

**Key business rules to preserve:**
1. **No self-approval**: if requester = L1 manager, skip to L2
2. **CEO threshold**: ≥$1,000 OR vendor type = `FILMING_PRODUCTION` (configurable in app config schema)
3. **Rejection = permanent** (Spend + Updates). Requester must create a new request.
4. **Return = stays alive**. Prior governance approvals are held; requester edits + resubmits.
5. **Governance reviewers can Return but never Reject** (only `approve` or `return_with_comment`)
6. **Vendor type drives governance routing** (not spend amount): SaaS/Agency/Filming → O1 Privacy + O2 InfoSec + O3 Legal + O4 IT + O5 Finance. Physical Goods → O4 IT + O5 Finance. Staff Training → O6 HRBP only.
7. **Offboarding parallel closeout**: Finance, IT, Legal confirmed independently; auto-closes at effective date.
8. **Draft auto-abandoned** after 48h (configurable).

---

## 1. App Manifest

**File:** `apps/api/src/apps/manifests/vendor-manager.manifest.ts`  
**Complexity: S** | **Blocked on:** Apps Framework epic (`EnabledApp`/`AppConfig` models)  
**Workaround until then:** Treat as always-enabled; skip manifest registration, add `orgId` as `String` placeholder.

```typescript
export const vendorManagerManifest = {
  key: 'vendor-manager',
  displayName: 'Vendor Manager',
  configSchema: z.object({
    ceoApprovalThresholdUsd: z.number().int().min(0).default(1000),
    ceoApprovalVendorTypes: z.array(z.string()).default(['FILMING_PRODUCTION']),
    defaultCurrency: z.string().length(3).default('USD'),
    draftAbandonmentHours: z.number().int().default(48),
    renewalAlertDaysBefore: z.number().int().default(90),
  }),
  permissions: [/* all 12 vendors.* keys */],
  skills: ['vendor-score', 'rfp-draft', 'vendor-risk-assess', 'vendor-compliance-check'],
  coreServices: { memoryScopes: ['vendors'], agent: true },
} satisfies AppManifest;
```

---

## 2. Permissions

**File:** `packages/shared/src/constants/permissions.ts` — extend the existing `PERMISSIONS` constant.

```typescript
VENDORS_VIEW_DIRECTORY: 'vendors.view_directory',
VENDORS_MANAGE:         'vendors.manage',
VENDORS_APPROVE_L1:     'vendors.approve_l1',
VENDORS_APPROVE_L2:     'vendors.approve_l2',
VENDORS_APPROVE_L3:     'vendors.approve_l3',
VENDORS_REVIEW_PRIVACY: 'vendors.review_privacy',
VENDORS_REVIEW_INFOSEC: 'vendors.review_infosec',
VENDORS_REVIEW_LEGAL:   'vendors.review_legal',
VENDORS_REVIEW_IT:      'vendors.review_it',
VENDORS_REVIEW_FINANCE: 'vendors.review_finance',
VENDORS_REVIEW_HRBP:    'vendors.review_hrbp',
VENDORS_FINOPS:         'vendors.finops',   // full pipeline view + tasks
```

Seed these 12 keys into `packages/database/prisma/seed.ts` alongside the existing permission seeds.

---

## 3. Prisma Data Models

**File:** `packages/database/prisma/schema.prisma`  
**Complexity: L** | **Unblocked — build now**

All models follow prisma-lint rules: `PascalCase` singular, `@@map("plural_snake_case")`, `id/createdAt/updatedAt` on every model, `@@index` on every relation field.

### New Enums

```prisma
enum VendorType { SAAS AGENCY FILMING_PRODUCTION PHYSICAL_GOODS STAFF_TRAINING OTHER @@map("vendor_types") }
enum VendorStatus { ACTIVE PENDING_ONBOARDING OFFBOARDING_IN_PROGRESS INACTIVE @@map("vendor_statuses") }
enum VendorRequestType { SPEND_REQUEST CONTRACT_RENEWAL SEAT_COUNT_CHANGE OWNER_CHANGE PAYMENT_DETAILS_CHANGE SCOPE_CHANGE ACCESS_CHANGE OFFBOARDING OTHER_UPDATE @@map("vendor_request_types") }
enum VendorRequestStatus { DRAFT IN_REVIEW RETURNED APPROVED REJECTED COMPLETED ABANDONED @@map("vendor_request_statuses") }
enum ApprovalStepLevel { L1_MANAGER L2_EXECUTIVE L3_CEO GOVERNANCE_PRIVACY GOVERNANCE_INFOSEC GOVERNANCE_LEGAL GOVERNANCE_IT GOVERNANCE_FINANCE GOVERNANCE_HRBP FINOPS @@map("approval_step_levels") }
enum ApprovalStepStatus { PENDING APPROVED REJECTED RETURNED SKIPPED DELEGATED @@map("approval_step_statuses") }
enum VendorDecisionState { PROPOSED APPROVED ACTED REVERTED @@map("vendor_decision_states") }
```

### Core Models

**`Vendor`** — master vendor record:
- `id, name, type (VendorType), category, description?, website?, vendorEmail?, status (VendorStatus), ownerId, orgId, annualBudgetUsd (Decimal?), currency, trustCenterUrl?, privacyPolicyUrl?, hasIso27001?, hasSoc2?, seatCount?, itAccessDetails?, notes?, metadata (Json?)`
- Relations: `owner User`, `requests VendorRequest[]`, `contracts VendorContract[]`

**`VendorRequest`** — covers all 4 request types in one model:
- `id, vendorId?, requestType (VendorRequestType), status (VendorRequestStatus), requestedById, orgId`
- Spend fields: `vendorName, vendorType, vendorCategory, description, estimatedAnnualValueUsd (Decimal), currency, recurrenceType, paymentMethod?, startDate?, endDate?, requiresSystemAccess, threeVendorsCompared`
- Onboarding supplement: `trustCenterUrl?, privacyPolicyUrl?, hasIso27001?, contractAttachmentUrl?, vendorEmail?, itAccessDetails?, seatCount?`
- Lifecycle: `returnComment?, abandonedAt?, submittedAt?, completedAt?`
- Relations: `vendor Vendor?`, `requestedBy User`, `approvalSteps VendorApprovalStep[]`, `decision VendorDecision?`

**`VendorApprovalStep`** — flat table, one row per step in the chain:
- `id, vendorRequestId, level (ApprovalStepLevel), sequence (Int), status (ApprovalStepStatus), assignedToId?, actedById?, delegatorId?, comment?, actedAt?`
- `@@unique([vendorRequestId, level, sequence])`
- Design rationale: flat table (not linked-list) — current step = `WHERE status=PENDING ORDER BY sequence LIMIT 1`. Prior approvals clearly visible. Simple reset on Return.

**`VendorContract`**:
- `id, vendorId, orgId, title?, attachmentUrl?, startDate?, endDate?, autoRenews, annualValueUsd (Decimal?), currency, notes?`

**`VendorDecision`** — mirrors `CampaignDecision` exactly:
- `id, vendorRequestId @unique, state (VendorDecisionState), authorizationQuote?, actedById?, actedAt?, revertedById?, revertedAt?, revertNote?`

**`VendorOffboarding`** — detail record for offboarding requests:
- `id, vendorRequestId @unique, reason, effectiveDate, hasOpenInvoices, hasSystemAccess, hasPiiData, contractDetails?, closeoutChecklist (Json?)`
- Parallel closeout: `financeConfirmedAt?, financeConfirmedById?, itConfirmedAt?, itConfirmedById?, legalConfirmedAt?, legalConfirmedById?, autoClosedAt?`

---

## 4. NestJS Domains

**Complexity: XL** | **Unblocked — build now**  
Add all three modules to `apps/api/src/app.module.ts` imports.

### Split: Three Domains

```
apps/api/src/domains/
├── vendors/              # Vendor directory CRUD + scoped queries
├── vendor-requests/      # Lifecycle: create, submit, return, withdraw + approval chain builder
└── vendor-approvals/     # Step actions: approve, reject, return, delegate + decision state machine
```

Each follows the strict domain structure: `controllers/ services/ repositories/ routes/ models/ __tests__/ *.module.ts`

### Domain 1: `vendors/`

Key endpoints (all prefixed `/api/v1`):

| Method | Route | Permission |
|---|---|---|
| GET | `/vendors` | `vendors.view_directory` (results scoped by role) |
| GET | `/vendors/:id` | `vendors.view_directory` |
| GET | `/vendors/expiring` | `vendors.view_directory` |
| POST | `/vendors` | `vendors.manage` |
| PATCH | `/vendors/:id` | `vendors.manage` |

Directory scoping in `VendorScopeService`: `manage`-only = own vendors only; `approve_l1` = department; `approve_l2`+ = all.

### Domain 2: `vendor-requests/`

Key endpoints:

| Method | Route | Permission |
|---|---|---|
| GET | `/vendor-requests` | `vendors.manage` |
| GET | `/vendor-requests/:id` | `vendors.manage` |
| POST | `/vendor-requests` | `vendors.manage` (creates draft) |
| PATCH | `/vendor-requests/:id` | `vendors.manage` (edit draft/returned) |
| POST | `/vendor-requests/:id/submit` | `vendors.manage` |
| POST | `/vendor-requests/:id/withdraw` | `vendors.manage` |

**`ApprovalChainBuilderService`** — called on `submit`, creates `VendorApprovalStep` rows:

```
Phase 1 (Spend):
  sequence 1: L1_MANAGER      — if requester != their own manager
  sequence 2: L2_EXECUTIVE    — always
  sequence 3: L3_CEO          — if value >= configThreshold OR vendorType in ceoTypes

Phase 2 (Governance, after Phase 1 APPROVED):
  Routing driven by VendorType + app configSchema:
  SAAS/AGENCY/FILMING_PRODUCTION → O1 Privacy, O2 InfoSec, O3 Legal, O4 IT, O5 Finance
  PHYSICAL_GOODS                 → O4 IT, O5 Finance
  STAFF_TRAINING                 → O6 HRBP only
  All finish with FINOPS (final completion step)

Phase 3/4 (Update/Offboarding):
  sequence 1: L1_MANAGER (vendor owner)  — if requester != owner
  sequence 2: L2_EXECUTIVE
  sequence 3: relevant GOVERNANCE_* by update type
```

### Domain 3: `vendor-approvals/`

Key endpoints:

| Method | Route | Permission |
|---|---|---|
| GET | `/vendor-approvals/queue` | (dynamic — any `vendors.approve_*` or `vendors.review_*`) |
| GET | `/vendor-approvals/queue/finops` | `vendors.finops` |
| POST | `/vendor-approvals/:stepId/approve` | (resolved from `step.level` at service layer) |
| POST | `/vendor-approvals/:stepId/reject` | (same; governance levels BLOCKED from this action) |
| POST | `/vendor-approvals/:stepId/return` | (same) |
| POST | `/vendor-approvals/:stepId/delegate` | `vendors.approve_l3` |

**Business rules enforced in service (not guards):**
- `reject` action: blocked if `step.level` is any `GOVERNANCE_*` level
- `reject` action: sets `request.status = REJECTED`, all remaining steps `SKIPPED` — permanent
- `return` action: sets `request.status = RETURNED`, all PENDING steps stay PENDING (approved ones held)
- Self-approval skip: if `step.assignedToId == request.requestedById && step.level == L1_MANAGER` → auto-set `SKIPPED`, advance to next step on submit

**`VendorDecisionService`** — mirrors `CampaignDecisionService`:
- On final FINOPS step approved: `VendorDecision { state: PROPOSED }`
- On FinOps task completion: `APPROVED`
- On vendor created/updated: `ACTED` (requires `authorizationQuote`)
- `REVERTED`: manual action, `authorizationQuote` required

---

## 5. Zod Schemas

**File:** `packages/shared/src/schemas/vendor.schema.ts` (new file)  
**Complexity: M** | **Unblocked**

Export from `packages/shared/src/schemas/index.ts` alongside existing exports.

Key schemas:
- `vendorTypeSchema`, `vendorRequestTypeSchema` (enum schemas)
- `createVendorSpendRequestSchema` — intake form validation
- `vendorOnboardingSupplementSchema` — Phase 2 additional fields
- `approvalActionSchema` (approve), `returnWithCommentSchema` (mandatory comment), `delegateApprovalSchema`
- `createOffboardingRequestSchema`
- `vendorDirectoryQuerySchema` — filter + pagination
- MCP tool input schemas: `vendorsSearchInputSchema`, `vendorsGetInputSchema`, `vendorsRequestInputSchema`

---

## 6. Web App Surfaces

**Complexity: L** | **Unblocked**

### Route Tree

```
apps/web/src/app/vendors/
├── layout.tsx                     # permission gate (vendors.view_directory required)
├── directory/page.tsx             # Vendor directory, role-scoped
├── requests/
│   ├── page.tsx                   # My Requests (all phases)
│   ├── new/page.tsx               # Multi-step spend request form
│   └── [id]/
│       ├── page.tsx               # Detail: timeline, current step, action if applicable
│       └── edit/page.tsx          # Edit draft/returned request
├── approvals/
│   ├── page.tsx                   # My Approval Queue
│   └── [stepId]/page.tsx          # Step detail + approve/reject/return action
├── pipeline/page.tsx              # FinOps: full pipeline across all stages
└── [vendorId]/page.tsx            # Vendor profile + contracts + request history
```

### Components

```
apps/web/src/components/vendors/
├── vendor-status-badge.tsx
├── request-form.tsx               # Multi-step form with draft auto-save
├── approval-step-card.tsx         # Step row in timeline
├── approval-action-dialog.tsx     # Modal for reject/return (mandatory comment)
├── governance-routing-table.tsx   # Visual: which reviewers triggered for vendor type
├── offboarding-form.tsx
├── contract-renewal-alert.tsx     # Banner for 90-day renewal warning
└── vendor-detail-tabs.tsx
```

**Sidebar additions** (`apps/web/src/components/shell/sidebar.tsx`):
```typescript
{ label: 'Vendor Manager', items: [
  { label: 'Directory',   href: '/vendors/directory', gate: 'vendors.view_directory' },
  { label: 'My Requests', href: '/vendors/requests',  gate: 'vendors.manage' },
  { label: 'Approvals',   href: '/vendors/approvals', gate: 'vendors.approve_l1' },
  { label: 'Pipeline',    href: '/vendors/pipeline',  gate: 'vendors.finops' },
]}
```

**New hook:** `apps/web/src/hooks/use-vendors.ts` — TanStack Query hooks following `use-roles.ts` pattern.  
**API client extension:** `apps/web/src/lib/api-client.ts` — add `vendors` namespace following existing `invitations`, `roles`, `tokens` namespaces.

---

## 7. MCP Tools

**Complexity: M** | **Unblocked**

New handler files under `apps/api/src/domains/mcp/handlers/`. Each follows the exact `SkillsListHandler` pattern: `@Injectable()` class, `toolDefinition()` method returning `ToolDefinition`, `requiredPermissions[]`, Zod `schema`, and a `private async handle()`.

| Tool Name | Schema | Permission | What It Does |
|---|---|---|---|
| `vendors.search` | `vendorsSearchInputSchema` | `vendors.view_directory` | Paginated vendor directory, role-scoped |
| `vendors.get` | `vendorsGetInputSchema` | `vendors.view_directory` | Full vendor profile + contracts + open requests |
| `vendors.request` | `vendorsRequestInputSchema` | `vendors.manage` | Submit spend/update/offboard request; returns approval chain |
| `vendors.my_approvals` | filter enum | any `vendors.approve_*` | List pending steps assigned to caller |
| `vendors.approve_step` | stepId + action + comment? | resolved per step.level | Approve/reject/return a step; enforces business rules |

**Wiring:** Inject all 5 handlers in `tool-registry.ts` constructor + spread into `all()`. Add providers in `mcp.module.ts`.

---

## 8. Skills

**Complexity: M** | **Partially blocked** (TIE contract needed for memory reads)  
Skills are versioned bundles published via `skills.publish` MCP tool. Bind to `vendors` brain via `AppBrainAccess`.

| Skill Slug | Model Tier | Memory Access | What It Does |
|---|---|---|---|
| `vendor-score` | Sonnet | `vendors` brain read + write | Scores vendor 0–100 across security/compliance/financial/operational. Ingests evaluation back to brain. |
| `rfp-draft` | Sonnet / Opus (complexity flag) | `vendors` brain read | Drafts RFP from requirements + past vendor data. Uses pricing benchmarks + common pitfalls from memory. |
| `vendor-risk-assess` | Sonnet | `vendors` + `legal` brain read | Full risk report: financial, operational, security, compliance, contractual. Severity ratings + mitigations. |
| `vendor-compliance-check` | Sonnet | `vendors` brain read | Checks vendor against org compliance requirements. Surfaces gaps. Pre-briefs governance reviewers. |

**Stub approach before TIE:** Skills return structured output from the vendor profile alone (no memory reads), log a `[TIE not yet connected]` note, and are updated once TIE contract lands.

---

## 9. Org Memory Integration

**Complexity: M** | **Blocked on TIE contract**  
**File:** `apps/api/src/domains/vendors/services/vendor-memory.service.ts` (starts as a no-op stub)

**What gets ingested into the `vendors` brain:**

| Event | Ingested Content |
|---|---|
| Governance review completed | Reviewer decision + vendor type + duration (no PII) |
| Vendor onboarding complete | Vendor profile summary + compliance status |
| VendorDecision → ACTED | Outcome, vendor type, spend amount |
| Contract added | Renewal date, annual value, vendor type |
| Vendor offboarding complete | Offboarding reason + closeout duration |
| `vendor-score` run | Scoring output + dimensions (for calibration) |

**What is NOT ingested:** Approval comments (PII risk), vendor email/contact details, draft requests, contract attachment bytes.

**Ingestion pattern:** Fire-and-forget calls from `VendorRequestsService` at lifecycle transition points. Never blocks the primary operation.

---

## 10. OneFlow Migration

**Complexity: M** | **Unblocked — can start anytime**

**Recommended: 3-phase, not big-bang**

**Phase 1 (Weeks 1–4):** BlinkWork Vendor Manager live for new requests. OneFlow continues for in-flight. No data migration yet.

**Phase 2 (Week 3–4, background):** One-time import script at `scripts/migrate-oneflow-vendors.ts`:
- Reads Airtable `🧳 Vendors` table via API
- Maps: vendor name → `Vendor.name`, vendor type → `VendorType` enum, DRI email → `Vendor.ownerId`, contract end date → `VendorContract.endDate`, annual value → `Vendor.annualBudgetUsd`
- Creates `Vendor` records with `status = ACTIVE` for approved vendors
- Creates `VendorRequest` + `VendorDecision { state: ACTED }` for completed historical approvals
- Skips draft/in-flight records (those stay in OneFlow until resolved)
- Idempotent (upsert by vendor name + orgId), logs a report

**Phase 3 (Week 5+):** OneFlow read-only archive. Airtable base preserved for audit.

---

## 11. Implementation Sequence

### What Can Be Built Now (No Blockers) — ~70% of the feature

| Sprint | Work |
|---|---|
| **1** | Prisma enums + 6 models + migration. Seed 12 permission keys. `vendor.schema.ts` Zod schemas. `vendors/` domain CRUD. Wire into `app.module.ts`. |
| **2** | `vendor-requests/` domain + `ApprovalChainBuilderService`. `vendor-approvals/` domain with full action handlers + decision state machine. Unit tests for all edge cases (self-approval skip, CEO threshold, governance routing, governance-cannot-reject). |
| **3** | Web route tree. `VendorDirectoryPage` + `MyRequestsPage` + `NewRequestForm`. `ApprovalsQueuePage` + `ApprovalActionDialog`. Sidebar additions. `use-vendors.ts` hook. API client `vendors` namespace. |
| **4** | 5 MCP handler files. Wire into `tool-registry.ts` + `mcp.module.ts`. Handler tests. |
| **5** | Skills 1–4 (vendor-score, rfp-draft, vendor-risk-assess, vendor-compliance-check). `VendorMemoryService` stub. Draft abandonment job + contract renewal alert job in `apps/api/src/jobs/`. |

### What Blocks on Platform Epics

| Feature | Blocks On | Workaround |
|---|---|---|
| App manifest + `EnabledApp` check | Apps Framework epic | Treat as always-enabled; add manifest file, skip framework wiring |
| `orgId` as entity FK | Identity Entity/Membership epic | Use `orgId: String` placeholder; replace FK when Entity model lands |
| TIE memory ingestion | TIE contract (pending Fauzaan) | `VendorMemoryService` is a no-op stub; no-op + log until TIE ready |
| Skills memory reads | TIE contract | Skills work from vendor profile alone until TIE connects |
| FinOps Pipeline → Offboarding parallel close | Nothing blocked, but depends on Sprint 2 | Sequential build |

---

## Critical Files

| File | Change |
|---|---|
| `packages/database/prisma/schema.prisma` | Add 7 enums + 6 models |
| `packages/database/prisma/seed.ts` | Seed 12 `vendors.*` permission keys |
| `packages/shared/src/constants/permissions.ts` | Extend `PERMISSIONS` constant |
| `packages/shared/src/schemas/vendor.schema.ts` | New file — all vendor Zod schemas |
| `packages/shared/src/schemas/index.ts` | Re-export vendor schemas |
| `apps/api/src/app.module.ts` | Import `VendorsModule`, `VendorRequestsModule`, `VendorApprovalsModule` |
| `apps/api/src/domains/mcp/tools/tool-registry.ts` | Inject 5 new handlers, spread into `all()` |
| `apps/api/src/domains/mcp/mcp.module.ts` | Add 5 handler providers |
| `apps/web/src/components/shell/sidebar.tsx` | Add Vendor Manager nav group |

---

## Verification

1. **Unit tests:** `pnpm --filter api test` — `ApprovalChainBuilderService` edge cases (self-approval skip, CEO threshold matrix, governance routing by type), `VendorDecisionService` state transitions, governance-cannot-reject enforcement.
2. **Integration:** `pnpm --filter api test:e2e` — Full request lifecycle: submit → L1 approve → L2 approve → L3 skip (< $1k) → onboarding supplement → O1→O5 sequential → FINOPS complete → `Vendor` record created.
3. **MCP tools:** Test all 5 tools via the existing MCP integration test pattern (`mcp.integration.spec.ts`).
4. **Web:** `pnpm --filter web dev` → verify each dashboard role shows the correct queue (regular user: My Requests only; manager: Approvals queue; FinOps: Pipeline).
5. **Migration script:** Run `ts-node scripts/migrate-oneflow-vendors.ts --dry-run` and verify output counts match Airtable `🧳 Vendors` table record count.
