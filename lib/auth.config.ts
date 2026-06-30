import type { NextAuthConfig } from 'next-auth'
import Google from 'next-auth/providers/google'
import Credentials from 'next-auth/providers/credentials'

// Edge-safe Auth.js config: providers only, NO database adapter (the Prisma
// adapter pulls in Node-only `pg`, which crashes the edge middleware). The full
// config in lib/auth.ts spreads this and adds the adapter for Node route handlers.
//
// trustHost is required because we run on non-Vercel hosts (local :3000 and
// Cloud Run) — without it Auth.js throws UntrustedHost on every session call.

// Allowed Google Workspace domain(s). Sign-in is open to any @mindvalley.com
// account; role-based access is enforced in-app (roles on the Employees table).
const ALLOWED_DOMAINS = ['mindvalley.com']

// DEV-ONLY login bypass. Double-gated: never active unless running outside
// production AND ENABLE_DEV_LOGIN=true (set only in local .env). Lets you sign in
// as any @mindvalley.com email with a chosen role to preview each role's view
// locally without Google OAuth. Completely inert in production.
const DEV_LOGIN = process.env.NODE_ENV !== 'production' && process.env.ENABLE_DEV_LOGIN === 'true'

const providers: NextAuthConfig['providers'] = [
  Google({
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  }),
]

if (DEV_LOGIN) {
  providers.push(
    Credentials({
      id: 'dev',
      name: 'Dev login (local only)',
      credentials: {
        email: { label: 'Email', type: 'text', placeholder: 'you@mindvalley.com' },
        roles: { label: 'Roles (comma-separated; blank = Stakeholder)', type: 'text', placeholder: 'Editor' },
        division: { label: 'Division (e.g. Marketing — for the Social surface)', type: 'text', placeholder: 'Marketing' },
      },
      authorize(creds) {
        const email = String(creds?.email ?? '').toLowerCase().trim()
        if (!email.endsWith('@mindvalley.com')) return null
        const roles = String(creds?.roles ?? '').trim()
        const division = String(creds?.division ?? '').trim()
        return { id: email, email, name: email.split('@')[0], devRoles: roles, devDivision: division }
      },
    }),
  )
}

export default {
  trustHost: true,
  pages: { signIn: '/', error: '/access-denied' },
  providers,
  callbacks: {
    // Middleware gate: every matched route requires a session. Anonymous users are
    // redirected to the sign-in page ('/'). Without this, the bare auth middleware
    // only attaches req.auth and never blocks — anyone could open protected pages.
    authorized({ request, auth }) {
      const { pathname } = request.nextUrl
      if (pathname === '/' || pathname === '/access-denied') return true // public
      return !!auth
    },
    // Gate sign-in at the SSO step: only company-domain Google accounts get a
    // session. Edge-safe — a pure string check, no imports. Returning false sends
    // the user to the access-denied page.
    signIn({ profile, user }) {
      const email = (profile?.email ?? user?.email ?? '').toLowerCase()
      const domain = email.split('@')[1] ?? ''
      return ALLOWED_DOMAINS.includes(domain)
    },
    // Dev-login only: carry the chosen roles through the JWT → session so the
    // in-app gating can preview that role. No-op in production (devRoles never set).
    jwt({ token, user }) {
      if (DEV_LOGIN && user && 'devRoles' in user) {
        ;(token as unknown as Record<string, unknown>).devRoles = (user as { devRoles?: string }).devRoles ?? ''
        ;(token as unknown as Record<string, unknown>).devDivision = (user as { devDivision?: string }).devDivision ?? ''
      }
      return token
    },
    session({ session, token }) {
      const t = token as unknown as Record<string, unknown>
      if (DEV_LOGIN && 'devRoles' in t) {
        ;(session as unknown as Record<string, unknown>).devRoles = t.devRoles
        ;(session as unknown as Record<string, unknown>).devDivision = t.devDivision
      }
      return session
    },
  },
} satisfies NextAuthConfig
