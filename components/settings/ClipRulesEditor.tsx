'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { addRule, setRuleActive, updateRowContent } from '@/app/settings/actions';

const inputCls =
  'w-full rounded-[8px] border border-border-default px-3 py-2 text-sm text-text outline-none focus-visible:border-brand focus-visible:shadow-[var(--mv-shadow-focus)] disabled:opacity-60';

const RULE_SECTIONS = ['General', 'Clips', 'Thumbnail', 'Titles', 'Distribution'] as const;

export interface EditorRule {
  id: string;
  content: string | null;
  clipType: string | null;
  section: string | null;
  note: string | null;
  active: boolean;
  updatedBy: string | null;
}

export interface ClipRulesEditorProps {
  basePrompt: { id: string; content: string } | null;
  pillars: { id: string; content: string } | null;
  rules: EditorRule[];
  ruleScopes: readonly string[]; // All | Reel | Stage Talk | Short
  canEdit: boolean;
}

function Msg({ msg }: { msg: { ok: boolean; text: string } | null }) {
  if (!msg) return null;
  return (
    <div className={`mt-2 rounded-[8px] px-3 py-2 text-sm ${msg.ok ? 'bg-brand-soft text-brand-content' : 'bg-red-50 text-danger'}`}>
      {msg.text}
    </div>
  );
}

