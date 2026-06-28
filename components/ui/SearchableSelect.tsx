'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Icon } from '@/components/ui/Icon';

export interface SelectOption { value: string; label: string; group?: string }

// A filterable dropdown: looks like a native select, but the popover carries a
// search box so long lists (editors, contractors, event types…) are type-to-filter.
// Keyboard: type to filter, ↑/↓ to move, Enter to choose, Esc to close.
export function SearchableSelect({
  value, onChange, options, placeholder = 'Select…', allLabel, searchPlaceholder = 'Search…',
  ariaLabel, width,
}: {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  /** When set, an "all/clear" row (value "") is shown first and used as the empty-state label. */
  allLabel?: string;
  searchPlaceholder?: string;
  ariaLabel?: string;
  width?: number | string;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [active, setActive] = useState(0);
  const wrapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const selected = options.find((o) => o.value === value);
  const triggerLabel = value ? selected?.label ?? placeholder : allLabel ?? placeholder;

  const rows = useMemo<SelectOption[]>(() => {
    const n = q.trim().toLowerCase();
    const matched = n ? options.filter((o) => o.label.toLowerCase().includes(n)) : options;
    return allLabel ? [{ value: '', label: allLabel }, ...matched] : matched;
  }, [options, q, allLabel]);

  useEffect(() => {
    if (!open) return;
    setQ('');
    setActive(0);
    const r = requestAnimationFrame(() => inputRef.current?.focus());
    function onDoc(e: MouseEvent) { if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false); }
    document.addEventListener('mousedown', onDoc);
    return () => { cancelAnimationFrame(r); document.removeEventListener('mousedown', onDoc); };
  }, [open]);

  useEffect(() => { setActive(0); }, [q]);

  function choose(v: string) { onChange(v); setOpen(false); }

  function onKey(e: React.KeyboardEvent) {
    if (e.key === 'Escape') { setOpen(false); return; }
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(a + 1, rows.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
    else if (e.key === 'Enter') { e.preventDefault(); const r = rows[active]; if (r) choose(r.value); }
  }

  let lastGroup: string | undefined;

  return (
    <div className="ssel" ref={wrapRef} style={{ width }}>
      <button type="button" className="ssel-trigger" aria-haspopup="listbox" aria-expanded={open}
        aria-label={ariaLabel} onClick={() => setOpen((o) => !o)}>
        <span className={value ? '' : 'ssel-ph'}>{triggerLabel}</span>
        <Icon name="chevron" size={14} className="ssel-chev" />
      </button>
      {open && (
        <div className="ssel-pop">
          <div className="ssel-search">
            <Icon name="search" size={14} />
            <input ref={inputRef} type="search" value={q} placeholder={searchPlaceholder}
              onChange={(e) => setQ(e.target.value)} onKeyDown={onKey} aria-label={searchPlaceholder} />
          </div>
          <div className="ssel-list" role="listbox" ref={listRef}>
            {rows.length === 0 && <div className="ssel-empty">No matches</div>}
            {rows.map((o, i) => {
              const showGroup = o.group && o.group !== lastGroup;
              lastGroup = o.group ?? lastGroup;
              return (
                <div key={`${o.group ?? ''}:${o.value}`}>
                  {showGroup && <div className="ssel-group">{o.group}</div>}
                  <button type="button" role="option" aria-selected={o.value === value}
                    className={`ssel-opt${i === active ? ' active' : ''}${o.value === value ? ' sel' : ''}`}
                    onMouseEnter={() => setActive(i)} onClick={() => choose(o.value)}>
                    <span>{o.label}</span>
                    {o.value === value && <Icon name="check" size={13} />}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
