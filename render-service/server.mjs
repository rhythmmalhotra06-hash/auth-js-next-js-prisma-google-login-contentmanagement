// E12.2 — the Remotion renderer service. Bundles once at startup, then renders one EDL
// per POST /render request: brain (E12.1, in the main app) sends an EDL, this returns
// the rendered MP4 bytes directly in the response — no storage layer yet (see the PRD's
// "Draft storage & re-entry" open question). Never talks to Claude; pure translator.

import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { spawn } from 'node:child_process';
import { bundle } from '@remotion/bundler';
import { renderMedia, selectComposition } from '@remotion/renderer';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 8080;

// Bundle lazily in the background rather than blocking startup — Cloud Run's startup
// probe needs the container listening on $PORT quickly, and bundling (webpack +
// Chromium-adjacent work) is slow enough that blocking on it here got the previous
// deploy marked failed even though the image itself built fine. /health responds
// immediately regardless; /render awaits this promise.
console.log('[render-service] bundling composition in the background...');
const bundlePromise = bundle({ entryPoint: path.join(__dirname, 'src', 'index.tsx') }).then((location) => {
  console.log('[render-service] bundle ready:', location);
  return location;
});
bundlePromise.catch((e) => console.error('[render-service] bundling failed:', e));

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
    const bundleLocation = await bundlePromise;
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
