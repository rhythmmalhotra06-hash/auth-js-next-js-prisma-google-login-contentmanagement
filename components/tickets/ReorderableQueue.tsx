'use client';

import { useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import type { QueueTicket } from '@/lib/tickets/data';
import { setQueueOrder } from '@/app/manager/actions';

function Badge({ value, kind }: { value: string | null; kind: 'ticket' | 'prio' }) {
  if (!value) return <span className="text-neutral-400">—</span>;
  const cls = kind === 'prio' ? 'bg-[#572280]/10 text-[#572280]' : 'bg-neutral-100 text-neutral-700';
  return <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}>{value}</span>;
}

export function ReorderableQueue({ tickets }: { tickets: QueueTicket[] }) {
  const [items, setItems] = useState(tickets);
  const dragIndex = useRef<number | null>(null);
  const [pending, start] = useTransition();
  const [saved, setSaved] = useState(false);
  const router = useRouter();

  if (items.length === 0) {
    return <div className="rounded-xl border border-dashed border-neutral-300 p-10 text-center text-sm text-neutral-500">No tickets yet.</div>;
  }

  function onDragOver(e: React.DragEvent, i: number) {
    e.preventDefault();
    const from = dragIndex.current;
    if (from === null || from === i) return;
    setItems((prev) => {
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(i, 0, moved);
      return next;
    });
    dragIndex.current = i;
  }

  function onDrop() {
    dragIndex.current = null;
    start(async () => {
      await setQueueOrder(items.map((t) => t.id));
      setSaved(true);
      router.refresh();
    });
  }

  return (
    <div>
      <div className="mb-2 h-4 text-xs text-neutral-400">
        {pending ? 'Saving order…' : saved ? 'Order saved — queue rank overrides the score.' : 'Drag rows to set the queue order.'}
      </div>
      <div className="overflow-x-auto rounded-xl border border-neutral-200">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-neutral-200 bg-neutral-50 text-left text-xs uppercase tracking-wide text-neutral-500">
              <th className="w-8 px-2 py-3" />
              <th className="px-4 py-3 font-medium">Title</th>
              <th className="px-4 py-3 font-medium">Priority</th>
              <th className="px-4 py-3 font-medium">Assigned</th>
              <th className="px-4 py-3 font-medium">Ticket Status</th>
              <th className="px-4 py-3 font-medium">Priority Status</th>
              <th className="px-4 py-3 font-medium">Event Type</th>
              <th className="px-4 py-3 font-medium">Asset Type</th>
              <th className="px-4 py-3 font-medium">Due</th>
            </tr>
          </thead>
          <tbody>
            {items.map((t, i) => (
              <tr
                key={t.id}
                draggable
                onDragStart={() => { dragIndex.current = i; setSaved(false); }}
                onDragOver={(e) => onDragOver(e, i)}
                onDragEnd={onDrop}
                className="cursor-move border-b border-neutral-100 last:border-0 hover:bg-neutral-50"
              >
                <td className="select-none px-2 py-3 text-center text-neutral-300" title="Drag to reorder">⠿</td>
                <td className="px-4 py-3 font-medium">
                  <Link href={`/tickets/${t.id}`} className="text-[#572280] hover:underline">{t.title}</Link>
                </td>
                <td className="px-4 py-3 text-neutral-700">{t.priorityScore ?? <span className="text-neutral-400">unscored</span>}</td>
                <td className="px-4 py-3 text-neutral-700">{t.assignee ?? <span className="text-neutral-400">unassigned</span>}</td>
                <td className="px-4 py-3"><Badge value={t.ticketStatus} kind="ticket" /></td>
                <td className="px-4 py-3"><Badge value={t.prioStatus} kind="prio" /></td>
                <td className="px-4 py-3 text-neutral-600">{t.eventType ?? '—'}</td>
                <td className="px-4 py-3 text-neutral-600">{t.assetType ?? '—'}</td>
                <td className="px-4 py-3 text-neutral-600">{t.dueDate ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
