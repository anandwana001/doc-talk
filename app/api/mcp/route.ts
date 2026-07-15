/**
 * MCP server for DocTalk — streamable HTTP transport.
 *
 * Agora ConvoAI calls this endpoint via the MCP protocol so the agent can
 * retrieve relevant documentation chunks on demand, per turn.
 *
 * Protocol: JSON-RPC 2.0 over HTTP POST (MCP streamable_http transport).
 * Tool exposed: search_docs(query) → top matching chunks from MiniSearch index.
 *
 * Token budget per turn with MCP:
 *   System prompt (instructions only):  ~500 tokens
 *   search_docs result (6 chunks):      ~2 000 tokens
 *   Conversation history (20 turns):    ~8 000 tokens
 *   Total:                              ~10 500 tokens  (was ~30 000+)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getContextForQuery } from '@/lib/docs-loader';

const SERVER_INFO = { name: 'doctalk-mcp', version: '1.0.0' };
const PROTOCOL_VERSION = '2024-11-05';

type JsonRpcRequest = {
  jsonrpc: '2.0';
  id?: string | number | null;
  method: string;
  params?: unknown;
};

type JsonRpcResponse = {
  jsonrpc: '2.0';
  id: string | number | null;
  result?: unknown;
  error?: { code: number; message: string };
};

function ok(id: string | number | null, result: unknown): JsonRpcResponse {
  return { jsonrpc: '2.0', id, result };
}

function err(id: string | number | null, code: number, message: string): JsonRpcResponse {
  return { jsonrpc: '2.0', id, error: { code, message } };
}

const TOOLS = [
  {
    name: 'search_docs',
    description:
      'Search the product documentation for information relevant to the user\'s question. ' +
      'Call this before answering any question about product features, APIs, or usage. ' +
      'Returns the most relevant documentation chunks (up to ~2 000 tokens).',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'The user\'s question or topic to search for in the documentation.',
        },
      },
      required: ['query'],
    },
  },
];

async function handleRequest(req: JsonRpcRequest): Promise<JsonRpcResponse | null> {
  const id = req.id ?? null;

  switch (req.method) {
    case 'initialize':
      return ok(id, {
        protocolVersion: PROTOCOL_VERSION,
        capabilities: { tools: {} },
        serverInfo: SERVER_INFO,
      });

    case 'tools/list':
      return ok(id, { tools: TOOLS });

    case 'tools/call': {
      const params = req.params as { name?: string; arguments?: Record<string, unknown> };
      if (params?.name !== 'search_docs') {
        return err(id, -32602, `Unknown tool: ${params?.name}`);
      }
      const query = params?.arguments?.query;
      if (typeof query !== 'string' || !query.trim()) {
        return err(id, -32602, 'search_docs requires a non-empty "query" string argument.');
      }
      try {
        const context = await getContextForQuery(query);
        return ok(id, {
          content: [
            {
              type: 'text',
              text: context || 'No relevant documentation found for that query.',
            },
          ],
        });
      } catch (e) {
        console.error('[DocTalk] MCP search_docs error:', e);
        return err(id, -32603, 'Internal error while searching documentation.');
      }
    }

    // Notifications have no id — acknowledge but don't respond.
    case 'notifications/initialized':
    case 'notifications/cancelled':
      return null;

    default:
      return err(id, -32601, `Method not found: ${req.method}`);
  }
}

function isAuthorized(request: NextRequest): boolean {
  const secret = process.env.MCP_SECRET;
  if (!secret) return true; // not configured — open (dev mode)
  return request.nextUrl.searchParams.get('key') === secret;
}

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json(
      err(null, -32600, 'Unauthorized.'),
      { status: 401 },
    );
  }

  let body: JsonRpcRequest | JsonRpcRequest[];
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      err(null, -32700, 'Parse error: invalid JSON.'),
      { status: 400 },
    );
  }

  // Batch request
  if (Array.isArray(body)) {
    const results = await Promise.all(body.map(handleRequest));
    const responses = results.filter(Boolean);
    if (responses.length === 0) return new NextResponse(null, { status: 202 });
    return NextResponse.json(responses);
  }

  // Single request
  const response = await handleRequest(body);
  if (response === null) return new NextResponse(null, { status: 202 });
  return NextResponse.json(response);
}

// Agora may probe with GET to check the endpoint is alive.
export async function GET() {
  return NextResponse.json({ name: SERVER_INFO.name, version: SERVER_INFO.version });
}
