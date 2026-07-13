'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import AgoraRTC, {
  useRTCClient,
  useLocalMicrophoneTrack,
  useRemoteUsers,
  useClientEvent,
  useJoin,
  usePublish,
  RemoteUser,
  type UID,
} from 'agora-rtc-react';
import {
  AgoraVoiceAI,
  AgoraVoiceAIEvents,
  AgentState,
  TurnStatus,
  TranscriptHelperMode,
  type TranscriptHelperItem,
  type UserTranscription,
  type AgentTranscription,
} from 'agora-agent-client-toolkit';
import { AgentVisualizer, type AgentVisualizerState } from 'agora-agent-uikit';
import { MicButtonWithVisualizer } from 'agora-agent-uikit/rtc';
import { DEFAULT_AGENT_UID } from '@/lib/agora';
import type { ConversationComponentProps } from '@/types/conversation';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

type AgoraRtcWithParameters = typeof AgoraRTC & {
  setParameter?: (key: string, value: unknown) => void;
};

function mapVisualizer(
  agentState: AgentState | null,
  agentConnected: boolean,
  connState: string,
): AgentVisualizerState {
  if (connState === 'DISCONNECTED' || connState === 'DISCONNECTING') return 'disconnected';
  if (connState === 'CONNECTING' || connState === 'RECONNECTING') return 'joining';
  if (!agentConnected) return 'not-joined';
  if (agentState === AgentState.LISTENING) return 'listening';
  if (agentState === AgentState.THINKING) return 'analyzing';
  if (agentState === AgentState.SPEAKING) return 'talking';
  return 'ambient';
}

interface DocLink {
  title: string;
  url: string;
}

interface TranscriptMessage {
  uid: string;
  text: string;
  isAgent: boolean;
}

