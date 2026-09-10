# Dropbox creds: finish the folder path, close the Replay question

## Context

The Dropbox app key and secret were added to the `auto-editing-render` Kessel project on
2026-09-10, and the expectation was that DNA visual review would then be able to read
`replay.dropbox.com` delivery links. It can't, and it never could — the two things are unrelated.

**Replay.** `replay.dropbox.com` is rejected at parse time in both halves of the system —
`UNSUPPORTED_HOST_PATTERNS` in `lib/dna-review/video-source.ts:154` and `UNSUPPORTED_HOSTS` in
`render-service/server.mjs:221` — so no Dropbox credential is ever consulted on that path. Removing
the rejection would not help: the gating probe was run on 2026-09-10 with our own key/secret and
`/2/reel/get_with_shared_link` returned **400, `required scope 'private:files.content.read'`**. The
`private:` prefix is a first-party-only scope, not offerable in the App Console Permissions tab. For
the ~5% of ticketed links that are Replay, paste-a-link is permanently the only path, and the
current UI copy already says exactly that.

**Folder links.** What the credentials actually unlock is the 28% slice of Dropbox *folder* links
(`/scl/fo/`, `/sh/`), whose resolution code already exists in `render-service/server.mjs`
(`downloadFromDropboxFolder`, 668-712). It is still inert: `dropboxConfigured()` (server.mjs:546)
requires all three vars and `DROPBOX_REFRESH_TOKEN` is absent. Verified 2026-09-10 —
`kessel env list` from `render-service/` shows only `DROPBOX_APP_KEY`, `DROPBOX_APP_SECRET`,
`RENDER_SERVICE_SECRET`; local `.env:38` has `DROPBOX_REFRESH_TOKEN=""`.

Outcome wanted: the refresh token lands so folder links resolve (coverage ~56% → ~84% on the
"Saw the video" KPI at `/performance/reviews`), and the repo stops carrying a stale note claiming
Replay is about to be fixed.

## Work item 1 — mint the refresh token (credentials, zero code change)

`files/list_folder` with a `shared_link` is **user-auth only**, so an app key/secret pair is not
sufficient; it needs a one-time offline grant. Scopes bake in at grant time, so they must be ticked
first.

1. In the Dropbox App Console for this app, Permissions tab: enable **`files.metadata.read`** and
   **`sharing.read`**, then Submit. (Do not bother looking for `private:files.content.read` — it is
   not listed, per the probe above.)
2. Run the one-time authorization-code flow with `token_access_type=offline`:
   - Open `https://www.dropbox.com/oauth2/authorize?client_id=<APP_KEY>&response_type=code&token_access_type=offline`,
     approve, copy the code.
   - Exchange it: `POST https://api.dropboxapi.com/oauth2/token` with basic auth `key:secret`,
     `grant_type=authorization_code`, `code=<code>`. The response's `refresh_token` is the value.
   - A helper that does both steps and writes the value to `.env` + `kessel env secret` without it
     passing through chat already exists at
     `/private/tmp/claude-501/-Users-rhythmmalhotra-Documents-GithubDev-ContentManagement/c7044895-f8d1-42cf-afab-74710e0494db/scratchpad/dropbox-refresh-token.sh`
     — copy it into this session's scratchpad and run it rather than retyping the curl calls.
3. Set it as a secret **from `render-service/`**, not the repo root — the creds belong to the
   `auto-editing-render` Kessel project (id `947eeacf`), never the portal:
   `kessel env secret DROPBOX_REFRESH_TOKEN=...`
4. **Redeploy render-service.** Env changes are invisible to the running container until a rebuild
   (see the `kessel-env-needs-new-commit` / `kessel-manual-deploy-vs-git-autodeploy` history). Note
   that a manual `kessel deploy` builds from local disk, so run it from a clean checkout.
5. Verify (below) before assuming it took.

Known follow-on, out of scope here: the folder branch still *stages* the picked file locally under
the 500MB `MAX_DOWNLOAD_BYTES` cap (server.mjs:191, 864-871), because
`sharing/get_shared_link_file` streams bytes rather than yielding a seekable URL. Real deliverables
run 0.5-10GB, so multi-GB folder videos will still fail with `dropbox_folder_video_too_large` even
once the token lands. Fixing that means `files/get_temporary_link` (or ffmpeg `-headers`) so the
folder path range-seeks like the bare-file path already does. Worth doing next, but it is a separate
change and should not hold up the credential.

## Work item 2 — correct the stale Replay note

`Context/portal-overview.md:270-276` currently reads that Replay "is in fact resolvable" via the
undocumented `/2/reel/*` API and that "the current UI wrongly tells people Replay is unsupported.
That's the next fix." The 2026-09-10 probe settles this the other way. Rewrite that bullet to say:

- Dropbox **folder** OAuth is the pending item (and what it unlocks);
- Replay is **permanently unsupported** for automated frame extraction — `private:files.content.read`
  is first-party-only — so paste-a-link is the intended path and the existing UI copy is correct.

Also retire the Replay appendix in `plans/we-had-fixed-the-parsed-platypus.md:279-320` (mark it
closed with the 400/scope result) so nobody re-opens it on the theory that better scopes exist.

No code or user-facing copy changes: `VIDEO_SOURCE_FAILURE_MESSAGE['replay-only']`
(`lib/dna-review/video-source.ts:301-302`) and `RENDER_ERROR_MESSAGE.unsupported_dropbox_replay`
(`lib/dna-review/frames.ts:54-55`) already tell the user the right thing, and
`unsupported_dropbox_replay` is already in `NEEDS_LINK_CODES` so the paste box is offered.

## Optional cleanup spotted while investigating

`UNSUPPORTED_HOSTS` (server.mjs:220-233) and `UNSUPPORTED_HOST_PATTERNS`
(video-source.ts:70-83) are hand-mirrored lists that both carry a "keep in sync" comment — and have
already drifted: the app list includes `notion.so` and `wetransfer.com`, render-service's does not.
Consequence is only a worse error message (generic `unsupported_host` instead of the app's tailored
copy), so this is low priority, but adding the two missing entries is a two-line fix.

## Verification

1. **Config took:** `cd render-service && kessel env list` shows all three `DROPBOX_*` rows, then
   `kessel deploy` completes and `curl "$RENDER_SERVICE_URL/health"` returns healthy.
2. **Folder resolution works end-to-end:** pick a ticket whose only delivery link is a `/scl/fo/` or
   `/sh/` folder (query the four `VIDEO_SOURCE_FIELDS` columns via `kessel db query` to find one),
   open it in the portal and run the visual DNA review. Before the change it returns
   `dropbox_folder_unconfigured` and drops to the paste box; after, it should list the folder, pick
   the final video, and produce frames. A `dropbox_folder_video_too_large` result is the known
   staging limit above, not a credential failure.
3. **Negative control:** a ticket linking only `replay.dropbox.com` must still fail fast with the
   "review page, not the video file" copy and the paste box — the credential must not change that.
4. **Coverage KPI:** the "Saw the video" tile at `/performance/reviews`
   (`app/performance/reviews/page.tsx:156-160`) should climb as reviews are re-run; it read 1 of 7
   (14%) before the creds.
5. **Docs:** re-read the edited bullet in `Context/portal-overview.md` and confirm it no longer
   promises a Replay fix.
