import NextAuth from 'next-auth'
import authConfig from '@/lib/auth.config'

// Airtable-direct: NO database adapter. Sessions are JWT (stateless) — there is no
// Postgres users/accounts/sessions table anymore. Identity comes from Google;
// domain attribution is resolved from the Airtable Employees table by email at use
// time (see lib/employee.ts). This also ends the prior `Invalid Compact JWE` errors
// that came from the adapter/strategy mismatch.
export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  session: { strategy: 'jwt' },
})
