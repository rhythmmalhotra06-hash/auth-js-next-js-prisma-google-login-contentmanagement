// Minimal MCP client over streamable HTTP — enough to initialize a session, list tools,
// and call one. Server-side only.
//
// Hand-rolled rather than pulling in @modelcontextprotocol/sdk, for the same reason this
// repo hand-rolls its Airtable and Slack clients: the surface we need is three JSON-RPC
// methods, and the SDK brings a transport/auth stack we'd be fighting (we hold our own
// OAuth token from lib/hootsuite/oauth.ts and just need it on the wire).
//
// Two protocol details that bite if missed:
//  1. `Accept` MUST list both application/json and text/event-stream. A compliant server
//     may answer either, and some answer SSE even for a plain request/response.
//  2. The server may hand back an `Mcp-Session-Id` on initialize; every later request in
//     that session has to echo it, or the server treats the call as sessionless and errors.

export interface McpTool {
  name: string;
  description?: string;
  inputSchema?: unknown;
}

export type McpResult<T> = { ok: true; data: T } | { ok: false; error: { message: string; status?: number } };

const PROTOCOL_VERSION = '2025-06-18';
const CLIENT_INFO = { name: 'mindvalley-content-portal', version: '1.0.0' };

interface RpcEnvelope {
  jsonrpc: '2.0';
  id?: number;
  result?: unknown;
  error?: { code: number; message: string };
}

/**
 * Pull the JSON-RPC envelope out of a response body that may be either plain JSON or an
 * SSE stream of `data:` lines. For SSE we take the LAST data frame carrying a `result` or
 * `error` — servers may emit progress notifications ahead of the real answer.
 */
function parseBody(contentType: string, raw: string): RpcEnvelope | null {
  if (contentType.includes('text/event-stream')) {
    let last: RpcEnvelope | null = null;
    for (const line of raw.split('\n')) {
      const t = line.trim();
      if (!t.startsWith('data:')) continue;
      try {
        const env = JSON.parse(t.slice(5).trim()) as RpcEnvelope;
        if ('result' in env || 'error' in env) last = env;
      } catch {
        // A partial or non-JSON frame is not fatal — keep scanning for a complete one.
      }
    }
    return last;
  }
  try {
    return JSON.parse(raw) as RpcEnvelope;
  } catch {
    return null;
  }
}

export class McpSession {
  private sessionId: string | null = null;
  private nextId = 1;

  constructor(
    private readonly url: string,
    private readonly accessToken: string,
  ) {}

  private async rpc(method: string, params?: unknown, notify = false): Promise<McpResult<unknown>> {
    const body: Record<string, unknown> = { jsonrpc: '2.0', method };
    if (params !== undefined) body.params = params;
    if (!notify) body.id = this.nextId++;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json, text/event-stream',
      Authorization: `Bearer ${this.accessToken}`,
      'MCP-Protocol-Version': PROTOCOL_VERSION,
    };
    if (this.sessionId) headers['Mcp-Session-Id'] = this.sessionId;

    let res: Response;
    try {
      res = await fetch(this.url, { method: 'POST', headers, body: JSON.stringify(body) });
    } catch (err) {
      return { ok: false, error: { message: `Could not reach ${this.url}: ${err instanceof Error ? err.message : String(err)}` } };
    }

    const sid = res.headers.get('mcp-session-id');
    if (sid) this.sessionId = sid;

    if (notify) return { ok: true, data: null }; // notifications get no reply body

    const raw = await res.text();
    if (!res.ok) {
      // 401 here means the token is bad/expired or the account lacks the product; the
      // caller turns that into a "reconnect Hootsuite" prompt rather than a retry loop.
      const detail = raw.slice(0, 300) || res.statusText;
      return { ok: false, error: { message: `${method} failed (HTTP ${res.status}): ${detail}`, status: res.status } };
    }

    const env = parseBody(res.headers.get('content-type') ?? '', raw);
    if (!env) return { ok: false, error: { message: `${method}: could not parse response body` } };
    if (env.error) return { ok: false, error: { message: `${method}: ${env.error.message}` } };
    return { ok: true, data: env.result };
  }

  /** Handshake. Must succeed before tools/list or tools/call. */
  async initialize(): Promise<McpResult<unknown>> {
    const res = await this.rpc('initialize', {
      protocolVersion: PROTOCOL_VERSION,
      capabilities: {},
      clientInfo: CLIENT_INFO,
    });
    if (!res.ok) return res;
    // Spec requires this notification; skipping it leaves some servers refusing tool calls.
    await this.rpc('notifications/initialized', undefined, true);
    return res;
  }

  async listTools(): Promise<McpResult<McpTool[]>> {
    const res = await this.rpc('tools/list');
    if (!res.ok) return { ok: false, error: res.error };
    const tools = (res.data as { tools?: McpTool[] } | null)?.tools;
    return { ok: true, data: Array.isArray(tools) ? tools : [] };
  }

  /**
   * Call a tool. Returns the raw `content` blocks plus, when the tool emits JSON as text,
   * the parsed value — Perch's analytics tools are expected to return a JSON payload in a
   * text block rather than a typed structure.
   */
  async callTool(name: string, args: Record<string, unknown>): Promise<McpResult<{ raw: unknown; text: string; json: unknown }>> {
    const res = await this.rpc('tools/call', { name, arguments: args });
    if (!res.ok) return { ok: false, error: res.error };
    const result = res.data as { content?: Array<{ type: string; text?: string }>; isError?: boolean } | null;
    const text = (result?.content ?? [])
      .filter((c) => c.type === 'text' && typeof c.text === 'string')
      .map((c) => c.text as string)
      .join('\n');
    if (result?.isError) return { ok: false, error: { message: `${name} returned an error: ${text.slice(0, 300)}` } };
    let json: unknown = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = null; // plain prose, not JSON — the caller decides what to do with `text`
    }
    return { ok: true, data: { raw: res.data, text, json } };
  }
}

/** Open an initialized session, or fail with a message worth showing an admin. */
export async function connect(url: string, accessToken: string): Promise<McpResult<McpSession>> {
  const s = new McpSession(url, accessToken);
  const init = await s.initialize();
  if (!init.ok) return { ok: false, error: init.error };
  return { ok: true, data: s };
}
