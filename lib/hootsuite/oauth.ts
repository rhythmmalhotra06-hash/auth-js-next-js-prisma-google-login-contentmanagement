// Hootsuite OAuth — the app's own credential, so the performance pull can run on a cron
// instead of only inside a session someone starts.
//
// Probed 2026-08-20 at https://platform.hootsuite.com/.well-known/oauth-authorization-server:
//   authorization_endpoint /oauth2/auth · token_endpoint /oauth2/token
//   registration_endpoint  /oauth2/register   (open dynamic client registration)
//   scopes  offline + analytics:read · PKCE S256 · grant types authorization_code, refresh_token
//
// Dynamic registration is what makes this cheap: nobody has to hand-register an OAuth app
// in a Hootsuite console, and the redirect URI is whatever this deployment's URL is. The
// `offline` scope is the whole reason a cron is possible at all.
//
// Everything here is server-only. Tokens are sealed at rest (lib/crypto/secret-box.ts).

import { createHash, randomBytes } from 'node:crypto';
import { prisma } from '@/lib/prisma';
import { seal, open } from '@/lib/crypto/secret-box';

export const PROVIDER = 'hootsuite';
export const PERCH_URL = 'https://mcp.hootsuite.com/perch';
const AUTH_SERVER = 'https://platform.hootsuite.com';
const SCOPES = 'offline analytics:read';
/** Refresh this far ahead of expiry so a long pull can't die mid-run. */
const REFRESH_SKEW_MS = 5 * 60 * 1000;

export interface ConnectionStatus {
  connected: boolean;
  scope: string | null;
  expiresAt: string | null;
  connectedBy: string | null;
  connectedAt: string | null;
  lastError: string | null;
  /** True when a stored token exists but can no longer be decrypted (AUTH_SECRET rotated). */
  unreadable: boolean;
}

/**
 * This deployment's public base URL, used to build the redirect URI. Must match between
 * the authorize request and the token exchange or the provider rejects the code.
 */
function baseUrl(): string {
  const raw = process.env.NEXT_PUBLIC_URL || process.env.AUTH_URL;
  if (!raw) throw new Error('NEXT_PUBLIC_URL (or AUTH_URL) must be set to build the OAuth redirect URI.');
  return raw.replace(/\/+$/, '');
}

export function redirectUri(): string {
  return `${baseUrl()}/api/hootsuite/callback`;
}

/**
 * Register this deployment as an OAuth client, once, and remember the credentials.
 * Re-registers if we have no client id yet (e.g. first connect, or after a disconnect).
 */
async function ensureClient(): Promise<{ clientId: string; clientSecret: string | null }> {
  const row = await prisma.externalCredential.findUnique({ where: { provider: PROVIDER } });
  if (row?.clientId) {
    return {
      clientId: row.clientId,
      clientSecret: row.clientSecretEnc ? open(row.clientSecretEnc) : null,
    };
  }

  const res = await fetch(`${AUTH_SERVER}/oauth2/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_name: 'Mindvalley Content Portal',
      redirect_uris: [redirectUri()],
      grant_types: ['authorization_code', 'refresh_token'],
      response_types: ['code'],
      token_endpoint_auth_method: 'client_secret_post',
      scope: SCOPES,
    }),
  });
  const body = await res.text();
  if (!res.ok) throw new Error(`Dynamic client registration failed (HTTP ${res.status}): ${body.slice(0, 300)}`);

  const reg = JSON.parse(body) as { client_id?: string; client_secret?: string };
  if (!reg.client_id) throw new Error('Registration succeeded but returned no client_id.');

  await prisma.externalCredential.upsert({
    where: { provider: PROVIDER },
    create: {
      provider: PROVIDER,
      clientId: reg.client_id,
      clientSecretEnc: reg.client_secret ? seal(reg.client_secret) : null,
    },
    update: {
      clientId: reg.client_id,
      clientSecretEnc: reg.client_secret ? seal(reg.client_secret) : null,
    },
  });
  return { clientId: reg.client_id, clientSecret: reg.client_secret ?? null };
}

/**
 * Build the URL to send the admin to. Returns the PKCE verifier + state for the caller to
 * stash in a short-lived cookie — deliberately NOT in the database, so a stale in-flight
 * attempt can never be replayed against a later one.
 */
export async function startAuthorization(): Promise<{ url: string; verifier: string; state: string }> {
  const { clientId } = await ensureClient();
  const verifier = randomBytes(32).toString('base64url');
  const challenge = createHash('sha256').update(verifier).digest('base64url');
  const state = randomBytes(16).toString('base64url');

  const u = new URL(`${AUTH_SERVER}/oauth2/auth`);
  u.searchParams.set('response_type', 'code');
  u.searchParams.set('client_id', clientId);
  u.searchParams.set('redirect_uri', redirectUri());
  u.searchParams.set('scope', SCOPES);
  u.searchParams.set('state', state);
  u.searchParams.set('code_challenge', challenge);
  u.searchParams.set('code_challenge_method', 'S256');
  // RFC 8707 — MCP requires binding the token to the protected resource it's for.
  u.searchParams.set('resource', PERCH_URL);
  return { url: u.toString(), verifier, state };
}

async function postToken(params: Record<string, string>): Promise<{ access_token: string; refresh_token?: string; expires_in?: number; scope?: string }> {
  const { clientId, clientSecret } = await ensureClient();
  const form = new URLSearchParams({ ...params, client_id: clientId });
  if (clientSecret) form.set('client_secret', clientSecret);

  const res = await fetch(`${AUTH_SERVER}/oauth2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: form.toString(),
  });
  const body = await res.text();
  if (!res.ok) throw new Error(`Token endpoint returned HTTP ${res.status}: ${body.slice(0, 300)}`);
  const json = JSON.parse(body) as { access_token?: string; refresh_token?: string; expires_in?: number; scope?: string };
  if (!json.access_token) throw new Error('Token response contained no access_token.');
  return json as { access_token: string; refresh_token?: string; expires_in?: number; scope?: string };
}

