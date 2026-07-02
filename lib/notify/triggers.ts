// Notify dispatcher — Airtable-direct (reads the ticket from Airtable by recId) or
// Postgres (reads from PG by uuid), by TICKETS_BACKEND. Both are best-effort. See
// lib/tickets/backend.ts.

import { TICKETS_BACKEND } from '@/lib/tickets/backend';
import * as airtable from './triggers.airtable';
import * as postgres from './triggers.postgres';

const impl = TICKETS_BACKEND === 'postgres' ? postgres : airtable;

export const maybeNotifyAssetReady = impl.maybeNotifyAssetReady;
export const notifyAssignment = impl.notifyAssignment;
