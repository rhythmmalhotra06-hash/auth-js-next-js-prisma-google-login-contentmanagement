// YouTube Data API helpers for auto-detect (Vishen's channel uploads) + URL parsing.
// Node runtime only (used from API routes). Transcript fetching lives in
// lib/clipping/transcript.ts — this module is purely metadata/discovery.

const API = 'https://www.googleapis.com/youtube/v3';

export interface YouTubeUpload {
  videoId: string;
  title: string;
  url: string;
  publishedAt: string;
  durationSeconds: number | null; // null when contentDetails couldn't be resolved
}

/** Parse an ISO-8601 duration (e.g. "PT1H2M30S", "PT48S") to whole seconds. */
export function parseIsoDuration(iso: string): number | null {
  const m = iso.match(/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/);
  if (!m) return null;
  return +(m[1] || 0) * 3600 + +(m[2] || 0) * 60 + +(m[3] || 0);
}

/** Extract the 11-char video id from any common YouTube URL form. */
export function parseVideoId(url: string): string | null {
  const m = url.match(/(?:youtube\.com\/(?:watch\?v=|live\/|embed\/|shorts\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/);
  return m ? m[1] : null;
}

export function watchUrl(videoId: string): string {
  return `https://www.youtube.com/watch?v=${videoId}`;
}

function apiKey(): string {
  const k = process.env.YOUTUBE_API_KEY;
  if (!k) throw new Error('YOUTUBE_API_KEY is not set.');
  return k;
}

/**
 * Resolve a channel's "uploads" playlist id. The uploads playlist id is the
 * channel id with the 2nd char swapped (UC… → UU…), but we resolve via the API
 * to be safe across channel types.
 */
export async function uploadsPlaylistId(channelId: string): Promise<string> {
  const url = `${API}/channels?part=contentDetails&id=${encodeURIComponent(channelId)}&key=${apiKey()}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`YouTube channels API ${res.status}: ${await res.text()}`);
  const json = (await res.json()) as {
    items?: { contentDetails?: { relatedPlaylists?: { uploads?: string } } }[];
  };
  const id = json.items?.[0]?.contentDetails?.relatedPlaylists?.uploads;
  if (!id) throw new Error(`No uploads playlist for channel ${channelId}`);
  return id;
}

/** Most-recent uploads for a channel (default 1 page = up to 50). Cheap: ~1 quota unit. */
export async function recentUploads(channelId: string, max = 25): Promise<YouTubeUpload[]> {
  const playlistId = await uploadsPlaylistId(channelId);
  const url =
    `${API}/playlistItems?part=snippet&maxResults=${Math.min(max, 50)}` +
    `&playlistId=${encodeURIComponent(playlistId)}&key=${apiKey()}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`YouTube playlistItems API ${res.status}: ${await res.text()}`);
  const json = (await res.json()) as {
    items?: { snippet?: { title?: string; publishedAt?: string; resourceId?: { videoId?: string } } }[];
  };
  const out: YouTubeUpload[] = [];
  for (const it of json.items ?? []) {
    const videoId = it.snippet?.resourceId?.videoId;
    if (!videoId) continue;
    out.push({
      videoId,
      title: it.snippet?.title ?? '',
      url: watchUrl(videoId),
      publishedAt: it.snippet?.publishedAt ?? '',
      durationSeconds: null, // filled in below
    });
  }

  // Enrich with duration so callers can distinguish Shorts (≤180s) from long-form.
  // One videos.list call covers all ids (≤50) for ~1 quota unit.
  const durations = await videoDurations(out.map((u) => u.videoId));
  for (const u of out) u.durationSeconds = durations.get(u.videoId) ?? null;

  return out;
}

/** Map videoId → duration in seconds via videos?part=contentDetails (≤50 ids/call). */
export async function videoDurations(videoIds: string[]): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  if (videoIds.length === 0) return map;
  const url =
    `${API}/videos?part=contentDetails&id=${encodeURIComponent(videoIds.slice(0, 50).join(','))}` +
    `&key=${apiKey()}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`YouTube videos API ${res.status}: ${await res.text()}`);
  const json = (await res.json()) as {
    items?: { id?: string; contentDetails?: { duration?: string } }[];
  };
  for (const it of json.items ?? []) {
    const id = it.id;
    const iso = it.contentDetails?.duration;
    if (!id || !iso) continue;
    const secs = parseIsoDuration(iso);
    if (secs != null) map.set(id, secs);
  }
  return map;
}
