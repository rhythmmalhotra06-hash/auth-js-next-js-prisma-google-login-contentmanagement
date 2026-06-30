'use client';

import { useEffect } from 'react';

// Right-side detail drawer (480px). Esc / backdrop to dismiss; respects
// prefers-reduced-motion. Sticky header + scrollable body + optional sticky footer.
export function DetailDrawer({ open, onClose, title, eyebrow, footer, children }: {
  open: boolean;
  onClose: () => void;
  title: string;
  eyebrow?: string;
  footer?: React.ReactNode;
  children: React.ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  return (
    <div className={open ? 'pointer-events-auto' : 'pointer-events-none'} aria-hidden={!open}>
      {/* backdrop */}
      <div
        onClick={onClose}
        className={
          'fixed inset-0 z-40 bg-black/30 transition-opacity duration-[200ms] motion-reduce:transition-none ' +
          (open ? 'opacity-100' : 'opacity-0')
        }
      />
      {/* panel */}
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={
          'fixed inset-y-0 right-0 z-50 flex w-full max-w-[480px] flex-col bg-surface shadow-[var(--mv-shadow-strong)] ' +
          'transition-transform duration-[320ms] ease-[cubic-bezier(0.2,0,0,1)] motion-reduce:transition-none ' +
          (open ? 'translate-x-0' : 'translate-x-full')
        }
      >
        <header className="flex items-start justify-between gap-3 border-b border-border-default px-5 py-4">
          <div className="min-w-0">
            {eyebrow && <div className="text-2xs font-semibold uppercase tracking-wide text-text-subtle">{eyebrow}</div>}
            <h2 className="text-base font-bold leading-snug text-text">{title}</h2>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="grid h-8 w-8 flex-none place-items-center rounded-sm text-text-muted hover:bg-bg-subtle focus-visible:outline-none focus-visible:shadow-[var(--mv-shadow-focus)]"
          >✕</button>
        </header>
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer && <div className="border-t border-border-default px-5 py-3.5">{footer}</div>}
      </aside>
    </div>
  );
}
