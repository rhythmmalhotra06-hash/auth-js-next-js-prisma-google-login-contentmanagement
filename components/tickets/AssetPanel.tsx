'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { updateTicketLink } from '@/app/tickets/[id]/actions';
import { Field, Input } from '@/components/ui/Field';
import { Icon } from '@/components/ui/Icon';

export interface AssetLinkValues {
  assetFolderLink: string | null;
  workingFiles: string | null;
  final16x9: string | null;
  folder16x9: string | null;
  final9x16: string | null;
  folder9x16: string | null;
  final4x5: string | null;
  folder4x5: string | null;
}

const isUrl = (v: string) => /^https?:\/\//i.test(v.trim());

// One editable delivery link, bound to an Airtable field. Saves on blur when the value
// changed; optimistic with rollback + inline error on failure.
function LinkField({ ticketId, fieldKey, label, initial, hint }: {
  ticketId: string; fieldKey: keyof AssetLinkValues; label: string; initial: string | null; hint?: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [value, setValue] = useState(initial ?? '');
  const [saved, setSaved] = useState(initial ?? '');
  const [err, setErr] = useState<string | null>(null);

  function commit() {
    const v = value.trim();
    if (v === saved.trim()) return; // unchanged — skip the write
    setErr(null);
    start(async () => {
      const r = await updateTicketLink(ticketId, fieldKey, v);
      if (r.ok) { setSaved(v); setValue(v); router.refresh(); }
      else { setErr(r.error ?? 'Could not save'); }
    });
  }

  return (
    <Field label={label} hint={hint}>
      <div className="flex items-center gap-2">
        <Input
          value={value}
          disabled={pending}
          onChange={(e) => setValue(e.target.value)}
          onBlur={commit}
          placeholder="Paste a link…"
        />
        {saved.trim() && isUrl(saved) && (
          <a href={saved} target="_blank" rel="noreferrer"
            className="inline-flex shrink-0 items-center gap-1 text-xs text-brand hover:underline">
            Open <Icon name="arrow" size={12} />
          </a>
        )}
      </div>
      {pending && <p className="text-2xs text-text-subtle">Saving…</p>}
      {err && <p className="text-2xs text-danger">{err}</p>}
    </Field>
  );
}

const RATIOS = [
  { label: '16×9', final: 'final16x9', folder: 'folder16x9' },
  { label: '9×16', final: 'final9x16', folder: 'folder9x16' },
  { label: '4×5', final: 'final4x5', folder: 'folder4x5' },
] as const;

export function AssetPanel({ ticketId, isAds, values }: {
  ticketId: string; isAds: boolean; values: AssetLinkValues;
}) {
  return (
    <div className="space-y-4">
      {/* Labels match the LIVE Airtable field names, not our column names (verified
          2026-09-08). The team restructured these: `assetFolderLink` is Airtable's
          "Feedback Link" and carries the Dropbox Replay review link while a ticket is in
          review; `workingFiles` is "Final Output Folder Link" and is only filled after
          approval. Per Titus: "no one reviews in Dropbox — once it's approved, that's when
          the final output folder is created." The Postgres column names are left alone. */}
      <div className="grid2">
        <LinkField ticketId={ticketId} fieldKey="assetFolderLink" label="Feedback link (review)"
          hint="Dropbox Replay link reviewers comment on" initial={values.assetFolderLink} />
        <LinkField ticketId={ticketId} fieldKey="workingFiles" label="Final output folder"
          hint="created once the work is approved" initial={values.workingFiles} />
      </div>

      {isAds && (
        <div className="space-y-3 border-t border-border-muted pt-4">
          <p className="text-2xs font-semibold uppercase tracking-wide text-text-subtle">
            Ad ratios <span className="font-normal normal-case text-text-subtle">· final link & folder per aspect ratio</span>
          </p>
          {RATIOS.map((r) => (
            <div key={r.final} className="grid2">
              <LinkField ticketId={ticketId} fieldKey={r.final} label={`${r.label} Final Link`} initial={values[r.final]} />
              <LinkField ticketId={ticketId} fieldKey={r.folder} label={`${r.label} Folder`} initial={values[r.folder]} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
