import { redirect } from 'next/navigation';
import { auth, signIn } from '@/lib/auth';
import { getAdminAccess } from '@/lib/admin/access';
import { homeRouteForRoles } from '@/lib/roles';
import { DevLogin } from '@/components/auth/DevLogin';

const DEV_LOGIN = process.env.NODE_ENV !== 'production' && process.env.ENABLE_DEV_LOGIN === 'true';

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.71-1.57 2.68-3.89 2.68-6.62z" />
      <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18z" />
      <path fill="#FBBC05" d="M3.97 10.72a5.4 5.4 0 0 1 0-3.44V4.95H.96a9 9 0 0 0 0 8.1l3.01-2.33z" />
      <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58z" />
    </svg>
  );
}

export default async function Home() {
  const session = await auth();
  if (session) {
    const { isAdmin, roles } = await getAdminAccess();
    redirect(isAdmin ? '/studio' : homeRouteForRoles(roles));
  }

  return (
    <div id="cover">
      <div className="dotgrid" />
      <div className="cover-top">
        <div className="brand-mark">M</div>
        <div className="brand-txt"><b>Content Studio</b><span>Mindvalley</span></div>
      </div>
      <div className="cover-body">
        <div className="cover-eyebrow cv cv1">Mindvalley Content Studio</div>
        <h1 className="cover-h1 cv cv2">Everything the team makes, <span className="em">end&nbsp;to&nbsp;end</span>.</h1>
        <p className="cover-sub cv cv3">One home for creative production — from request to performance. Sign in with your Mindvalley account to continue.</p>
        <div className="cover-cta cv cv4">
          <form action={async () => { 'use server'; await signIn('google', { redirectTo: '/' }); }}>
            <button type="submit" className="btn primary" style={{ padding: '13px 22px', fontSize: 14.5 }}>
              <GoogleIcon /> Continue with Google
            </button>
          </form>
          <span className="muted" style={{ fontSize: 12.5, alignSelf: 'center' }}>Team-only · @mindvalley.com</span>
        </div>
        {DEV_LOGIN && (
          <div className="cv cv5" style={{ marginTop: 22, maxWidth: 460 }}>
            <DevLogin />
          </div>
        )}
      </div>
    </div>
  );
}
