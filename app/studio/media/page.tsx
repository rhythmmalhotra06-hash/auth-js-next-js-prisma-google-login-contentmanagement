import { redirect } from 'next/navigation';

// The media hub now lives at /studio itself. Keep this path as a permanent redirect so old
// links, the previous deploy URL, and any bookmarks still land on the consolidated page.
export default function VishenMediaRedirect() {
  redirect('/studio');
}
