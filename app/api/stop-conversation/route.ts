import { NextRequest, NextResponse } from 'next/server';
import { AgoraClient, Area } from 'agora-agents';
import type { AgoraArea } from 'agora-agents';
import type { StopConversationRequest } from '@/types/conversation';
import { rateLimit, clientIp } from '@/lib/rate-limit';

const RATE_LIMIT = { limit: 20, windowMs: 60_000 };

const AREA_MAP: Record<string, AgoraArea> = {
  US: Area.US, EU: Area.EU, AP: Area.AP, CN: Area.CN,
};

function resolveArea(): AgoraArea {
  return AREA_MAP[(process.env.AGORA_AREA ?? 'US').toUpperCase()] ?? Area.US;
}

function isAlreadyStopped(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const e = err as { statusCode?: number; body?: { detail?: string; reason?: string }; message?: string };
  if (e.statusCode === 404) return true;
  const detail = (e.body?.detail ?? e.message ?? '').toLowerCase();
  return e.body?.reason?.toLowerCase() === 'invalidrequest' && detail.includes('shutting down');
}

export async function POST(request: NextRequest) {
  const { allowed, resetAt } = rateLimit(clientIp(request), RATE_LIMIT);
  if (!allowed) {
    return NextResponse.json(
      { error: 'Too many requests.' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil((resetAt - Date.now()) / 1000)) } },
    );
  }

  try {
    const body: StopConversationRequest = await request.json();
    const { agent_id } = body;

    if (!agent_id) {
      return NextResponse.json({ error: 'agent_id is required' }, { status: 400 });
    }

    const appId = process.env.NEXT_PUBLIC_AGORA_APP_ID;
    const appCertificate = process.env.NEXT_AGORA_APP_CERTIFICATE;
    if (!appId || !appCertificate) {
      throw new Error('Missing Agora credentials.');
    }

    const client = new AgoraClient({ area: resolveArea(), appId, appCertificate });
    try {
      await client.stopAgent(agent_id);
    } catch (err) {
      if (isAlreadyStopped(err)) {
        return NextResponse.json({ success: true, state: 'already-stopping' });
      }
      throw err;
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[DocTalk] Failed to stop agent:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to stop agent' },
      { status: 500 },
    );
  }
}
