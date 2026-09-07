// E12.2 — the Remotion renderer service. Bundles once at startup, then renders one EDL
// per POST /render request: brain (E12.1, in the main app) sends an EDL, this returns
// the rendered MP4 bytes directly in the response — no storage layer yet (see the PRD's
// "Draft storage & re-entry" open question). Never talks to Claude; pure translator.

import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createWriteStream } from 'node:fs';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { spawn } from 'node:child_process';
import { timingSafeEqual } from 'node:crypto';
import { pipeline } from 'node:stream/promises';
import { Readable, Transform } from 'node:stream';
import { bundle } from '@remotion/bundler';
import { renderMedia, selectComposition } from '@remotion/renderer';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 8080;

// Shared-secret bearer auth (2026-09-07) — this service was moved to public Cloud Run
// access (IAP blocked legitimate server-to-server calls from the main portal, and there
// was no CLI/IAM path available to grant it access instead). Public + a real secret gate
// is the same pattern already used for this app's other server-to-server calls
// (SYNC_SECRET on /api/sync/*, /api/clips/learn, /api/dna-review/learn) — /health stays
// open (no video/compute cost, useful for uptime checks).
function authorized(req) {
  const secret = process.env.RENDER_SERVICE_SECRET;
  if (!secret) return false; // fail closed if unset, never fail open
  const header = req.headers['authorization'] ?? '';
  const provided = header.startsWith('Bearer ') ? header.slice(7) : '';
  const a = Buffer.from(provided);
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}

// Bundle on first /render call, not eagerly on container start.
//
// Fixed 2026-09-07: the original code kicked off bundle() unconditionally at module load
// on every cold start, regardless of which endpoint the container was about to serve. On
// this Cloud Run container's small memory allocation, that webpack bundling step alone was
// enough to OOM-crash the process before it ever got to handle a request — confirmed via
// runtime logs showing "FATAL ERROR: ... heap out of memory" immediately after the
// "bundling composition" log line, with no request-handling code having run yet. This
// meant every cold start of /extract-frames (E13.2, which never touches Remotion at all)
// was paying for — and sometimes crashing on — a webpack build it doesn't need.
// getBundle() now only starts bundling the first time handleRender() actually needs it.
let bundlePromise = null;
function getBundle() {
  if (!bundlePromise) {
    console.log('[render-service] bundling composition (first /render call)...');
    bundlePromise = bundle({ entryPoint: path.join(__dirname, 'src', 'index.tsx') }).then((location) => {
      console.log('[render-service] bundle ready:', location);
      return location;
    });
    bundlePromise.catch((e) => console.error('[render-service] bundling failed:', e));
  }
  return bundlePromise;
}

/** Post-render loudness normalization to the EDL's target LUFS. Requires the `ffmpeg`
 *  binary (installed via apt in the Dockerfile) — separate from Remotion's own
 *  internally-bundled ffmpeg, which isn't meant to be shelled out to directly. */
function runFfmpegLoudnorm(inputPath, outputPath, targetLufs) {
  return new Promise((resolve, reject) => {
    const args = ['-y', '-i', inputPath, '-af', `loudnorm=I=${targetLufs}:TP=-1.5:LRA=11`, '-c:v', 'copy', outputPath];
    const proc = spawn('ffmpeg', args);
    let stderr = '';
    proc.stderr.on('data', (d) => { stderr += d.toString(); });
    proc.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`ffmpeg loudnorm failed (exit ${code}): ${stderr.slice(-2000)}`))));
    proc.on('error', reject);
  });
}

async function readBody(req) {
  let body = '';
  for await (const chunk of req) body += chunk;
  return body;
}

// ---------------------------------------------------------------------------
// POST /extract-frames (E13.2) — download a video, extract evenly-spaced frames,
// return them base64-inline. No storage layer (same as /render) — frames feed one
// multimodal Claude call in the main app and are discarded, so persisting them here
// would be waste, not a missing feature. Scoped to Dropbox-hosted deliverables for
// v1 (a direct file URL); YouTube sources already get transcript-only enrichment via
// the existing Supadata path in the main app and aren't handled here.
// ---------------------------------------------------------------------------