export default function DocConversation({
  agoraData,
  rtmClient,
  onTokenWillExpire,
  onEndConversation,
}: ConversationComponentProps) {
  const client = useRTCClient();
  const remoteUsers = useRemoteUsers();
  const agentUID = process.env.NEXT_PUBLIC_AGENT_UID ?? String(DEFAULT_AGENT_UID);

  const [isEnabled, setIsEnabled] = useState(true);
  const [isAgentConnected, setIsAgentConnected] = useState(false);
  const [connectionState, setConnectionState] = useState('CONNECTING');
  const [joinedUID, setJoinedUID] = useState<UID>(0);
  const [agentState, setAgentState] = useState<AgentState | null>(null);
  const [transcript, setTranscript] = useState<TranscriptMessage[]>([]);
  const [inProgress, setInProgress] = useState<TranscriptMessage | null>(null);
  const [messageLinks, setMessageLinks] = useState<Map<string, DocLink[]>>(new Map());
  const fetchedFor = useRef<Set<string>>(new Set());
  const transcriptEndRef = useRef<HTMLDivElement>(null);

  // StrictMode-safe join gate
  const [isReady, setIsReady] = useState(false);
  useEffect(() => {
    let cancelled = false;
    const id = setTimeout(() => { if (!cancelled) setIsReady(true); }, 0);
    return () => { cancelled = true; clearTimeout(id); setIsReady(false); };
  }, []);

  const { isConnected: joinSuccess } = useJoin(
    {
      appid: process.env.NEXT_PUBLIC_AGORA_APP_ID!,
      channel: agoraData.channel,
      token: agoraData.token,
      uid: parseInt(agoraData.uid, 10),
    },
    isReady,
  );

  const { localMicrophoneTrack } = useLocalMicrophoneTrack(isReady);

  useEffect(() => {
    if (!client) return;
    try {
      (AgoraRTC as AgoraRtcWithParameters).setParameter?.('ENABLE_AUDIO_PTS', true);
    } catch {}
  }, [client]);

  useEffect(() => {
    if (joinSuccess && client) {
      const uid = client.uid;
      if (uid != null) setJoinedUID(uid);
    }
  }, [joinSuccess, client]);

  useEffect(() => {
    if (!isReady || !joinSuccess) return;
    let cancelled = false;

    (async () => {
      try {
        const ai = await AgoraVoiceAI.init({
          rtcEngine: client,
          rtmConfig: { rtmEngine: rtmClient },
          renderMode: TranscriptHelperMode.TEXT,
          enableLog: false,
        });

        if (cancelled) {
          try { ai.unsubscribe(); ai.destroy(); } catch {}
          return;
        }

        ai.on(
          AgoraVoiceAIEvents.TRANSCRIPT_UPDATED,
          (items: TranscriptHelperItem<Partial<UserTranscription | AgentTranscription>>[]) => {
            const done: TranscriptMessage[] = [];
            let live: TranscriptMessage | null = null;

            for (const item of items) {
              const isAgent = item.uid === agentUID;
              const text = item.text ?? '';
              const isComplete =
                item.status === TurnStatus.END || item.status === TurnStatus.INTERRUPTED;

              if (isComplete) {
                if (text.trim()) done.push({ uid: item.uid, text, isAgent });
              } else {
                // Only keep the most recent in-progress item
                live = { uid: item.uid, text, isAgent };
              }
            }

            setTranscript(done);
            setInProgress(live);
          },
        );

        ai.on(AgoraVoiceAIEvents.AGENT_STATE_CHANGED, (_: unknown, event: { state: AgentState }) =>
          setAgentState(event.state),
        );

        ai.subscribeMessage(agoraData.channel);
      } catch (err) {
        if (!cancelled) console.error('[DocTalk] AgoraVoiceAI init failed:', err);
      }
    })();

    return () => {
      cancelled = true;
      try {
        const ai = AgoraVoiceAI.getInstance();
        if (ai) { ai.unsubscribe(); ai.destroy(); }
      } catch {}
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isReady, joinSuccess]);

  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [transcript, inProgress]);

  // After each completed agent message, fetch relevant doc links to show in transcript.
  useEffect(() => {
    for (const msg of transcript) {
      if (!msg.isAgent || msg.text.trim().length < 20) continue;
      const key = msg.text.slice(0, 120);
      if (fetchedFor.current.has(key)) continue;
      fetchedFor.current.add(key);
      fetch(`/api/search-links?q=${encodeURIComponent(msg.text.slice(0, 300))}`)
        .then((r) => r.json())
        .then((links: DocLink[]) => {
          if (links.length > 0) {
            setMessageLinks((prev) => new Map(prev).set(key, links));
          }
        })
        .catch(() => {});
    }
  }, [transcript]);

  usePublish([localMicrophoneTrack]);

  useClientEvent(client, 'user-joined', (user) => {
    if (user.uid.toString() === agentUID) setIsAgentConnected(true);
  });
  useClientEvent(client, 'user-left', (user) => {
    if (user.uid.toString() === agentUID) setIsAgentConnected(false);
  });
  useEffect(() => {
    setIsAgentConnected(remoteUsers.some((u) => u.uid.toString() === agentUID));
  }, [remoteUsers, agentUID]);
  useClientEvent(client, 'connection-state-change', (state) => setConnectionState(state));

  const visualizerState = useMemo(
    () => mapVisualizer(agentState, isAgentConnected, connectionState),
    [agentState, isAgentConnected, connectionState],
  );

  const handleMicToggle = useCallback(async () => {
    const next = !isEnabled;
    try { await localMicrophoneTrack?.setEnabled(next); } catch {}
    setIsEnabled(next);
  }, [isEnabled, localMicrophoneTrack]);

  const handleTokenWillExpire = useCallback(async () => {
    if (!onTokenWillExpire || !joinedUID) return;
    try {
      const { rtcToken, rtmToken } = await onTokenWillExpire(joinedUID.toString());
      await client?.renewToken(rtcToken);
      await rtmClient.renewToken(rtmToken);
    } catch (err) {
      console.error('[DocTalk] Token renewal failed:', err);
    }
  }, [client, onTokenWillExpire, joinedUID, rtmClient]);

  useClientEvent(client, 'token-privilege-will-expire', handleTokenWillExpire);

  const isConnecting = connectionState === 'CONNECTING' || connectionState === 'RECONNECTING';

  const agentStateLabel = useMemo(() => {
    if (isConnecting) return 'Connecting…';
    if (!isAgentConnected) return 'Waiting for assistant…';
    if (agentState === AgentState.LISTENING) return 'Listening…';
    if (agentState === AgentState.THINKING) return 'Thinking…';
    if (agentState === AgentState.SPEAKING) return 'Speaking…';
    return 'Ready';
  }, [isConnecting, isAgentConnected, agentState]);

  return (
    <div className="flex flex-col h-full">

      {/* Compact top: status dot + orb + state label */}
      <div className="flex flex-col items-center pt-3 pb-1 gap-0.5 shrink-0">
        {/* Status row */}
        <div className="flex items-center gap-1.5">
          <div
            className={cn(
              'w-1.5 h-1.5 rounded-full',
              isConnecting
                ? 'bg-yellow-400 animate-pulse'
                : isAgentConnected
                ? 'bg-green-400'
                : 'bg-red-400',
            )}
          />
          <span className="text-xs text-muted-foreground">{agentStateLabel}</span>
        </div>

        {/* Orb — constrained to 96px, internal state label hidden */}
        {isConnecting && !isAgentConnected ? (
          <div className="flex items-center gap-1.5 py-2 text-muted-foreground">
            <Loader2 className="w-5 h-5 animate-spin" />
          </div>
        ) : (
          <div className="[&_p]:hidden w-28 h-28 overflow-hidden flex items-center justify-center">
            <AgentVisualizer state={visualizerState} size="sm" />
          </div>
        )}

        {/* Hidden remote audio players */}
        {remoteUsers.map((u) => (
          <div key={u.uid} className="hidden">
            <RemoteUser user={u} />
          </div>
        ))}
      </div>

      {/* Transcript */}
      <div className="flex-1 overflow-y-auto px-3 pt-2 pb-3 space-y-3 min-h-0">
        {transcript.length === 0 && !inProgress && (
          <p className="text-center text-xs text-muted-foreground pt-1">
            Speak to ask about the documentation.
          </p>
        )}
        {transcript.map((msg, i) => (
          <TranscriptBubble
            key={i}
            message={msg}
            links={msg.isAgent ? messageLinks.get(msg.text.slice(0, 120)) : undefined}
          />
        ))}
        {inProgress && <TranscriptBubble message={inProgress} live />}
        <div ref={transcriptEndRef} />
      </div>

      {/* Controls */}
      <div className="flex items-center justify-center gap-3 px-4 py-3 border-t border-border">
        <MicButtonWithVisualizer
          isEnabled={isEnabled}
          setIsEnabled={setIsEnabled}
          track={localMicrophoneTrack}
          onToggle={handleMicToggle}
          enabledColor="hsl(var(--primary))"
          disabledColor="hsl(var(--destructive))"
        />
        <button
          onClick={onEndConversation}
          className="px-4 py-2 rounded-full text-sm font-medium bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors"
        >
          End
        </button>
      </div>
    </div>
  );
}

