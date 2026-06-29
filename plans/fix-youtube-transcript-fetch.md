# Fix YouTube transcript fetch failing on clip generation

## Context

When generating clips, the transcribe step fails with:

> "Couldn't fetch captions for this video — it may have captions disabled, be age/region-restricted, or YouTube may be blocking automated access. Paste the transcript or upload a .txt/.vtt/.srt instead."

**Root cause:** [lib/clipping/transcript.ts:64-89](../lib/clipping/transcript.ts#L64-L89) fetches captions via `youtubei.js` (Innertube) with a single blanket `try/catch` that converts *every* failure to one generic message. On the **deployed Kessel app** the real failure is almost always **YouTube blocking automated access from the Cloud Run datacenter IP** (bot-check) — it works locally (residential IP) but fails when deployed. Contributing factors: `retrieve_player: false` and a single hard-coded response-shape path (`initial_segments`) that breaks silently when empty.

Confirmed: this error surfaces in **two** flows, both routed through `fetchYouTubeTranscript`:
1. **Cockpit** "Add media to generate clips" → [NewMediaCard](../components/vishen/NewMediaCard.tsx) → `/media/[id]` → "Suggest clips" → [POST /api/media/[id]/suggest](../app/api/media/[id]/suggest/route.ts)
2. **Content Engine form** → [ClipEngineForm](../components/clipping/ClipEngineForm.tsx) YouTube tab → [fetchYouTube action](../app/content-engine/actions.ts#L16)

**Decision:** Harden the `youtubei.js` fetch *and* collect an optional transcript alongside the link in the first stage, so when the auto-fetch is blocked there's no failed round-trip — the transcript is already on hand. (Auto-fetch from a datacenter IP will never be 100% reliable; the upfront transcript is the dependable safety net.)

## Changes

### 1. Harden `fetchYouTubeTranscript` — [lib/clipping/transcript.ts](../lib/clipping/transcript.ts)

Rewrite the fetch (lines 64-89) to try harder and to tell the truth about failures:

- **Try multiple Innertube client types in sequence.** Default `WEB` is the most bot-checked from datacenter IPs; `ANDROID` / `IOS` / `TVHTML5` clients are frequently served when WEB is blocked and need no PoToken. Loop over a small list and return the first that yields text — e.g. `await yt.getInfo(id, 'ANDROID')` (or `Innertube.create({ client_type })` per attempt).
- **Add a caption-track fallback.** When `getTranscript()` returns empty `initial_segments`, fall back to `info.captions?.caption_tracks` and fetch the track's `base_url` (timedtext) directly, then run the result through `normalizeTranscript`. This survives the response-shape changes that currently produce a silent empty result.
- **Light retry/backoff** (1-2 retries) per client attempt for transient network/429.
- **Classify the error instead of swallowing it.** Add a `reason` field to `TranscriptFetchError` (`'blocked' | 'no_captions' | 'unavailable' | 'invalid_url' | 'unknown'`) and inspect the caught error (bot-check / "Sign in to confirm" / 429 → `blocked`; no caption tracks → `no_captions`; etc.). Pick the user-facing message from `reason` so "YouTube is blocking automated access — paste the transcript below" is distinguishable from "this video has captions disabled."
- Keep the existing `YT_FALLBACK_MSG` as the `unknown`/`blocked` copy; keep `extractYouTubeId` and `normalizeTranscript` as-is and reuse them.

*Optional / not in this pass (note in code comment):* a proxy or BotGuard PoToken would further raise the success rate from Cloud Run but adds heavy deps; the upfront-transcript path below makes it unnecessary for v1.

### 2. Collect transcript in the first stage (one step, not two)

**Cockpit flow (primary):**
- [components/vishen/NewMediaCard.tsx](../components/vishen/NewMediaCard.tsx): add an optional **"Transcript (optional — paste if you have it)"** `<textarea>` under the URL/title inputs. Pass its value to `submitMediaLink`.
- [app/media/actions.ts](../app/media/actions.ts) `submitMediaLink` (`SubmitMediaInput`): accept `transcript?: string`; forward it to `createMediaSource({ ..., transcript })`. `createMediaSource` **already** persists `transcript` ([repository.ts:130,145](../lib/media/repository.ts#L145)) — no repo write change needed.
- [lib/media/repository.ts](../lib/media/repository.ts): make the stored transcript **readable** — add `transcript: string | null` to the `MediaSource` interface (after line 57), map it in `mapSource` (`transcript: str(f[MF.transcript])`). (`getMediaSource` uses `getRecord` which returns all fields, so mapping is the only requirement; add to `LIST_FIELDS` only if needed elsewhere.)
- [app/api/media/[id]/suggest/route.ts](../app/api/media/[id]/suggest/route.ts): in the transcript-resolution block (lines 41-44), prefer in order: **(a)** `pastedTranscript` from the request body, **(b)** `source.transcript` stored at submit, **(c)** live `fetchYouTubeTranscript(source.sourceUrl)`. Only hit YouTube when no transcript was supplied. Surface the classified `reason` message on failure (already returns `e.message`).

**Content Engine form (secondary):**
- [components/clipping/ClipEngineForm.tsx](../components/clipping/ClipEngineForm.tsx): in the YouTube tab, always show the transcript `<textarea>` (not only after a successful fetch) so the user can paste upfront instead of relying on Fetch. Keep the "Fetch" button as a convenience; on `onSubmit`, if `transcript` is already filled, use it directly (current behavior already sends `transcript` to `/api/content-engine/generate`, so this is mostly a UI change to reveal the field earlier). Update the hint copy to reflect that pasting is the reliable path on the deployed app.

## Files

- [lib/clipping/transcript.ts](../lib/clipping/transcript.ts) — harden fetch + classified errors (core)
- [app/api/media/[id]/suggest/route.ts](../app/api/media/[id]/suggest/route.ts) — prefer stored/pasted transcript before fetch
- [lib/media/repository.ts](../lib/media/repository.ts) — expose `transcript` on `MediaSource`
- [app/media/actions.ts](../app/media/actions.ts) — thread `transcript` through `submitMediaLink`
- [components/vishen/NewMediaCard.tsx](../components/vishen/NewMediaCard.tsx) — optional transcript field
- [components/clipping/ClipEngineForm.tsx](../components/clipping/ClipEngineForm.tsx) — reveal transcript field upfront

## Verification

1. **Local:** `npm run dev`. In the cockpit, "Add media to generate clips":
   - Paste a YouTube URL **with** a transcript → submit → "Suggest clips" → confirm it uses the pasted transcript (no YouTube fetch) and produces clips.
   - Paste a URL **without** a transcript → confirm it still auto-fetches (locally this usually succeeds) and, on a captions-disabled video, shows the correct classified message.
2. **Hardening:** temporarily force the WEB client to fail (or test a known-blocked video) and confirm the ANDROID/caption-track fallback recovers, and that a genuinely caption-less video reports `no_captions` copy, not the generic blocked copy.
3. **Deploy to Kessel** (`kessel deploy`): repeat the URL-only path to confirm whether the multi-client hardening now succeeds from the datacenter IP; regardless, confirm the upfront-transcript path produces clips without any failed round-trip.
4. `npm run lint` and `npm run build` clean.
