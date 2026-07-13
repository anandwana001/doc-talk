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
import { loadDocumentation } from '@/lib/docs-loader';
import { buildSystemPrompt } from '@/lib/system-prompt';
import { DEFAULT_AGENT_UID } from '@/lib/agora';
import type { ClientStartRequest, AgentResponse } from '@/types/conversation';

const agentUid = process.env.NEXT_PUBLIC_AGENT_UID ?? String(DEFAULT_AGENT_UID);

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}

export async function POST(request: NextRequest) {
  try {
    const body: ClientStartRequest = await request.json();
    const { requester_id, channel_name, context } = body;

    if (!channel_name || !requester_id) {
      return NextResponse.json(
        { error: 'channel_name and requester_id are required' },
        { status: 400 },
      );
    }

    const appId = requireEnv('NEXT_PUBLIC_AGORA_APP_ID');
    const appCertificate = requireEnv('NEXT_AGORA_APP_CERTIFICATE');

    // Load documentation content and build the system prompt
    const docsContent = await loadDocumentation(context);
    const systemPrompt = buildSystemPrompt(docsContent);

    const greeting =
      process.env.AGENT_GREETING ??
      `Hi! I'm ${process.env.AGENT_NAME ?? 'your doc assistant'}. What would you like to know?`;

    const client = new AgoraClient({ area: Area.US, appId, appCertificate });

    const agent = new Agent({
      client,
      instructions: systemPrompt,
      greeting,
      failureMessage: 'One moment please.',
      maxHistory: 40,
      turnDetection: {
        config: {
          speech_threshold: 0.5,
          start_of_speech: {
            mode: 'vad',
            vad_config: {
              interrupt_duration_ms: 160,
              prefix_padding_ms: 300,
            },
          },
          end_of_speech: {
            mode: 'vad',
            vad_config: {
              silence_duration_ms: 480,
            },
          },
        },
      },
      advancedFeatures: { enable_rtm: true, enable_tools: false },
      parameters: {
        audio_scenario: 'chorus',
        data_channel: 'rtm',
        enable_error_message: true,
        enable_metrics: true,
      },
    })
      .withStt(new DeepgramSTT({ model: 'nova-3', language: 'en' }))
      .withLlm(
        new OpenAI({
          model: 'gpt-4o-mini',
          greetingMessage: greeting,
          failureMessage: 'One moment please.',
          maxHistory: 20,
          params: { max_tokens: 512, temperature: 0.6, top_p: 0.9 },
        }),
      )
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

    return NextResponse.json({
      agent_id: agentId,
      create_ts: Math.floor(Date.now() / 1000),
      state: 'RUNNING',
    } as AgentResponse);
  } catch (err) {
    console.error('[DocTalk] Failed to start agent:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to start agent' },
      { status: 500 },
    );
  }
}
