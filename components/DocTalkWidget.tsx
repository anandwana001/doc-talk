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
import { MessageCircle, X, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

// Browser-only dynamic imports to avoid SSR issues with Agora SDKs
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

type WidgetState = 'idle' | 'loading' | 'active' | 'error';

interface DocTalkWidgetProps {
  /** Visible label on the trigger button. Defaults to "Talk to Docs" */
  buttonLabel?: string;
  /** Title shown in the panel header. Defaults to env AGENT_NAME or "Doc Assistant" */
  panelTitle?: string;
  /** Position of the floating button. Defaults to bottom-right. */
  position?: 'bottom-right' | 'bottom-left';
}

/**
 * DocTalkWidget — drop this anywhere on your page to add a voice doc assistant.
 *
 * Example:
 *   <DocTalkWidget />
 *   <DocTalkWidget buttonLabel="Ask our docs" position="bottom-left" />
 */
export function DocTalkWidget({
  buttonLabel = 'Talk to Docs',
  panelTitle = 'Doc Assistant',
  position = 'bottom-right',
}: DocTalkWidgetProps) {
  const [widgetState, setWidgetState] = useState<WidgetState>('idle');
  const [isOpen, setIsOpen] = useState(false);
  const [agoraData, setAgoraData] = useState<AgoraTokenData | null>(null);
  const [rtmClient, setRtmClient] = useState<RTMClient | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Preload heavy browser-only modules on mount so the first click feels instant
  useEffect(() => {
    import('agora-rtc-react').catch(() => {});
    import('agora-rtm').catch(() => {});
  }, []);

  const handleOpen = async () => {
    if (isOpen) return;
    setIsOpen(true);
    setWidgetState('loading');
    setErrorMessage(null);

    try {
      // 1. Fetch RTC token + channel name
      const tokenRes = await fetch('/api/generate-agora-token');
      const tokenData = await tokenRes.json();
      if (!tokenRes.ok) throw new Error(tokenData.error ?? 'Token fetch failed');

      // 2. Start agent + set up RTM client in parallel
      const [agentData, rtm] = await Promise.all([
        fetch('/api/invite-agent', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            requester_id: tokenData.uid,
            channel_name: tokenData.channel,
            context: typeof window !== 'undefined'
              ? `${document.title} ${window.location.pathname}`
              : undefined,
          } as ClientStartRequest),
        }).then(async (res) => {
          if (!res.ok) {
            const body = await res.json().catch(() => ({}));
            console.warn('[DocTalk] Agent start failed (non-fatal):', body);
            return null;
          }
          return res.json() as Promise<AgentResponse>;
        }),

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
      setWidgetState('active');
    } catch (err) {
      console.error('[DocTalk] Widget setup failed:', err);
      setErrorMessage('Could not start the assistant. Please try again.');
      setWidgetState('error');
    }
  };

  const handleClose = useCallback(async () => {
    // Stop the agent if one was started
    if (agoraData?.agentId) {
      fetch('/api/stop-conversation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agent_id: agoraData.agentId }),
      }).catch(() => {});
    }
    // Tear down RTM
    rtmClient?.logout().catch(() => {});

    setRtmClient(null);
    setAgoraData(null);
    setWidgetState('idle');
    setIsOpen(false);
  }, [agoraData, rtmClient]);

  const handleTokenWillExpire = useCallback(
    async (uid: string): Promise<AgoraRenewalTokens> => {
      const channel = agoraData?.channel;
      if (!channel) throw new Error('No channel for renewal');
      // buildTokenWithRtm issues a single combined token valid for both RTC and RTM.
      const res = await fetch(`/api/generate-agora-token?channel=${channel}&uid=${uid}`);
      if (!res.ok) throw new Error('Token renewal failed');
      const data = await res.json();
      return { rtcToken: data.token, rtmToken: data.token };
    },
    [agoraData],
  );

  const positionClasses = position === 'bottom-left'
    ? 'bottom-6 left-6'
    : 'bottom-6 right-6';

  return (
    <div className={cn('fixed z-50', positionClasses)}>
      {/* Panel */}
      {isOpen && (
        <div
          className={cn(
            'absolute mb-4 w-[340px] rounded-2xl border border-border bg-background shadow-2xl overflow-hidden',
            'animate-fade-in',
            position === 'bottom-left' ? 'left-0' : 'right-0',
            'bottom-full',
          )}
          style={{ maxHeight: '520px', display: 'flex', flexDirection: 'column' }}
        >
          {/* Panel title bar */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-card">
            <span className="text-sm font-semibold text-foreground">{panelTitle}</span>
            <button
              onClick={handleClose}
              className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Panel body */}
          <div className="flex-1 overflow-hidden min-h-0" style={{ minHeight: 0 }}>
            {widgetState === 'loading' && (
              <div className="flex flex-col items-center justify-center h-full gap-3 py-16 text-muted-foreground">
                <Loader2 className="w-6 h-6 animate-spin" />
                <span className="text-sm">Starting assistant…</span>
              </div>
            )}

            {widgetState === 'error' && (
              <div className="flex flex-col items-center justify-center h-full gap-3 py-16 px-4 text-center">
                <p className="text-sm text-destructive">{errorMessage}</p>
                <button
                  onClick={() => { setWidgetState('idle'); handleOpen(); }}
                  className="px-4 py-2 rounded-full bg-primary text-primary-foreground text-sm hover:opacity-90 transition-opacity"
                >
                  Try again
                </button>
              </div>
            )}

            {widgetState === 'active' && agoraData && rtmClient && (
              <Suspense
                fallback={
                  <div className="flex items-center justify-center py-16">
                    <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                  </div>
                }
              >
                <AgoraProvider>
                  <div className="flex flex-col" style={{ height: '440px' }}>
                    <DocConversation
                      agoraData={agoraData}
                      rtmClient={rtmClient}
                      onTokenWillExpire={handleTokenWillExpire}
                      onEndConversation={handleClose}
                    />
                  </div>
                </AgoraProvider>
              </Suspense>
            )}
          </div>
        </div>
      )}

      {/* Floating trigger button */}
      <button
        onClick={isOpen ? handleClose : handleOpen}
        disabled={widgetState === 'loading'}
        className={cn(
          'flex items-center gap-2 px-4 py-3 rounded-full shadow-lg font-medium text-sm transition-all',
          'bg-primary text-primary-foreground hover:opacity-90 active:scale-95',
          widgetState === 'loading' && 'opacity-70 cursor-not-allowed',
        )}
        aria-label={isOpen ? 'Close doc assistant' : buttonLabel}
      >
        {widgetState === 'loading' ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : isOpen ? (
          <X className="w-4 h-4" />
        ) : (
          <MessageCircle className="w-4 h-4" />
        )}
        {!isOpen && <span>{buttonLabel}</span>}
      </button>
    </div>
  );
}
