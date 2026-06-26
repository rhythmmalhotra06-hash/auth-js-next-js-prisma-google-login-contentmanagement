// Minimal BlinkLife MCP client. BlinkLife exposes no REST surface — only a
// JSON-RPC-over-HTTP MCP endpoint (tools/call). We never touch BlinkLife's code;
// we just call the tools the server already exposes, the same way `claude mcp`
// does. Requests are paced + backed off on 429/5xx, mirroring lib/airtable/client.ts.

import { getToken, mcpUrl } from './identity';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const MIN_INTERVAL_MS = 150; // gentle pacing between calls
const MAX_RETRIES = 5;

let rpcId = 0;

interface JsonRpcResult {
  result?: { content?: { type: string; text?: string }[] };
  error?: { code: number; message: string };
}

/** Parse a fetch body that may be JSON or an SSE (`data: {…}`) frame. */
async function parseBody(res: Response): Promise<JsonRpcResult> {
  const text = await res.text();
  const trimmed = text.trimStart();
  if (trimmed.startsWith('{')) return JSON.parse(trimmed) as JsonRpcResult;
  // SSE: take the last `data:` line's payload.
  const dataLine = text
    .split('\n')
    .reverse()
    .find((l) => l.startsWith('data:'));
  if (!dataLine) throw new Error(`BlinkLife: unparseable response: ${text.slice(0, 200)}`);
  return JSON.parse(dataLine.slice(5).trim()) as JsonRpcResult;
}

/**
 * Call one BlinkLife MCP tool and return its decoded payload. Tool results come
 * back as a JSON string inside result.content[0].text — we parse and return that
 * object (or `null` for tools that return an empty result). Throws on RPC errors
 * and on HTTP failures after retries.
 */
export async function callTool<T = unknown>(
  name: string,
  args: Record<string, unknown> = {},
  opts: { token?: string } = {},
): Promise<T> {
  const token = opts.token ?? getToken();
  const body = JSON.stringify({
    jsonrpc: '2.0',
    id: ++rpcId,
    method: 'tools/call',
    params: { name, arguments: args },
  });

  let retries = 0;
  for (;;) {
    const res = await fetch(mcpUrl(), {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        Accept: 'application/json, text/event-stream',
      },
      body,
    });

    if (res.status === 429 || res.status >= 500) {
      if (++retries > MAX_RETRIES) throw new Error(`BlinkLife ${name}: ${res.status} after ${MAX_RETRIES} retries`);
      await sleep(Math.min(1000 * 2 ** retries, 10000)); // exponential backoff
      continue;
    }
    if (!res.ok) throw new Error(`BlinkLife ${name}: ${res.status} ${await res.text()}`);

    const json = await parseBody(res);
    await sleep(MIN_INTERVAL_MS);
    if (json.error) throw new Error(`BlinkLife ${name}: ${json.error.message}`);

    const textPart = json.result?.content?.find((c) => c.type === 'text')?.text;
    if (textPart == null) return null as T;
    try {
      return JSON.parse(textPart) as T;
    } catch {
      return textPart as unknown as T; // some tools return plain text
    }
  }
}
