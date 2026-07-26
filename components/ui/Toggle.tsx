import { cn } from '@/lib/cn';

// Accessible on/off switch (ARIA switch). Track fills brand when on.
export function Toggle({
  checked,
  onChange,
  label,
  hint,
  className,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: React.ReactNode;
  hint?: string;
  className?: string;
}) {
  return (
    <label className={cn('flex cursor-pointer items-center gap-2.5 text-sm text-text', className)}>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cn(
          'relative h-5 w-9 flex-none rounded-full transition-colors duration-[120ms]',
          'focus-visible:outline-none focus-visible:shadow-[var(--mv-shadow-focus)]',
          checked ? 'bg-brand' : 'bg-border-strong',
        )}
      >
        <span
          className={cn(
            'absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-transform duration-[120ms]',
            checked && 'translate-x-4',
          )}
        />
      </button>
      <span className="select-none">
        {label}
        {hint && <span className="text-text-subtle"> · {hint}</span>}
      </span>
    </label>
  );
}
