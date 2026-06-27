import { redirect } from 'next/navigation';

// Content Engine retired — submit media via the Vishen Media Inbox (/media/new).
export default function NewStrategyPage() {
  redirect('/media/new');
}
