// Re-export shared types for use within the server.
// This file acts as the single import point for all shared types.

export type RoomState = 'pending' | 'active' | 'closed';
export type ParticipantRole = 'creator' | 'receiver';

export interface Participant {
  userId: string;
  name: string;
  language: string;
  role: ParticipantRole;
  connectedAt: number;
}

export interface Room {
  roomId: string;
  joinToken: string;
  state: RoomState;
  participants: Participant[];
  createdAt: number;
  closedAt?: number;
}

export interface CreateCallRequest {
  nickname: string;
  language: string;
}

export interface CreateCallResponse {
  roomId: string;
  joinToken: string;
  callUrl: string;
  userId: string;
}

export interface CallStatusResponse {
  state: RoomState;
  creatorName?: string;
  creatorLanguage?: string;
}

// Client → Server WebSocket messages
export type ClientMessage =
  | { type: 'join'; joinToken: string; userId: string; name: string; language: string }
  | { type: 'webrtc:offer'; roomId: string; offer: unknown }
  | { type: 'webrtc:answer'; roomId: string; answer: unknown }
  | { type: 'webrtc:iceCandidate'; roomId: string; candidate: unknown }
  | { type: 'chat:send'; roomId: string; senderId: string; senderName: string; originalText: string; originalLanguage: string }
  | { type: 'leave'; roomId: string }
  | { type: 'endAndExpire'; roomId: string }
  | { type: 'recording:detected'; roomId: string };

// Server → Client WebSocket messages
export type ServerMessage =
  | { type: 'joined'; roomId: string; userId: string; role: ParticipantRole; participants: Array<{ userId: string; name: string; language: string; role: ParticipantRole }> }
  | { type: 'peer:joined'; peerId: string; peerName: string; peerLanguage: string }
  | { type: 'webrtc:offer'; offer: unknown }
  | { type: 'webrtc:answer'; answer: unknown }
  | { type: 'webrtc:iceCandidate'; candidate: unknown }
  | { type: 'chat:message'; id: string; senderId: string; senderName: string; originalText: string; originalLanguage: string; translatedText: string; translatedLanguage: string; timestamp: number }
  | { type: 'peer:left'; peerId: string }
  | { type: 'room:closed'; reason: string }
  | { type: 'recording:warning'; peerName: string }
  | { type: 'error'; message: string };

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

export type LanguageCode = (typeof SUPPORTED_LANGUAGES)[number]['code'];
