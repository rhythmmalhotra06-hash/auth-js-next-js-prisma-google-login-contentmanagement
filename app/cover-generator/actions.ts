'use server';

import { auth } from '@/lib/auth';
import { uploadAttachment } from '@/lib/airtable/client';
import { CLIP_SUGGESTIONS } from '@/lib/airtable/field-map';

export interface SaveCoverInput {
  clipId: string; // Clip Suggestions recId
  dataUrl: string; // data:image/jpeg;base64,… (JPEG — keeps the payload under Airtable's ~5MB cap)
  filename: string;
}

export type SaveCoverResult = { ok: true } | { ok: false; error: string };

// Attach a finished cover to its clip's record (Airtable upload-attachment API).
// Additive: the user's download always works; save-back is a bonus and never blocks it.
export async function saveCoverToClip(input: SaveCoverInput): Promise<SaveCoverResult> {
  const session = await auth();
  if (!session?.user?.email) return { ok: false, error: 'You need to be signed in to save a cover.' };

  const m = /^data:(image\/[a-z.+-]+);base64,(.+)$/i.exec(input.dataUrl);
  if (!m) return { ok: false, error: 'Could not read the image data.' };
  const [, contentType, base64] = m;
  if (!input.clipId) return { ok: false, error: 'Missing the clip to save to.' };

  try {
    await uploadAttachment(CLIP_SUGGESTIONS.baseId, input.clipId, CLIP_SUGGESTIONS.fields.cover, {
      contentType,
      base64,
      filename: input.filename || 'cover.jpg',
    });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'The cover could not be saved to Airtable.' };
  }
}
