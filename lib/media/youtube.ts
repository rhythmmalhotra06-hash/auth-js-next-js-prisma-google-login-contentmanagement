// YouTube Data API helpers for auto-detect (Vishen's channel uploads) + URL parsing.
// Node runtime only (used from API routes). Transcript fetching lives in
// lib/clipping/transcript.ts — this module is purely metadata/discovery.

const API = 'https://www.googleapis.com/youtube/v3';

export interface YouTubeUpload {
  videoId: string;
  title: string;
  url: string;
  publishedAt: string;
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
    });
  }
  return out;
}