/** A long-text row (Base Prompt / Brand Pillars) with its own Save button. */
function SaveableText({
  id,
  label,
  hint,
  initial,
  rows,
  canEdit,
}: {
  id: string;
  label: string;
  hint?: string;
  initial: string;
  rows: number;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [value, setValue] = useState(initial);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const dirty = value !== initial;

  function save() {
    setMsg(null);
    start(async () => {
      const res = await updateRowContent(id, value);
      setMsg(res.ok ? { ok: true, text: 'Saved.' } : { ok: false, text: res.error ?? 'Failed to save.' });
      if (res.ok) router.refresh();
    });
  }

  return (
    <section className="rounded-[12px] bg-surface p-6 shadow-sm ring-1 ring-border-default">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-sm font-semibold text-text">{label}</h2>
        {canEdit && (
          <button
            onClick={save}
            disabled={pending || !dirty}
            className="rounded-[8px] bg-brand px-3.5 py-1.5 text-sm font-medium text-white hover:bg-brand-bright disabled:opacity-50"
          >
            {pending ? 'Saving…' : 'Save'}
          </button>
        )}
      </div>
      {hint && <p className="mt-1 text-xs text-text-muted">{hint}</p>}
      <textarea
        className={`${inputCls} mt-3 font-mono text-[13px] leading-relaxed`}
        rows={rows}
        value={value}
        disabled={!canEdit}
        onChange={(e) => setValue(e.target.value)}
      />
      <Msg msg={msg} />
    </section>
  );
}

function RuleRow({ rule, canEdit }: { rule: EditorRule; canEdit: boolean }) {
  const router = useRouter();
  const [value, setValue] = useState(rule.content ?? '');
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const dirty = value !== (rule.content ?? '');

  function run(fn: () => Promise<{ ok: boolean; error?: string }>, okText: string) {
    setMsg(null);
    start(async () => {
      const res = await fn();
      setMsg(res.ok ? { ok: true, text: okText } : { ok: false, text: res.error ?? 'Failed.' });
      if (res.ok) router.refresh();
    });
  }

  return (
    <div className={`rounded-[10px] border p-3 ${rule.active ? 'border-border-default bg-surface' : 'border-dashed border-border-default bg-bg-subtle'}`}>
      <div className="mb-2 flex flex-wrap items-center gap-2 text-[11px]">
        {rule.section && <span className="rounded-full bg-bg-subtle px-2 py-0.5 text-text-muted ring-1 ring-border-default">{rule.section}</span>}
        {!rule.active && <span className="rounded-full bg-bg-subtle px-2 py-0.5 text-text-subtle">Inactive</span>}
        {rule.updatedBy && <span className="text-text-subtle">· {rule.updatedBy}</span>}
      </div>
      <textarea
        className={`${inputCls} text-[13px]`}
        rows={2}
        value={value}
        disabled={!canEdit}
        onChange={(e) => setValue(e.target.value)}
      />
      {rule.note && <p className="mt-1 text-xs text-text-subtle">Why: {rule.note}</p>}
      {canEdit && (
        <div className="mt-2 flex items-center gap-2">
          <button
            onClick={() => run(() => updateRowContent(rule.id, value), 'Saved.')}
            disabled={pending || !dirty}
            className="rounded-[8px] bg-brand px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-bright disabled:opacity-50"
          >
            Save
          </button>
          <button
            onClick={() => run(() => setRuleActive(rule.id, !rule.active), rule.active ? 'Deactivated.' : 'Activated.')}
            disabled={pending}
            className="rounded-[8px] px-3 py-1.5 text-xs font-medium text-text-muted ring-1 ring-border-default hover:bg-bg-subtle disabled:opacity-50"
          >
            {rule.active ? 'Deactivate' : 'Activate'}
          </button>
        </div>
      )}
      <Msg msg={msg} />
    </div>
  );
}

function AddRuleForm({ ruleScopes }: { ruleScopes: readonly string[] }) {
  const router = useRouter();
  const [content, setContent] = useState('');
  const [clipType, setClipType] = useState(ruleScopes[0] ?? 'All');
  const [section, setSection] = useState('');
  const [note, setNote] = useState('');
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();

  function add() {
    setMsg(null);
    start(async () => {
      const res = await addRule({ content, clipType, section: section || undefined, note: note || undefined });
      if (res.ok) {
        setContent('');
        setNote('');
        setMsg({ ok: true, text: 'Rule added.' });
        router.refresh();
      } else {
        setMsg({ ok: false, text: res.error ?? 'Failed to add rule.' });
      }
    });
  }

  return (
    <div className="rounded-[10px] border border-dashed border-border-default p-4">
      <h3 className="text-sm font-semibold text-text">Add a rule / learning</h3>
      <p className="mt-0.5 text-xs text-text-muted">Appended to the base prompt for the chosen clip type. “All” applies to every type.</p>
      <textarea
        className={`${inputCls} mt-3 text-[13px]`}
        rows={2}
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="e.g. Always include at least one contrarian-take clip."
      />
      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        <label className="block text-xs font-medium text-text-muted">
          Clip type
          <select className={`${inputCls} mt-1`} value={clipType} onChange={(e) => setClipType(e.target.value)}>
            {ruleScopes.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </label>
        <label className="block text-xs font-medium text-text-muted">
          Section (optional)
          <select className={`${inputCls} mt-1`} value={section} onChange={(e) => setSection(e.target.value)}>
            <option value="">—</option>
            {RULE_SECTIONS.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </label>
      </div>
      <input
        className={`${inputCls} mt-2`}
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Why this rule? (optional context for the team)"
      />
      <div className="mt-3">
        <button
          onClick={add}
          disabled={pending || !content.trim()}
          className="rounded-[8px] bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-bright disabled:opacity-50"
        >
          {pending ? 'Adding…' : '+ Add rule'}
        </button>
      </div>
      <Msg msg={msg} />
    </div>
  );
}

export function ClipRulesEditor({ basePrompt, pillars, rules, ruleScopes, canEdit }: ClipRulesEditorProps) {
  // Group rules by clip type, preserving the ruleScopes ordering.
  const byType = ruleScopes
    .map((scope) => ({ scope, items: rules.filter((r) => (r.clipType ?? 'All') === scope) }))
    .filter((g) => g.items.length > 0);

  return (
    <div className="space-y-5">
      {!canEdit && (
        <div className="rounded-[8px] bg-amber-50 px-3 py-2 text-sm text-text">
          Read-only — editing clip rules requires the <strong>Admin</strong> role. Ask an admin to grant it in the Admin panel.
        </div>
      )}

      {basePrompt ? (
        <SaveableText
          id={basePrompt.id}
          label="Base system prompt"
          hint="The core instruction the engine runs for every generation. Keep the “Return your answer strictly in the required JSON structure.” line."
          initial={basePrompt.content}
          rows={18}
          canEdit={canEdit}
        />
      ) : (
        <div className="rounded-[8px] bg-red-50 px-3 py-2 text-sm text-danger">
          No active “Base Prompt” row found in Airtable — the engine is using the built-in fallback prompt.
        </div>
      )}

      {pillars && (
        <SaveableText
          id={pillars.id}
          label="Default brand pillars"
          hint="Audience interests injected when a request doesn’t specify its own."
          initial={pillars.content}
          rows={2}
          canEdit={canEdit}
        />
      )}

      <section className="rounded-[12px] bg-surface p-6 shadow-sm ring-1 ring-border-default">
        <h2 className="text-sm font-semibold text-text">Rules & learnings</h2>
        <p className="mt-1 text-xs text-text-muted">Appended to the base prompt at generation time, scoped by clip type.</p>

        <div className="mt-4 space-y-5">
          {byType.length === 0 && <p className="text-sm text-text-muted">No rules yet. Add the first one below.</p>}
          {byType.map((group) => (
            <div key={group.scope}>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-subtle">{group.scope}</h3>
              <div className="space-y-2">
                {group.items.map((r) => (
                  <RuleRow key={r.id} rule={r} canEdit={canEdit} />
                ))}
              </div>
            </div>
          ))}
        </div>

        {canEdit && (
          <div className="mt-5">
            <AddRuleForm ruleScopes={ruleScopes} />
          </div>
        )}
      </section>
    </div>
  );
}
