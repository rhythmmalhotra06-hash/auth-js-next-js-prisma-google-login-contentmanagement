import { PrismaClient } from '@/app/generated/prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient }

function create(): PrismaClient {
  // Pool settings matter here because the app is I/O-bound and Cloud Run instances are small:
  //  • `idleTimeoutMillis` — pg's default is 10s, which on a lightly-used internal tool meant
  //    nearly every request re-opened a TCP+TLS connection to Cloud SQL. A minute keeps the pool
  //    warm across the gaps between clicks in a meeting.
  //  • `max` — one instance, one vCPU; ten connections is plenty and stays well under the
  //    shared Cloud SQL instance's ceiling if several containers are up.
  const adapter = new PrismaPg({
    connectionString: process.env.DATABASE_URL,
    max: 10,
    idleTimeoutMillis: 60_000,
    connectionTimeoutMillis: 10_000,
  })
  return new PrismaClient({ adapter })
}

// One client per process. The adapter is built INSIDE the guard: constructing it at module top
// level (as before) opened a fresh pool on every dev/HMR module evaluation and leaked the old one.
export const prisma = globalForPrisma.prisma ?? create()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