function runCommand(cmd, args) {
  return new Promise((resolve, reject) => {
    const proc = spawn(cmd, args);
    let stdout = '';
    let stderr = '';
    proc.stdout?.on('data', (d) => { stdout += d.toString(); });
    proc.stderr?.on('data', (d) => { stderr += d.toString(); });
    proc.on('close', (code) => (code === 0 ? resolve(stdout) : reject(new Error(`${cmd} failed (exit ${code}): ${stderr.slice(-2000)}`))));
    proc.on('error', reject);
  });
}

/** Auto-scaled frame budget — matches the internal /watch skill's + BlinkLife Recorder's
 *  table (see plans/vishen-recorder-dna-review-loop.md). Sensible defaults so the caller
 *  never has to tune it. */
function frameBudgetFor(durationSec) {
  if (durationSec <= 30) return 30;
  if (durationSec <= 60) return 40;
  if (durationSec <= 180) return 60;
  if (durationSec <= 600) return 80;
  return 100; // >10min, sparse
}

const MAX_DOWNLOAD_BYTES = 500 * 1024 * 1024; // 500MB guard — a runaway/huge source shouldn't hang the container

/** Dropbox share links (`dl=0`) redirect to an HTML preview, not the file bytes;
 *  `dl=1` redirects to the direct-download CDN URL instead. Verified empirically
 *  against real production links — no Dropbox API/OAuth needed for "anyone with the
 *  link" shares. Non-Dropbox URLs are passed through unchanged. */
function toDirectDownloadUrl(url) {
  if (!/dropbox\.com/i.test(url)) return url;
  return /[?&]dl=1(&|$)/.test(url) ? url : url.includes('dl=0') ? url.replace('dl=0', 'dl=1') : `${url}${url.includes('?') ? '&' : '?'}dl=1`;
}

/**
 * Streams the download straight to disk — near-constant memory regardless of file size.
 * Fixed 2026-09-07 after real production OOM crashes: the original implementation
 * buffered the entire video in an array + Buffer.concat before writing, which worked only
 * by accident for small test files and reliably crashed the container (small Cloud Run
 * memory, plus Remotion's own bundling step competing for the same heap) on real videos —
 * see plans/now-lets-plan-this-reflective-thunder.md's "render-service OOM-crashing" note.
 */
async function downloadVideo(url, destPath) {
  const resp = await fetch(toDirectDownloadUrl(url), { redirect: 'follow' });
  if (!resp.ok || !resp.body) throw new Error(`Download failed: HTTP ${resp.status}`);
  const contentLength = Number(resp.headers.get('content-length') ?? 0);
  if (contentLength > MAX_DOWNLOAD_BYTES) throw new Error(`Source file too large (${Math.round(contentLength / 1e6)}MB, max 500MB)`);

  let total = 0;
  const sizeGuard = new Transform({
    transform(chunk, _enc, cb) {
      total += chunk.length;
      if (total > MAX_DOWNLOAD_BYTES) {
        cb(new Error('Source file exceeded the 500MB guard mid-download'));
        return;
      }
      cb(null, chunk);
    },
  });

  await pipeline(Readable.fromWeb(resp.body), sizeGuard, createWriteStream(destPath));
}

async function probeDurationSec(filePath) {
  const out = await runCommand('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', filePath]);
  const seconds = parseFloat(out.trim());
  if (!Number.isFinite(seconds) || seconds <= 0) throw new Error('Could not determine video duration (ffprobe)');
  return seconds;
}

async function extractFrameFiles(videoPath, workDir, frameCount, durationSec) {
  const interval = durationSec / frameCount;
  const pattern = path.join(workDir, 'frame_%04d.jpg');
  await runCommand('ffmpeg', [
    '-y', '-i', videoPath,
    '-vf', `fps=1/${interval},scale='min(1024,iw)':'min(1024,ih)':force_original_aspect_ratio=decrease`,
    '-vframes', String(frameCount),
    '-q:v', '3',
    pattern,
  ]);
  const files = (await readdir(workDir)).filter((f) => f.startsWith('frame_') && f.endsWith('.jpg')).sort();
  return files.map((f, i) => ({ file: path.join(workDir, f), timestampMs: Math.round(i * interval * 1000) }));
}

