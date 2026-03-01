// ─── Client-side types ──────────────────────────────────────────────────────

export type RoomState = 'pending' | 'active' | 'closed';
export type ParticipantRole = 'creator' | 'receiver';

export interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  originalText: string;
  originalLanguage: string;
  translatedText: string;
  translatedLanguage: string;
  timestamp: number;
}

export interface PeerInfo {
  userId: string;
  name: string;
  language: string;
  role: ParticipantRole;
}

export interface CallState {
  roomId: string | null;
  joinToken: string | null;
  callUrl: string | null;
  userId: string | null;
  role: ParticipantRole | null;
  peerName: string | null;
  peerLanguage: string | null;
  status: 'idle' | 'waiting' | 'connecting' | 'connected' | 'ended' | 'expired' | 'error';
  errorMessage: string | null;
}

// ─── WebSocket Message Types (client-side) ──────────────────────────────────

export type ClientWsMessage =
  | { type: 'join'; joinToken: string; userId: string; name: string; language: string }
  | { type: 'webrtc:offer'; roomId: string; offer: RTCSessionDescriptionInit }
  | { type: 'webrtc:answer'; roomId: string; answer: RTCSessionDescriptionInit }
  | { type: 'webrtc:iceCandidate'; roomId: string; candidate: RTCIceCandidateInit }
  | { type: 'chat:send'; roomId: string; senderId: string; senderName: string; originalText: string; originalLanguage: string }
  | { type: 'leave'; roomId: string }
  | { type: 'endAndExpire'; roomId: string };

export type ServerWsMessage =
  | { type: 'joined'; roomId: string; userId: string; role: ParticipantRole; participants: PeerInfo[] }
  | { type: 'peer:joined'; peerId: string; peerName: string; peerLanguage: string }
  | { type: 'webrtc:offer'; offer: RTCSessionDescriptionInit }
  | { type: 'webrtc:answer'; answer: RTCSessionDescriptionInit }
  | { type: 'webrtc:iceCandidate'; candidate: RTCIceCandidateInit }
  | { type: 'chat:message'; id: string; senderId: string; senderName: string; originalText: string; originalLanguage: string; translatedText: string; translatedLanguage: string; timestamp: number }
  | { type: 'peer:left'; peerId: string }
  | { type: 'room:closed'; reason: string }
  | { type: 'error'; message: string };

// ─── Language Options ───────────────────────────────────────────────────────

export const SUPPORTED_LANGUAGES = [
  { code: 'en', name: 'English' },
  { code: 'es', name: 'Español' },
  { code: 'fr', name: 'Français' },
  { code: 'de', name: 'Deutsch' },
  { code: 'it', name: 'Italiano' },
  { code: 'pt', name: 'Português' },
  { code: 'ru', name: 'Русский' },
  { code: 'zh', name: '中文' },
  { code: 'ja', name: '日本語' },
  { code: 'ko', name: '한국어' },
  { code: 'ar', name: 'العربية' },
  { code: 'hi', name: 'हिन्दी' },
  { code: 'tr', name: 'Türkçe' },
  { code: 'uk', name: 'Українська' },
  { code: 'pl', name: 'Polski' },
] as const;
