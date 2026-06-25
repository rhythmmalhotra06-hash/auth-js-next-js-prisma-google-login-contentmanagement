import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import type { Employee } from '@/app/generated/prisma/client'

/**
 * Resolve the current authenticated session to an Employee row, matched by email.
 *
 * Auth.js owns identity/session (the `users` table); all domain attribution
 * (tickets, approvals, events) hangs off `employees`. This function is the seam
 * where Blinkwork SSO will later plug in: swap the provider in `lib/auth.ts` and
 * this lookup keeps working as long as the verified email matches an employee.
 *
 * Returns null when there's no session or no matching employee (e.g. the person
 * authenticated but hasn't been synced from Airtable yet). Callers MUST handle
 * the null case rather than assuming an employee exists.
 */
export async function getEmployeeForSession(): Promise<Employee | null> {
  const session = await auth()
  const email = session?.user?.email
  if (!email) return null

  return prisma.employee.findUnique({ where: { email } })
}

/** Resolve an Employee directly from an email (for contexts without a live session). */
export async function getEmployeeByEmail(email: string): Promise<Employee | null> {
  return prisma.employee.findUnique({ where: { email } })
}
