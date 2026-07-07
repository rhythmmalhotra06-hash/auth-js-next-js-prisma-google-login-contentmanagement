# Fix: restore the "New request" button for Stakeholders (and all roles)

## Context

A Stakeholder reported they can no longer find the "raise a new ticket"
action anywhere in the app. Investigation shows the button — labelled
**"New request"** in this app — is rendered only in the topbar
([components/ui/ShellChrome.tsx:91-95](../components/ui/ShellChrome.tsx#L91-L95))
and is gated behind a `canCreate` prop.

That prop is computed in
[components/ui/AppShell.tsx:28](../components/ui/AppShell.tsx#L28):

```tsx
const canCreate = role.label !== 'Stakeholder';
```

Because `roleLabel()` (AppShell.tsx:7-14) falls back to `'Stakeholder'` for
anyone who isn't Exec / Admin / Manager / Approver / Editor / Designer, and
because `effectiveRoles()` ([lib/roles.ts:66-68](../lib/roles.ts#L66-L68))
maps **untagged** users to `['Stakeholder']`, this hides the button from:

- explicit **Stakeholder** users,
- **Agency / External** users, and
- every **untagged** signed-in user.

This gate was introduced in commit `afa8018` ("feat(ui): replicate prototype
design system across the live app") and is inconsistent with the rest of the
codebase, which treats intake as open to everyone:

- The `/intake` route has **no role guard** and `createTicket`
  ([app/intake/actions.ts](../app/intake/actions.ts)) has **no auth check** —
  stakeholders can already submit by navigating to `/intake` directly.
- The stakeholder empty state links straight to it
  ([app/stakeholder/page.tsx:32](../app/stakeholder/page.tsx#L32) — "Submit a
  new request →").
- [lib/roles.ts:144](../lib/roles.ts#L144) documents that Shoots are open to
  all because it "mirrors 'New request' being open to all."

Since `/intake` is **not** in the sidebar nav
([navForRoles](../lib/roles.ts#L120-L156) never emits an `/intake` item), the
topbar button is the *only* discoverable entry point — so hiding it fully
removes the action for those roles.

**Intended outcome (confirmed with user): show the "New request" button for
every signed-in role**, including Stakeholders, untagged users, and external
agencies.

## Change

Remove the `canCreate` gate so the "New request" button always renders. The
prop becomes dead once the button is unconditional, so remove it entirely
rather than leaving a `const canCreate = true` that misleads.

### 1. [components/ui/AppShell.tsx](../components/ui/AppShell.tsx)
- Delete line 28 (`const canCreate = role.label !== 'Stakeholder';`).
- Remove the `canCreate={canCreate}` prop passed to `<ShellChrome>` (line 37).

### 2. [components/ui/ShellChrome.tsx](../components/ui/ShellChrome.tsx)
- Remove `canCreate` from the destructured props (line 13) and from the props
  type (line 16).
- Change the conditional render at lines 91-95 to render the `<Link>`
  unconditionally (drop the `{canCreate && ( … )}` wrapper).

No other files need changing. The legacy `components/AppNav.tsx` and
`components/ui/Sidebar.tsx` already list Intake unconditionally and are not the
production shell.

## Verification

1. `npm run lint` and `npm run build` — confirm no unused-var / type errors
   from the removed prop.
2. Run the app (`npm run dev`) and use the dev-login harness to switch roles.
   Confirm the topbar "New request" button now appears for:
   - **Stakeholder** (the reported case),
   - an **untagged** user (defaults to Stakeholder),
   - **Agency / External**,
   - and still appears for Editor / Designer / Manager / Approver / Admin /
     Founder (unchanged).
3. Click "New request" as a Stakeholder → lands on `/intake` → "Start creative
   request" → the intake form renders and submits (already worked via direct
   URL; this just restores discoverability).
