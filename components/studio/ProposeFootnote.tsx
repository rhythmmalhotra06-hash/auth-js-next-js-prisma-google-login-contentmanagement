import { Icon } from '@/components/ui/Icon';

/** Persistent propose-only reassurance — "nothing here changes without you". */
export function ProposeFootnote({ children }: { children?: React.ReactNode }) {
  return (
    <div className="st-footnote">
      <Icon name="lock" size={18} />
      <p>
        {children ?? (
          <>
            <b>Nothing here changes without you.</b> Everything the AI and the team suggest lands as a
            proposal. It only goes live the moment you approve — and downstream production reads only
            what you&apos;ve committed.
          </>
        )}
      </p>
    </div>
  );
}
