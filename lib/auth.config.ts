import type { NextAuthConfig } from 'next-auth'
import GitHub from 'next-auth/providers/github'

// Edge-safe Auth.js config: providers only, NO database adapter. The Prisma
// adapter pulls in `pg` (Node-only) which crashes the edge middleware bundle
// (`Cannot redefine property: __import_unsupported`). The full config in
// lib/auth.ts spreads this and adds the adapter for Node route handlers.
export default {
  providers: [GitHub],
} satisfies NextAuthConfig
