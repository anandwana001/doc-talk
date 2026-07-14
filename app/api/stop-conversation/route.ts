import { NextResponse } from 'next/server';
import { AgoraClient, Area } from 'agora-agents';
import type { AgoraArea } from 'agora-agents';
import type { StopConversationRequest } from '@/types/conversation';

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

export async function POST(request: Request) {
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
