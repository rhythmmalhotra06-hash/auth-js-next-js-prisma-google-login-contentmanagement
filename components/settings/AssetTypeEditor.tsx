'use client';

import { useState, useTransition } from 'react';
import { saveAssetTypeDna } from '@/app/settings/asset-types/actions';
import { setDnaRuleActiveAction, dismissProposedDnaRuleAction, addDnaRule } from '@/app/settings/dna-actions';
import type { AssetTypeDnaRow } from '@/lib/asset-types/repository';

interface DnaRuleView {
  id: string;
  statement: string;
  rationale: string | null;
  active: boolean;
  source: string;
  note: string | null;
}

function LearnedRules({ assetTypePgId, rules, canEdit }: { assetTypePgId: string; rules: DnaRuleView[]; canEdit: boolean }) {
  const [pending, start] = useTransition();
  const [newRule, setNewRule] = useState('');
  const [newRationale, setNewRationale] = useState('');
  const active = rules.filter((r) => r.active);
  const pendingRules = rules.filter((r) => !r.active);

  function toggle(ruleId: string, next: boolean) {
    start(async () => { await setDnaRuleActiveAction(assetTypePgId, ruleId, next); });
  }
  function dismiss(ruleId: string) {
    start(async () => { await dismissProposedDnaRuleAction(assetTypePgId, ruleId); });
  }
  function addRule() {
    const s = newRule.trim();
    if (!s) return;
    start(async () => {
      await addDnaRule(assetTypePgId, s, newRationale);
      setNewRule('');
      setNewRationale('');
    });
  }

  if (!canEdit && !rules.length) return null;

  return (
    <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid var(--border-default)' }}>
      <label style={{ display: 'block', marginBottom: 6, fontSize: 13, fontWeight: 600 }}>Learned rules</label>
      {rules.length === 0 && <p className="subtle text-xs">No learned rules yet — they build up from approval overrides, finding reactions, and performance signal.</p>}
      {active.map((r) => (
        <div key={r.id} className="row-between" style={{ fontSize: 12.5, padding: '4px 0' }}>
          <span>{r.statement}{r.rationale ? <span className="subtle"> — {r.rationale}</span> : null}</span>
          {canEdit && <button className="btn ghost sm" disabled={pending} onClick={() => toggle(r.id, false)}>Deactivate</button>}
        </div>
      ))}
      {pendingRules.length > 0 && (
        <div style={{ marginTop: 8 }}>
          <span className="subtle text-xs">Pending approval ({pendingRules.length}):</span>
          {pendingRules.map((r) => (
            <div key={r.id} className="row-between" style={{ fontSize: 12.5, padding: '4px 0' }}>
              <span>{r.statement}{r.rationale ? <span className="subtle"> — {r.rationale}</span> : null}</span>
              {canEdit && (
                <span className="flex items-center gap-2">
                  <button className="btn sm" disabled={pending} onClick={() => toggle(r.id, true)}>Approve</button>
                  <button className="btn ghost sm" disabled={pending} onClick={() => dismiss(r.id)}>Dismiss</button>
                </span>
              )}
            </div>
          ))}
        </div>
      )}
      {canEdit && (
        <div style={{ marginTop: 8, display: 'flex', gap: 6 }}>
          <input className="rounded-sm border border-border-default px-2 py-1 text-xs" style={{ flex: 1 }} placeholder="Add a rule…" value={newRule} onChange={(e) => setNewRule(e.target.value)} />
          <input className="rounded-sm border border-border-default px-2 py-1 text-xs" style={{ flex: 1 }} placeholder="Why (optional)" value={newRationale} onChange={(e) => setNewRationale(e.target.value)} />
          <button className="btn sm" disabled={pending || !newRule.trim()} onClick={addRule}>Add</button>
        </div>
      )}
    </div>
  );
}

const taCls =
  'w-full rounded-sm border border-border-default px-3 py-2 text-sm text-text outline-none focus-visible:border-brand focus-visible:shadow-[var(--mv-shadow-focus)] disabled:opacity-60';

function Refs({ label, values }: { label: string; values: string[] }) {
  return (
    <div className="field-row">
      <div className="k">{label}</div>
      <div className="v">{values.length ? values.join(', ') : <span className="subtle">—</span>}</div>
    </div>
  );
}

function Row({ row, canEdit, canGovernDna, dnaRules }: { row: AssetTypeDnaRow; canEdit: boolean; canGovernDna: boolean; dnaRules: DnaRuleView[] }) {
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
    <div className="card pad mb-3.5">
      <div className="row-between mb-2">
        <h3 className="text-base">{row.name}</h3>
        {!canEdit && <span className="subtle text-xs">read-only · you don’t lead this asset type</span>}
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
        <div className="flex items-center gap-2.5 mt-2.5">
          <button className="btn sm" onClick={save} disabled={pending || !dirty}>
            {pending ? 'Saving…' : 'Save'}
          </button>
          {msg && <span className="text-xs text-success-content">{msg}</span>}
          {err && <span className="text-xs text-danger-content">{err}</span>}
          {row.updatedBy && !msg && !err && <span className="subtle text-xs">last edited by {row.updatedBy}</span>}
        </div>
      )}

      {row.assetTypePgId && (
        <LearnedRules assetTypePgId={row.assetTypePgId} rules={dnaRules} canEdit={canGovernDna} />
      )}
    </div>
  );
}

export function AssetTypeEditor({
  rows,
  myEmployeeId,
  isAdmin,
  canGovernDna = false,
  dnaRulesByAssetType = {},
}: {
  rows: AssetTypeDnaRow[];
  myEmployeeId: string | null;
  isAdmin: boolean;
  /** Manager/approver/founder oversight — broader than DNA-text edit rights (admin +
   *  team lead). Computed server-side in app/settings/asset-types/page.tsx. */
  canGovernDna?: boolean;
  dnaRulesByAssetType?: Record<string, DnaRuleView[]>;
}) {
  if (rows.length === 0) return <div className="empty">No active asset types found.</div>;
  return (
    <div>
      {rows.map((row) => {
        const teamLeadOfThis = !!myEmployeeId && row.teamLeadIds.includes(myEmployeeId);
        return (
          <Row
            key={row.id}
            row={row}
            canEdit={isAdmin || teamLeadOfThis}
            canGovernDna={isAdmin || canGovernDna || teamLeadOfThis}
            dnaRules={(row.assetTypePgId && dnaRulesByAssetType[row.assetTypePgId]) || []}
          />
        );
      })}
    </div>
  );
}
