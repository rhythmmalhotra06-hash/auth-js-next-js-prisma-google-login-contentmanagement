'use client';

// What we learned — staged → committed, with the origin of each line visible.
//
// Decision AA2: both AI-drafted and human-drafted lines live here, and they are DISTINGUISHABLE.
// An AI proposal wears "Proposed by the system"; editing one drops the marker, because a human has
// then put their name behind the words. Only a human ever commits.
//
// That is the literal shape of Glen's condition. His worry was not AI per se — it was a
// plausible-sounding wrong recommendation reaching the room unchallenged ("if efficiency is a
// recommendation and that's not true, it might derail everything"). Attribution plus a commit gate
// answers that; hiding the origin would not.
//
// U7: every committed learning is STORED, the top five render, the rest sit behind "show all".
// Capping the display is not the same as capping the data.

import { useState, useTransition } from 'react';
import { StagedBlock } from '@/components/ui/StagedBlock';
import { EmptyFine } from '@/components/ui/Empty';
import { addLearningAction, editLearningAction, deleteLearningAction } from '@/app/performance/week/actions';

export interface LearningRow {
  id: string;
  textStaged: string | null;
  textCommitted: string | null;
  leverOwner: string | null;
  proposed: boolean;
  committedBy: string | null;
  committedAt: string | null;
  createdAt: string;
}

const VISIBLE = 5;

function Row({
  l,
  canEdit,
  weekId,
  onError,
}: {
  l: LearningRow;
  canEdit: boolean;
  weekId: string;
  onError: (e: string | null) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(l.textStaged ?? l.textCommitted ?? '');
  const [owner, setOwner] = useState(l.leverOwner ?? '');
  const [pending, start] = useTransition();

  const committed = !!l.committedAt;
  const body = l.textCommitted ?? l.textStaged ?? '';

  const save = () => {
    onError(null);
    start(async () => {
      const res = await editLearningAction(weekId, l.id, text, owner.trim() || null);
      if (!res.ok) onError(res.error ?? 'Could not save.');
      else setEditing(false);
    });
  };

  if (editing) {
    return (
      <div className="flex flex-col gap-2 rounded-sm border border-border-strong bg-surface p-3">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={3}
          className="w-full rounded-sm border border-border-default bg-surface p-2 text-[13px] leading-snug"
        />
        <input
          value={owner}
          onChange={(e) => setOwner(e.target.value)}
          placeholder="Lever → owner (e.g. retention → editor)"
          className="w-full rounded-sm border border-border-default bg-surface px-2 py-1.5 text-xs"
        />
        <div className="flex gap-2">
          <button
            type="button"
            onClick={save}
            disabled={pending}
            className="rounded-sm bg-brand px-3 py-1.5 text-2xs font-semibold text-white disabled:opacity-50"
          >
            Save
          </button>
          <button
            type="button"
            onClick={() => setEditing(false)}
            className="rounded-sm border border-border-strong px-3 py-1.5 text-2xs font-medium text-text-muted"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <StagedBlock
      state={committed ? 'committed' : l.proposed ? 'proposed' : 'staged'}
      by={l.committedBy}
      at={committed ? l.committedAt : l.createdAt}
      actions={
        canEdit && !committed ? (
          <>
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="text-2xs font-medium text-brand hover:underline"
            >
              Edit
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => {
                onError(null);
                start(async () => {
                  const res = await deleteLearningAction(l.id);
                  if (!res.ok) onError(res.error ?? 'Could not delete.');
                });
              }}
              className="text-2xs font-medium text-text-subtle hover:text-danger-content hover:underline"
            >
              Remove
            </button>
          </>
        ) : null
      }
    >
      <p className="text-[13px] leading-relaxed text-pretty text-text">{body}</p>
      {l.leverOwner ? (
        // The lever and its owner — free text for 14 Sep (S16). A learning nobody owns is an
        // observation, not a change.
        <p className="mt-1 text-2xs text-text-muted">{l.leverOwner}</p>
      ) : null}
    </StagedBlock>
  );
}

export function Learnings({
  weekId,
  brandLabel,
  learnings,
  canEdit,
}: {
  weekId: string;
  brandLabel: string;
  learnings: LearningRow[];
  canEdit: boolean;
}) {
  const [showAll, setShowAll] = useState(false);
  const [adding, setAdding] = useState(false);
  const [text, setText] = useState('');
  const [owner, setOwner] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const shown = showAll ? learnings : learnings.slice(0, VISIBLE);

  const add = () => {
    setError(null);
    start(async () => {
      const res = await addLearningAction(weekId, text, owner.trim() || null);
      if (!res.ok) setError(res.error ?? 'Could not save.');
      else {
        setText('');
        setOwner('');
        setAdding(false);
      }
    });
  };

  return (
    <div className="rounded-md border border-border-default bg-surface p-[18px]">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-2xs font-semibold uppercase tracking-[.08em] text-text-subtle">
          What we learned · {brandLabel}
        </h3>
        {canEdit && !adding ? (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="rounded-sm border border-border-strong bg-surface px-3 py-1.5 text-2xs font-semibold text-text hover:bg-bg-subtle"
          >
            Add
          </button>
        ) : null}
      </div>

      {learnings.length === 0 && !adding ? (
        <div className="mt-3">
          <EmptyFine>
            Nothing recorded yet. A learning is what changes next week — the lever and who owns it.
          </EmptyFine>
        </div>
      ) : (
        <div className="mt-3 flex flex-col gap-3.5">
          {shown.map((l) => (
            <Row key={l.id} l={l} canEdit={canEdit} weekId={weekId} onError={setError} />
          ))}
        </div>
      )}

      {learnings.length > VISIBLE ? (
        <button
          type="button"
          onClick={() => setShowAll(!showAll)}
          className="mt-3 text-2xs font-medium text-brand hover:underline"
        >
          {showAll ? 'Show top five' : `Show all ${learnings.length}`}
        </button>
      ) : null}

      {adding ? (
        <div className="mt-3 flex flex-col gap-2 rounded-sm border border-border-strong p-3">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={3}
            placeholder="What did this week teach us?"
            className="w-full rounded-sm border border-border-default bg-surface p-2 text-[13px] leading-snug"
          />
          <input
            value={owner}
            onChange={(e) => setOwner(e.target.value)}
            placeholder="Lever → owner (e.g. thumbnail CTR → packaging)"
            className="w-full rounded-sm border border-border-default bg-surface px-2 py-1.5 text-xs"
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={add}
              disabled={pending || !text.trim()}
              className="rounded-sm bg-brand px-3 py-1.5 text-2xs font-semibold text-white disabled:opacity-50"
            >
              Stage it
            </button>
            <button
              type="button"
              onClick={() => setAdding(false)}
              className="rounded-sm border border-border-strong px-3 py-1.5 text-2xs font-medium text-text-muted"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}

      {error ? <div className="mt-2 text-xs text-danger-content">{error}</div> : null}
    </div>
  );
}
