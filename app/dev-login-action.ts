'use server';

import { signIn } from '@/lib/auth';

const DEV_LOGIN = process.env.NODE_ENV !== 'production' && process.env.ENABLE_DEV_LOGIN === 'true';

/** DEV-ONLY: sign in via the credentials provider with a chosen role. No-op in prod. */
export async function devLogin(formData: FormData) {
  if (!DEV_LOGIN) return;
  const email = String(formData.get('email') ?? '').trim();
  const roles = String(formData.get('roles') ?? '').trim();
  await signIn('dev', { email, roles, redirectTo: '/' });
}
