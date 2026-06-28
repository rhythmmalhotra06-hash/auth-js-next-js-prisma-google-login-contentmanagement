// Server section that loads the "Approved by Vishen — ready to convert" data and
// renders the client panel. Pulled out of the manager/editor pages so it can sit
// behind its own <Suspense> and stream independently — its reference load (6
// Airtable reads via getIntakeReferenceData) never blocks the main queue table.

import { listClipsByStatus, listMediaSources } from '@/lib/media/repository';
import { getIntakeReferenceData } from '@/lib/intake/data';
import { ApprovedClipsPanel } from './ApprovedClipsPanel';

export async function ApprovedClipsSection() {
  const [approvedRes, sourcesRes, reference] = await Promise.all([
    listClipsByStatus('Approved'),
    listMediaSources(100),
    getIntakeReferenceData(),
  ]);
  const approved = approvedRes.ok ? approvedRes.data : [];
  const sources = sourcesRes.ok ? sourcesRes.data : [];
  const sourceNames: Record<string, string> = Object.fromEntries(
    sources.map((s) => [s.id, s.title || s.sourceUrl || 'Untitled source']),
  );
  const sourceUrls: Record<string, string> = Object.fromEntries(
    sources.filter((s) => s.sourceUrl).map((s) => [s.id, s.sourceUrl as string]),
  );
  return <ApprovedClipsPanel approved={approved} sourceNames={sourceNames} sourceUrls={sourceUrls} reference={reference} />;
}