async function handleExtractFrames(req, res) {
  let payload;
  try {
    payload = JSON.parse(await readBody(req));
  } catch {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: false, error: 'Request body must be JSON.' }));
    return;
  }

  const videoUrl = payload?.videoUrl;
  if (typeof videoUrl !== 'string' || !videoUrl) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: false, error: 'Body must be { videoUrl: string }.' }));
    return;
  }

  const workDir = await mkdtemp(path.join(tmpdir(), 'extract-frames-'));
  const videoPath = path.join(workDir, 'source.mp4');

  try {
    await downloadVideo(videoUrl, videoPath);
    const durationSec = await probeDurationSec(videoPath);
    const frameCount = Math.min(payload?.maxFrames ?? frameBudgetFor(durationSec), frameBudgetFor(durationSec));
    const frameFiles = await extractFrameFiles(videoPath, workDir, frameCount, durationSec);

    const frames = await Promise.all(
      frameFiles.map(async ({ file, timestampMs }) => ({
        timestampMs,
        base64: (await readFile(file)).toString('base64'),
      })),
    );

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true, durationMs: Math.round(durationSec * 1000), frames }));
  } catch (e) {
    console.error('[render-service] extract-frames failed:', e);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: false, error: e instanceof Error ? e.message : 'Frame extraction failed' }));
  } finally {
    await rm(workDir, { recursive: true, force: true });
  }
}

async function handleRender(req, res) {
  let payload;
  try {
    payload = JSON.parse(await readBody(req));
  } catch {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: false, error: 'Request body must be JSON.' }));
    return;
  }

  const edl = payload?.edl;
  if (!edl || typeof edl.source_uri !== 'string' || typeof edl.in !== 'number' || typeof edl.out !== 'number') {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: false, error: 'Body must be { edl: Edl } with at least source_uri, in, out.' }));
    return;
  }

  const workDir = await mkdtemp(path.join(tmpdir(), 'edl-render-'));
  const rawOut = path.join(workDir, 'raw.mp4');
  const finalOut = path.join(workDir, 'final.mp4');

  try {
    const bundleLocation = await getBundle();
    const composition = await selectComposition({ serveUrl: bundleLocation, id: 'EdlClip', inputProps: { edl } });

    await renderMedia({
      composition,
      serveUrl: bundleLocation,
      codec: 'h264',
      outputLocation: rawOut,
      inputProps: { edl },
      // The flag the Remotion docs call out as critical for containerized/headless environments.
      chromiumOptions: { enableMultiProcessOnLinux: true },
    });

    let outputPath = rawOut;
    if (edl.audio?.normalize && typeof edl.audio.target_lufs === 'number') {
      await runFfmpegLoudnorm(rawOut, finalOut, edl.audio.target_lufs);
      outputPath = finalOut;
    }

    const video = await readFile(outputPath);
    res.writeHead(200, { 'Content-Type': 'video/mp4', 'Content-Length': video.length });
    res.end(video);
  } catch (e) {
    console.error(`[render-service] render failed for clip ${edl.clip_id}:`, e);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: false, error: e instanceof Error ? e.message : 'Render failed' }));
  } finally {
    await rm(workDir, { recursive: true, force: true });
  }
}

const server = http.createServer((req, res) => {
  if (req.method === 'POST' && (req.url === '/render' || req.url === '/extract-frames')) {
    if (!authorized(req)) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: false, error: 'unauthorized' }));
      return;
    }
  }
  if (req.method === 'POST' && req.url === '/render') {
    handleRender(req, res).catch((e) => {
      console.error('[render-service] unhandled error:', e);
      if (!res.headersSent) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, error: 'Internal error' }));
      }
    });
    return;
  }
  if (req.method === 'POST' && req.url === '/extract-frames') {
    handleExtractFrames(req, res).catch((e) => {
      console.error('[render-service] unhandled error:', e);
      if (!res.headersSent) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, error: 'Internal error' }));
      }
    });
    return;
  }
  if (req.method === 'GET' && req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true }));
    return;
  }
  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ ok: false, error: 'Not found' }));
});

server.listen(PORT, () => {
  console.log(`[render-service] listening on :${PORT}`);
});
