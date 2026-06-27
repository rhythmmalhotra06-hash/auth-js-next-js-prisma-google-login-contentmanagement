'use server';

import { signOut } from '@/lib/auth';

/** Sign out and return to the login page. Used by the sidebar Sign out button. */
export async function signOutAction() {
  await signOut({ redirectTo: '/' });
}
