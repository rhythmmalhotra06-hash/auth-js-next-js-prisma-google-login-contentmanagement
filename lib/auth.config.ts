import type { NextAuthConfig } from 'next-auth'
import Google from 'next-auth/providers/google'

// Edge-safe Auth.js config: providers only, NO database adapter (the Prisma
// adapter pulls in Node-only `pg`, which crashes the edge middleware). The full
// config in lib/auth.ts spreads this and adds the adapter for Node route handlers.
//
// trustHost is required because we run on non-Vercel hosts (local :3100 and
// Cloud Run) — without it Auth.js throws UntrustedHost on every session call.
// Credentials are passed explicitly to reuse the existing GOOGLE_CLIENT_* env
// names (Auth.js would otherwise look for AUTH_GOOGLE_ID/SECRET).
export default {
  trustHost: true,
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    }),
  ],
} satisfies NextAuthConfig
