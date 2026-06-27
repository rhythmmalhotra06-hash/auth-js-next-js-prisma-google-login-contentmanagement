import NextAuth from 'next-auth'
import authConfig from '@/lib/auth.config'

// Middleware runs in the edge runtime — use the adapter-less config so no
// Node-only Prisma code is bundled here. (Importing lib/auth.ts here is what
// crashed every request with `Cannot redefine property: __import_unsupported`.)
export const { auth: middleware } = NextAuth(authConfig)

// Skip static assets, API routes (the sync route guards itself), and the public
// access-denied page (must be reachable without a session).
export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|access-denied).*)'],
}
