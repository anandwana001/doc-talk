import { NextRequest, NextResponse } from 'next/server';
import {
  AgoraClient,
  Agent,
  Area,
  DeepgramSTT,
  ExpiresIn,
  MiniMaxTTS,
  OpenAI,
} from 'agora-agents';
import type { AgoraArea } from 'agora-agents';
import { buildSlimSystemPrompt } from '@/lib/system-prompt';
import { DEFAULT_AGENT_UID } from '@/lib/agora';
import { rateLimit, clientIp } from '@/lib/rate-limit';
import type { ClientStartRequest, AgentResponse } from '@/types/conversation';

const agentUid = process.env.NEXT_PUBLIC_AGENT_UID ?? String(DEFAULT_AGENT_UID);

const RATE_LIMIT = { limit: 5, windowMs: 60_000 };

const AREA_MAP: Record<string, AgoraArea> = {
  US: Area.US, EU: Area.EU, AP: Area.AP, CN: Area.CN,
};

function resolveArea(): AgoraArea {
  return AREA_MAP[(process.env.AGORA_AREA ?? 'US').toUpperCase()] ?? Area.US;
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}

function mcpUrl(): string | undefined {
  const base = process.env.APP_URL;
  if (!base) return undefined;
  const url = `${base.replace(/\/$/, '')}/api/mcp`;
  const secret = process.env.MCP_SECRET;
  return secret ? `${url}?key=${secret}` : url;
}

export async function POST(request: NextRequest) {
  const { allowed, remaining, resetAt } = rateLimit(clientIp(request), RATE_LIMIT);
  if (!allowed) {
    return NextResponse.json(
      { error: 'Too many requests. Please try again shortly.' },
      {
        status: 429,
        headers: {
          'Retry-After': String(Math.ceil((resetAt - Date.now()) / 1000)),
          'X-RateLimit-Remaining': '0',
        },
      },
    );
  }

  const inviteSecret = process.env.INVITE_SECRET;
  if (inviteSecret) {
    const auth = request.headers.get('authorization') ?? '';
    if (auth !== `Bearer ${inviteSecret}`) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
    }
  }

  try {
    const body: ClientStartRequest = await request.json();
    const { requester_id, channel_name } = body;

    if (!channel_name || !requester_id) {
      return NextResponse.json(
        { error: 'channel_name and requester_id are required' },
        { status: 400 },
      );
    }

    const appId = requireEnv('NEXT_PUBLIC_AGORA_APP_ID');
    const appCertificate = requireEnv('NEXT_AGORA_APP_CERTIFICATE');

    const greeting =
      process.env.AGENT_GREETING ??
      `Hi! I'm ${process.env.AGENT_NAME ?? 'your doc assistant'}. What would you like to know?`;

    const systemPrompt = buildSlimSystemPrompt();

    const mcp = mcpUrl();
    if (mcp) {
      console.log(`[DocTalk] invite-agent: MCP mode — tools endpoint: ${mcp}`);
    } else {
      console.warn('[DocTalk] invite-agent: APP_URL not set — agent has no doc retrieval. Set APP_URL to enable MCP.');
    }

    const llm = new OpenAI({
      model: 'gpt-4o-mini',
      greetingMessage: greeting,
      failureMessage: 'One moment please.',
      maxHistory: 20,
      params: { max_tokens: 512, temperature: 0.6, top_p: 0.9 },
      ...(mcp ? { mcpServers: [{ name: 'doctalk-docs', endpoint: mcp }] } : {}),
    });

    const client = new AgoraClient({ area: resolveArea(), appId, appCertificate });

    const agent = new Agent({
      client,
      instructions: systemPrompt,
      greeting,
      failureMessage: 'One moment please.',
      maxHistory: 40,
      turnDetection: {
        config: {
          speech_threshold: Number(process.env.VAD_SPEECH_THRESHOLD ?? 0.5),
          start_of_speech: {
            mode: 'vad',
            vad_config: {
              interrupt_duration_ms: Number(process.env.VAD_INTERRUPT_MS ?? 160),
              prefix_padding_ms: 300,
            },
          },
          end_of_speech: {
            mode: 'vad',
            vad_config: { silence_duration_ms: Number(process.env.VAD_SILENCE_MS ?? 480) },
          },
        },
      },
      advancedFeatures: { enable_rtm: true, enable_tools: !!mcp },
      parameters: {
        audio_scenario: 'chorus',
        data_channel: 'rtm',
        enable_error_message: true,
        enable_metrics: true,
      },
    })
      .withStt(new DeepgramSTT({ model: 'nova-3', language: process.env.DOCS_LANGUAGE ?? 'en' }))
      .withLlm(llm)
      .withTts(
        new MiniMaxTTS({
          model: 'speech_2_6_turbo',
          voiceId: 'English_captivating_female1',
        }),
      );

    const session = agent.createSession({
      channel: channel_name,
      agentUid,
      remoteUids: [requester_id],
      idleTimeout: 30,
      expiresIn: ExpiresIn.hours(1),
    });

    const agentId = await session.start();

    return NextResponse.json(
      {
        agent_id: agentId,
        create_ts: Math.floor(Date.now() / 1000),
        state: 'RUNNING',
      } as AgentResponse,
      { headers: { 'X-RateLimit-Remaining': String(remaining) } },
    );
  } catch (err) {
    console.error('[DocTalk] Failed to start agent:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to start agent' },
      { status: 500 },
    );
  }
}