/** Finish the dance: swap the code for tokens and store them sealed. */
export async function completeAuthorization(code: string, verifier: string, who: string | null): Promise<void> {
  const tok = await postToken({
    grant_type: 'authorization_code',
    code,
    redirect_uri: redirectUri(),
    code_verifier: verifier,
  });

  if (!tok.refresh_token) {
    // Without this there is no cron — only a token that dies in an hour. Fail loudly now
    // rather than silently reverting to manual pulls a week later.
    throw new Error('Hootsuite returned no refresh token, so scheduled pulls are impossible. Check that the `offline` scope was granted.');
  }

  await prisma.externalCredential.update({
    where: { provider: PROVIDER },
    data: {
      accessTokenEnc: seal(tok.access_token),
      refreshTokenEnc: seal(tok.refresh_token),
      expiresAt: tok.expires_in ? new Date(Date.now() + tok.expires_in * 1000) : null,
      scope: tok.scope ?? SCOPES,
      lastError: null,
      connectedBy: who,
      connectedAt: new Date(),
    },
  });
}

/**
 * A usable access token, refreshing when it's close to expiry. Throws with an
 * admin-readable message when the integration needs reconnecting — callers surface that
 * rather than retrying, since no amount of retrying fixes a revoked grant.
 */
export async function getAccessToken(): Promise<string> {
  const row = await prisma.externalCredential.findUnique({ where: { provider: PROVIDER } });
  if (!row?.refreshTokenEnc) throw new Error('Hootsuite is not connected. An admin needs to connect it at /admin/hootsuite.');

  const fresh = row.accessTokenEnc && row.expiresAt && row.expiresAt.getTime() - Date.now() > REFRESH_SKEW_MS;
  if (fresh) {
    try {
      return open(row.accessTokenEnc!);
    } catch {
      // Sealed with a different AUTH_SECRET — fall through and try the refresh token,
      // which will fail the same way and produce the reconnect message.
    }
  }

  let refresh: string;
  try {
    refresh = open(row.refreshTokenEnc);
  } catch {
    throw new Error('Stored Hootsuite credentials can no longer be decrypted (AUTH_SECRET changed). Reconnect at /admin/hootsuite.');
  }

  try {
    const tok = await postToken({ grant_type: 'refresh_token', refresh_token: refresh });
    await prisma.externalCredential.update({
      where: { provider: PROVIDER },
      data: {
        accessTokenEnc: seal(tok.access_token),
        // Rotating providers hand back a new refresh token; keep the old one if not.
        refreshTokenEnc: tok.refresh_token ? seal(tok.refresh_token) : row.refreshTokenEnc,
        expiresAt: tok.expires_in ? new Date(Date.now() + tok.expires_in * 1000) : null,
        lastError: null,
      },
    });
    return tok.access_token;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await prisma.externalCredential.update({ where: { provider: PROVIDER }, data: { lastError: message } });
    throw new Error(`Hootsuite token refresh failed — reconnect may be needed. ${message}`);
  }
}

export async function getStatus(): Promise<ConnectionStatus> {
  const row = await prisma.externalCredential.findUnique({ where: { provider: PROVIDER } });
  if (!row?.refreshTokenEnc) {
    return { connected: false, scope: null, expiresAt: null, connectedBy: null, connectedAt: null, lastError: row?.lastError ?? null, unreadable: false };
  }
  let unreadable = false;
  try {
    open(row.refreshTokenEnc);
  } catch {
    unreadable = true;
  }
  return {
    connected: !unreadable,
    scope: row.scope,
    expiresAt: row.expiresAt?.toISOString() ?? null,
    connectedBy: row.connectedBy,
    connectedAt: row.connectedAt?.toISOString() ?? null,
    lastError: row.lastError,
    unreadable,
  };
}

/** Forget the tokens (keeps nothing usable). The registered client is dropped too so a
 *  reconnect re-registers cleanly against whatever the current deployment URL is. */
export async function disconnect(): Promise<void> {
  await prisma.externalCredential.deleteMany({ where: { provider: PROVIDER } });
}
