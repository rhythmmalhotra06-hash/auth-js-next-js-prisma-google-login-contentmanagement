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
function LinkField({ ticketId, fieldKey, label, initial }: {
  ticketId: string; fieldKey: keyof AssetLinkValues; label: string; initial: string | null;
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
    <Field label={label}>
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
      <div className="grid2">
        <LinkField ticketId={ticketId} fieldKey="assetFolderLink" label="Asset Folder Link" initial={values.assetFolderLink} />
        <LinkField ticketId={ticketId} fieldKey="workingFiles" label="Working Files" initial={values.workingFiles} />
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
