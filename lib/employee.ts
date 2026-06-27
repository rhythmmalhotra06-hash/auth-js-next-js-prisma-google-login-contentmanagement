import { auth } from '@/lib/auth'
import { findEmployeeByEmail, type EmployeeRecord } from '@/lib/repositories/employee.repository'

/**
 * Resolve the current authenticated session to an Airtable Employees record,
 * matched by email. Identity/session is JWT (Google); domain attribution lives in
 * the Airtable Employees table. Returns null when there's no session or no matching
 * employee — callers MUST handle null.
 *
 * The returned object exposes both `id` and `airtableId` (both the Airtable recId)
 * so existing callers reading either keep working.
 */
export async function getEmployeeForSession(): Promise<EmployeeRecord | null> {
  const session = await auth()
  const email = session?.user?.email
  if (!email) return null
  return findEmployeeByEmail(email)
}

/** Resolve an Employee directly from an email (for contexts without a live session). */
export async function getEmployeeByEmail(email: string): Promise<EmployeeRecord | null> {
  return findEmployeeByEmail(email)
}
