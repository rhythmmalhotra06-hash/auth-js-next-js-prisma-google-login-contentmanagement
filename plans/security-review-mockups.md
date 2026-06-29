# Security Review — branch `main` untracked changes

## Context

Ran the `/security-review` skill against the new (untracked) files on the branch.
The set under review:

- `Context/mockups/demo.html` — clickable full-vision prototype
- `Context/mockups/demo-six.html` — role-surface mockup
- `plans/adapt-demo-artifact-surfaces.md`
- `plans/fix-youtube-transcript-fetch.md`
- `plans/product-evaluation-loose-ends-build.md`

The two HTML mockups were the primary target (inline JS, DOM sinks, secrets,
network calls). The three `.md` files are documentation and are excluded from
findings per review rules — read for context only.

## Result: NO exploitable vulnerabilities found

The HTML files use `innerHTML` heavily (26 sinks in demo.html, 29 in
demo-six.html) with hash-based routing, but none of the high-risk flows are
exploitable:

- **DOM XSS (innerHTML + `location.hash`) — not exploitable.** The router
  (`demo.html:1199`, `demo-six.html:1505`) extracts an id from the hash and
  uses it *only* as a lookup key (`TICKETS.find(x=>x.id===id)`), bailing out on
  any non-match. The raw hash value is never written into `innerHTML`; all
  rendered content derives from static in-file data arrays.
- No `eval` / `new Function` / dynamic code execution.
- No `fetch` / `XMLHttpRequest` / `WebSocket` / external script or style loads
  (fully self-contained, CSP-safe).
- No `postMessage` handlers.
- No hardcoded secrets — keyword hits were false positives (`mask-image` CSS,
  `AIza` inside an embedded base64 woff2 font blob, a code comment).
- Dynamic `href="${t.dist}"` uses hardcoded literal demo URLs with
  `rel="noopener"`; not user-controlled, no `javascript:` URIs.

## Forward-looking notes (not findings — code does not exist yet)

To flag **when these plans are implemented**:

1. `plans/fix-youtube-transcript-fetch.md` — fetches a YouTube caption track's
   `base_url` server-side. Validate `base_url` resolves to an expected
   YouTube/Google host before fetching (SSRF guard on host/protocol).
2. `plans/adapt-demo-artifact-surfaces.md` — `useTableView` persists column/sort
   state to `localStorage` (low risk); ensure cell content stays escaped when
   promoting arbitrary fields to columns.

## Verification

No remediation required. To re-run the review after future changes:
`/security-review` on the branch, or re-read the mockups for new `innerHTML`/
`fetch` sinks introduced after this date.
