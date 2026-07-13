import { NextRequest, NextResponse } from 'next/server';
import { RtcTokenBuilder, RtcRole } from 'agora-token';

const TOKEN_EXPIRY_SECONDS = 3600;

function generateChannelName(): string {
  return `doctalk-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export async function GET(request: NextRequest) {
  const appId = process.env.NEXT_PUBLIC_AGORA_APP_ID;
  const appCertificate = process.env.NEXT_AGORA_APP_CERTIFICATE;

  if (!appId || !appCertificate) {
    return NextResponse.json(
      { error: 'Agora credentials are not configured on the server.' },
      { status: 500 },
    );
  }

  const { searchParams } = new URL(request.url);
  const uidParam = searchParams.get('uid');
  const parsedUid = uidParam ? parseInt(uidParam, 10) : NaN;
  const uid =
    Number.isNaN(parsedUid) || parsedUid <= 0
      ? Math.floor(Math.random() * 9_999_000) + 1000
      : parsedUid;

  const channelName = searchParams.get('channel') || generateChannelName();
  const expiresAt = Math.floor(Date.now() / 1000) + TOKEN_EXPIRY_SECONDS;

  try {
    const token = RtcTokenBuilder.buildTokenWithRtm(
      appId,
      appCertificate,
      channelName,
      uid.toString(),
      RtcRole.PUBLISHER,
      expiresAt,
      expiresAt,
    );

    return NextResponse.json({ token, uid: uid.toString(), channel: channelName });
  } catch (err) {
    console.error('[DocTalk] Token generation failed:', err);
    return NextResponse.json(
      { error: 'Failed to generate token.' },
      { status: 500 },
    );
  }
}