function TranscriptBubble({
  message,
  links,
  live = false,
}: {
  message: TranscriptMessage;
  links?: DocLink[];
  live?: boolean;
}) {
  if (!message.text.trim()) return null;
  return (
    <div className={cn('flex flex-col animate-fade-in', message.isAgent ? 'items-start' : 'items-end')}>
      <div
        className={cn(
          'max-w-[85%] px-3 py-2 rounded-2xl text-sm leading-snug',
          message.isAgent
            ? 'bg-muted text-foreground rounded-tl-sm'
            : 'bg-primary text-primary-foreground rounded-tr-sm',
          live && 'opacity-70',
        )}
      >
        {message.text}
        {live && <span className="inline-block w-0.5 h-3 ml-1 bg-current animate-pulse rounded-sm align-middle" />}
      </div>

      {links && links.length > 0 && (
        <div className="mt-2 max-w-[90%]">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5 font-medium">Related pages</p>
          <div className="flex flex-wrap gap-1.5">
            {links.map((link) => (
              <a
                key={link.url}
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-border bg-background hover:bg-muted text-xs text-foreground hover:text-primary transition-colors max-w-[200px] group"
              >
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="shrink-0 text-muted-foreground group-hover:text-primary transition-colors">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                  <polyline points="14 2 14 8 20 8"/>
                </svg>
                <span className="truncate">{link.title}</span>
                <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="shrink-0 opacity-40 group-hover:opacity-100 transition-opacity">
                  <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                  <polyline points="15 3 21 3 21 9"/>
                  <line x1="10" y1="14" x2="21" y2="3"/>
                </svg>
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
