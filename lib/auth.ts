import NextAuth from 'next-auth'
import { PrismaAdapter } from '@auth/prisma-adapter'
import { prisma } from '@/lib/prisma'
import authConfig from '@/lib/auth.config'

// Full config (Node runtime): edge-safe providers + the Prisma adapter.
// Used by route handlers and server components — never imported by middleware.
export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  ...authConfig,
})
