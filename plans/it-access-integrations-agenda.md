# IT Meeting — Access & Integrations Agenda

Content Production & Management System (Kessel / Cloud Run + Next.js).
Goal of the meeting: unblock deployment by securing **service accounts, IAP exceptions, and API keys** — not personal tokens.

**Lead with the two blockers:** IAP cron/webhooks (§2) and shared service-account tokens for Airtable (§5) + Anthropic (§4).

---

## 1. Identity & Access (login)
- [ ] Who provisions the **Google OAuth client** (`GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`) in the MV GCP project?
- [ ] Restrict login to `@mindvalley.com`? Confirm final auth provider (currently moving GitHub → Google).
- [ ] **Blinkwork SSO** mapping to the `employees` table — in scope now or later?
- [ ] Agree initial **admin list** (`ADMIN_BOOTSTRAP_EMAILS`).
- [ ] **External reviewers** (Vision, agencies) need access **without a paid seat / MV SSO** — how do they get past IAP? (ties to §2)

## 2. IAP & Cloud Run perimeter  ⚠️ BLOCKER
App is IAP-gated (`@mindvalley.com` only) — breaks inbound + scheduled traffic.
- [ ] **Scheduled jobs**: need a **service account w/ OIDC identity** IAP accepts, OR an **internal Cloud Scheduler**. Blocks: metrics auto-refresh, YouTube auto-discover, Slack scan, sync.
- [ ] **Inbound webhooks** (Airtable, Slack) can't reach the app — confirm we stay **poll/outbound-only**, or get sources allowlisted.
- [ ] Reconcile **public stakeholder access** with IAP.

## 3. Database / Hosting (Kessel)
- [ ] Owner of the **Kessel project + managed Postgres** (backups, retention, prod migrations, scaling).
- [ ] **Secrets**: all via `kessel env secret`; agree who holds/rotates. (No env edits outside Kessel — platform overwrites.)
- [ ] *(Only if Supabase is actually being considered as an alternative to Kessel Postgres — decide here. Nothing in the code uses it today.)*

## 4. Anthropic / Claude API  ⚠️ BLOCKER
- [ ] **`ANTHROPIC_API_KEY`** on a **MV org/billing account** (not personal). Owner + monthly budget + rate limits?
- [ ] Data-governance sign-off: transcripts/content sent to Anthropic — acceptable?

## 5. Airtable  ⚠️ BLOCKER
- [ ] Move from **personal access token** → **shared service-account token** (`AIRTABLE_TOKEN`).
- [ ] Scopes: `schema.bases:read` + `data.records:read` now; **add `data.records:write`** before two-way push.
- [ ] Token has access to all bases: Prio `appFEFygXo2pRc8AR`, Titus Video `appDZnMnJGehbSOo5`, Ads `appWYOr2p4RKHf2LR`.

## 6. YouTube Data API
- [ ] **`YOUTUBE_API_KEY`** (Data API v3) — which GCP project, and **quota** for the auto-discover poller.
- [ ] Confirm Vishen channel ID (`UCgAvK6yXl3BtasS9mS0kefQ`).

## 7. Supadata (transcript vendor)
- [ ] **Vendor / procurement + data-egress approval** for `SUPADATA_API_KEY` (external service that proxies YouTube content). Needed because Cloud Run's IP is blocked by YouTube. Internal proxy alternative?

## 8. Slack
- [ ] Who creates the **Slack app + bot token** (`SLACK_BOT_TOKEN`)?
- [ ] Scopes `channels:history` / `groups:history`; bot invited to media + content-ready channels.

## 9. BlinkLife / Blinkwork
- [ ] **Token model**: single shared bearer (`BLINKLIFE_TOKEN`) vs **per-user OAuth** (open spike). Decide.
- [ ] Confirm `BLINKLIFE_MCP_URL`, target project name, `APP_BASE_URL` deep links.

## 10. Shared route secrets
- [ ] Ownership/rotation of `SYNC_SECRET`, `DISCOVER_SHARED_SECRET`, `BLINKLIFE_SYNC_SECRET` (protect internal API routes).

---

### Decisions to walk out with
- [ ] IAP path for cron jobs chosen (service account vs internal scheduler)
- [ ] IAP path for external reviewers chosen
- [ ] Owner assigned for: Anthropic key, Airtable service token, Google OAuth client
- [ ] Procurement kicked off for Supadata (if approved)
- [ ] Secrets-management owner named
