import { redirect } from 'next/navigation';

// Content Engine retired — clipping now lives under the Vishen Media Inbox (/media).
export default async function StrategyDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await params;
  redirect('/media');
}
