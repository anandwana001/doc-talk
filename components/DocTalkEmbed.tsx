'use client';

import { useState, useRef, useCallback, useEffect, Suspense } from 'react';
import dynamic from 'next/dynamic';
import type { RTMClient } from 'agora-rtm';
import type {
  AgoraTokenData,
  ClientStartRequest,
  AgentResponse,
  AgoraRenewalTokens,
} from '@/types/conversation';
import { Loader2 } from 'lucide-react';

const DocConversation = dynamic(() => import('./DocConversation'), { ssr: false });

const AgoraProvider = dynamic(
  async () => {
    const { AgoraRTCProvider, default: AgoraRTC } = await import('agora-rtc-react');
    return {
      default: function AgoraProviders({ children }: { children: React.ReactNode }) {
        const clientRef = useRef<ReturnType<typeof AgoraRTC.createClient> | null>(null);
        if (!clientRef.current) {
          clientRef.current = AgoraRTC.createClient({ mode: 'rtc', codec: 'vp8' });
        }
        return <AgoraRTCProvider client={clientRef.current}>{children}</AgoraRTCProvider>;
      },
    };
  },
  { ssr: false },
);

type EmbedState = 'loading' | 'active' | 'error' | 'ended';

interface DocTalkEmbedProps {
  /** Page context hint passed from the host page (title + URL path). */
  context?: string;
}

/**
 * Full-screen embed version of the DocTalk conversation.
 * Designed to be loaded inside an iframe from an external site.
 * Auto-starts the conversation on mount.
 */
export function DocTalkEmbed({ context }: DocTalkEmbedProps) {
  const [state, setState] = useState<EmbedState>('loading');
  const [agoraData, setAgoraData] = useState<AgoraTokenData | null>(null);
  const [rtmClient, setRtmClient] = useState<RTMClient | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    import('agora-rtc-react').catch(() => {});
    import('agora-rtm').catch(() => {});
  }, []);

  const start = useCallback(async () => {
    setState('loading');
    setErrorMsg(null);
    try {
      const tokenRes = await fetch('/api/generate-agora-token');
      const tokenData = await tokenRes.json();
      if (!tokenRes.ok) throw new Error(tokenData.error ?? 'Token fetch failed');

      const [agentData, rtm] = await Promise.all([
        fetch('/api/invite-agent', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            requester_id: tokenData.uid,
            channel_name: tokenData.channel,
            context,
          } as ClientStartRequest),
        }).then(async (res) => (res.ok ? (res.json() as Promise<AgentResponse>) : null)),

        (async () => {
          const { default: AgoraRTM } = await import('agora-rtm');
          const rtm: RTMClient = new AgoraRTM.RTM(
            process.env.NEXT_PUBLIC_AGORA_APP_ID!,
            tokenData.uid,
          );
          await rtm.login({ token: tokenData.token });
          await rtm.subscribe(tokenData.channel, { withPresence: false });
          return rtm;
        })(),
      ]);

      setAgoraData({ ...tokenData, agentId: agentData?.agent_id });
      setRtmClient(rtm);
      setState('active');
    } catch (err) {
      console.error('[DocTalk] Embed start failed:', err);
      setErrorMsg('Could not start assistant.');
      setState('error');
    }
  }, []);

  // Auto-start on mount
  useEffect(() => { start(); }, [start]);

  const handleEnd = useCallback(async () => {
    if (agoraData?.agentId) {
      fetch('/api/stop-conversation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agent_id: agoraData.agentId }),
      }).catch(() => {});
    }
    rtmClient?.logout().catch(() => {});
    setRtmClient(null);
    setAgoraData(null);
    setState('ended');
  }, [agoraData, rtmClient]);

  const handleTokenWillExpire = useCallback(
    async (uid: string): Promise<AgoraRenewalTokens> => {
      const channel = agoraData?.channel;
      if (!channel) throw new Error('No channel for renewal');
      const [rtcRes, rtmRes] = await Promise.all([
        fetch(`/api/generate-agora-token?channel=${channel}&uid=${uid}`),
        fetch(`/api/generate-agora-token?channel=${channel}&uid=${agoraData!.uid}`),
      ]);
      const [rtcData, rtmData] = await Promise.all([rtcRes.json(), rtmRes.json()]);
      return { rtcToken: rtcData.token, rtmToken: rtmData.token };
    },
    [agoraData],
  );

  if (state === 'loading') {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 text-muted-foreground">
        <Loader2 className="w-6 h-6 animate-spin" />
        <span className="text-sm">Starting assistant…</span>
      </div>
    );
  }

  if (state === 'error') {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
        <p className="text-sm text-destructive">{errorMsg}</p>
        <button
          onClick={start}
          className="px-4 py-2 rounded-full bg-primary text-primary-foreground text-sm hover:opacity-90"
        >
          Retry
        </button>
      </div>
    );
  }

  if (state === 'ended') {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 px-6 text-center">
        <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-muted-foreground">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
            <polyline points="22 4 12 14.01 9 11.01"/>
          </svg>
        </div>
        <div>
          <p className="text-sm font-medium text-foreground">Conversation ended</p>
          <p className="text-xs text-muted-foreground mt-1">Thanks for chatting!</p>
        </div>
        <button
          onClick={start}
          className="px-4 py-2 rounded-full bg-primary text-primary-foreground text-sm hover:opacity-90 transition-opacity"
        >
          Start new conversation
        </button>
      </div>
    );
  }

  return (
    <div className="h-full">
      <Suspense
        fallback={
          <div className="flex h-full items-center justify-center">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        }
      >
        {agoraData && rtmClient && (
          <AgoraProvider>
            <DocConversation
              agoraData={agoraData}
              rtmClient={rtmClient}
              onTokenWillExpire={handleTokenWillExpire}
              onEndConversation={handleEnd}
            />
          </AgoraProvider>
        )}
      </Suspense>
    </div>
  );
}
