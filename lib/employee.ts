import { cache } from 'react'
import { getSession } from '@/lib/auth'
import { findEmployeeByEmail, type EmployeeRecord } from '@/lib/repositories/employee.repository'

/**
 * Resolve the current authenticated session to an Airtable Employees record,
 * matched by email. Identity/session is JWT (Google); domain attribution lives in
 * the Airtable Employees table. Returns null when there's no session or no matching
 * employee — callers MUST handle null.
 *
 * The returned object exposes both `id` and `airtableId` (both the Airtable recId)
 * so existing callers reading either keep working.
 *
 * Memoised per request with `React.cache`: the guard, `getAdminAccess` and `AppShell` all ask,
 * and the answer cannot change mid-render.
 */
export const getEmployeeForSession = cache(async (): Promise<EmployeeRecord | null> => {
  const session = await getSession()
  const email = session?.user?.email
  if (!email) return null
  return findEmployeeByEmail(email)
})

/** Resolve an Employee directly from an email (for contexts without a live session). */
export async function getEmployeeByEmail(email: string): Promise<EmployeeRecord | null> {
  return findEmployeeByEmail(email)
}
