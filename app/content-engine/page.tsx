import { redirect } from 'next/navigation';

// Content Engine retired — the Vishen Media Inbox (/media) is the live clipping surface.
export default function ContentEnginePage() {
  redirect('/media');
}
