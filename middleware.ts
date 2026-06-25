import NextAuth from 'next-auth'
import authConfig from '@/lib/auth.config'

// Middleware runs in the edge runtime — use the adapter-less config so no
// Node-only Prisma code is bundled here. (Importing lib/auth.ts here is what
// crashed every request with `Cannot redefine property: __import_unsupported`.)
export const { auth: middleware } = NextAuth(authConfig)

// Skip static assets and API routes (the sync route guards itself).
export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
}
