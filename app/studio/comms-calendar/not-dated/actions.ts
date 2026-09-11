'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { auth } from '@/lib/auth';
import { scheduleOutboxDrain } from '@/lib/airtable/drain-after';
import { invalidateCalendarCaches } from '@/lib/comms-calendar/data.airtable';

// Setting a Live Date from the not-dated tray — the one field the portal writes on the Vishen
// Videos table (decision AB4).
//
// WHY THIS FIELD AND NOTHING ELSE. `Live Date` has no owner: 204 of 442 assets lack it and 66 of
// those are already published, so finished work is invisible to every calendar view. It is the
// single change that empties the tray. Status stays the team's own workflow — the standing rule on
// this project is that the app never overwrites a status it does not own.
//
// HOW IT REACHES AIRTABLE. Through the existing outbox, not a direct write: the push is retried on
// failure, `airtablePushedAt` suppresses the echo on the next inbound pull, and the drain runs
// after the response so the user is not waiting on Airtable. The tray reads Airtable live, so once
// the drain lands the asset simply leaves the tray.

export interface DateResult {
  ok: boolean;
  error?: string;
}

/** Any signed-in user may date an asset. It is the field nobody owns; gate-keeping it helps no one. */
export async function setLiveDateAction(airtableId: string, date: string): Promise<DateResult> {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) return { ok: false, error: 'Not signed in.' };

  // Airtable stores this as a plain date. Anything else would be written verbatim and silently
  // produce an unparseable value that the calendar would then drop.
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return { ok: false, error: 'Pick a date.' };
  }

  const video = await prisma.vishenVideo.findUnique({
    where: { airtableId },
    select: { id: true, name: true },
  });
  if (!video) {
    // The mirror is refreshed on a schedule, so a very new asset can exist in Airtable and not
    // here yet. Say so rather than failing opaquely.
    return { ok: false, error: 'This asset is not in the local mirror yet — try again after the next sync.' };
  }

  await prisma.$transaction([
    prisma.vishenVideo.update({
      where: { id: video.id },
      data: { liveDate: date, liveDateSetBy: email.toLowerCase(), liveDateSetAt: new Date() },
    }),
    prisma.airtableOutbox.create({
      data: { entity: 'vishenVideo', entityId: video.id, op: 'upsert' },
    }),
  ]);

  // The calendar readers memoise their Airtable reads (lib/cache/swr.ts). Drop them now, so the
  // next render does not serve a pre-write snapshot, and AGAIN once the drain has actually landed
  // the value in Airtable — until then a fresh read still returns the old Live Date.
  invalidateCalendarCaches();
  scheduleOutboxDrain(invalidateCalendarCaches);
  revalidatePath('/studio/comms-calendar/not-dated');
  revalidatePath('/studio/comms-calendar');
  revalidatePath('/performance/week');
  return { ok: true };
}
