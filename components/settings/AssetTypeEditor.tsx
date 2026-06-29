'use client';

import { useState, useTransition } from 'react';
import { saveAssetTypeDna } from '@/app/settings/asset-types/actions';
import type { AssetTypeDnaRow } from '@/lib/asset-types/repository';

const taCls =
  'w-full rounded-[8px] border border-border-default px-3 py-2 text-sm text-text outline-none focus-visible:border-brand focus-visible:shadow-[var(--mv-shadow-focus)] disabled:opacity-60';

function Refs({ label, values }: { label: string; values: string[] }) {
  return (
    <div className="field-row">
      <div className="k">{label}</div>
      <div className="v">{values.length ? values.join(', ') : <span className="subtle">—</span>}</div>
    </div>
  );
}

function Row({ row, canEdit }: { row: AssetTypeDnaRow; canEdit: boolean }) {
  const [requirements, setRequirements] = useState(row.requirements ?? '');
  const [feedback, setFeedback] = useState(row.feedbackStandards ?? '');
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const dirty = requirements !== (row.requirements ?? '') || feedback !== (row.feedbackStandards ?? '');

  function save() {
    setErr(null); setMsg(null);
    start(async () => {
      const res = await saveAssetTypeDna(row.id, requirements, feedback);
      if (res.ok) setMsg('Saved');
      else setErr(res.error ?? 'Failed to save');
    });
  }

  return (
    <div className="card pad" style={{ marginBottom: 14 }}>
      <div className="row-between" style={{ marginBottom: 8 }}>
        <h3 style={{ fontSize: 16, margin: 0 }}>{row.name}</h3>
        {!canEdit && <span className="subtle" style={{ fontSize: 12 }}>read-only · you don’t lead this asset type</span>}
      </div>
      <div className="grid2">
        <Refs label="Event types" values={row.eventTypes} />
        <Refs label="Team lead" values={row.teamLeads} />
        <Refs label="Preferred editor" values={row.preferredEditors} />
        <Refs label="Dimensions" values={row.dimensions} />
      </div>

      <label style={{ display: 'block', marginTop: 12, fontSize: 13, fontWeight: 600 }}>DNA / Requirements</label>
      <textarea className={taCls} rows={4} value={requirements} disabled={!canEdit || pending}
        onChange={(e) => setRequirements(e.target.value)} placeholder="What this asset type is, its creative DNA and production requirements…" />

      <label style={{ display: 'block', marginTop: 10, fontSize: 13, fontWeight: 600 }}>Feedback standards</label>
      <textarea className={taCls} rows={3} value={feedback} disabled={!canEdit || pending}
        onChange={(e) => setFeedback(e.target.value)} placeholder="What ‘good’ looks like — the bar reviewers hold this to…" />

      {canEdit && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 10 }}>
          <button className="btn sm" onClick={save} disabled={pending || !dirty}>
            {pending ? 'Saving…' : 'Save'}
          </button>
          {msg && <span className="subtle" style={{ fontSize: 12, color: 'var(--green-content, green)' }}>{msg}</span>}
          {err && <span style={{ fontSize: 12, color: 'var(--red-content)' }}>{err}</span>}
          {row.updatedBy && !msg && !err && <span className="subtle" style={{ fontSize: 12 }}>last edited by {row.updatedBy}</span>}
        </div>
      )}
    </div>
  );
}

export function AssetTypeEditor({ rows, myEmployeeId, isAdmin }: { rows: AssetTypeDnaRow[]; myEmployeeId: string | null; isAdmin: boolean }) {
  if (rows.length === 0) return <div className="empty">No active asset types found.</div>;
  return (
    <div>
      {rows.map((row) => (
        <Row key={row.id} row={row} canEdit={isAdmin || (!!myEmployeeId && row.teamLeadIds.includes(myEmployeeId))} />
      ))}
    </div>
  );
}
