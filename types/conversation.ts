export interface AgoraTokenData {
  token: string;
  uid: string;
  channel: string;
  agentId?: string;
}

export interface ClientStartRequest {
  requester_id: string;
  channel_name: string;
  /** Page context hint (title + URL path) used for MiniSearch retrieval. */
  context?: string;
}

export interface AgentResponse {
  agent_id: string;
  create_ts: number;
  state: string;
}

export interface StopConversationRequest {
  agent_id: string;
}

export interface AgoraRenewalTokens {
  rtcToken: string;
  rtmToken: string;
}

export interface ConversationComponentProps {
  agoraData: AgoraTokenData;
  rtmClient: import('agora-rtm').RTMClient;
  onTokenWillExpire?: (uid: string) => Promise<AgoraRenewalTokens>;
  onEndConversation: () => void;
}
