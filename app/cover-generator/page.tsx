import { AppShell } from '@/components/ui/AppShell';
import { CoverGenerator } from './CoverGenerator';

export const dynamic = 'force-dynamic';

// Prefill support (used by the "Make cover" entry point from an approved clip in
// Phase 2). Plain query params keep the entry point a simple <Link>.
export default async function CoverGeneratorPage({
  searchParams,
}: {
  searchParams: Promise<{ hook?: string; keyword?: string; author?: string; clip?: string }>;
}) {
  const sp = await searchParams;
  return (
    <AppShell
      title="Cover Generator"
      subtitle="Upload a 9×16 portrait, write the hook, and export a finished cover at 1080×1920."
    >
      <CoverGenerator
        initialHook={sp.hook}
        initialKeyword={sp.keyword}
        initialName={sp.author}
        clipId={sp.clip}
      />
    </AppShell>
  );
}
