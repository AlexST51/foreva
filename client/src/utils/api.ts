const API_URL = import.meta.env.VITE_API_URL || '';

export interface CreateCallResult {
  roomId: string;
  joinToken: string;
  callUrl: string;
  userId: string;
}

export interface CallStatus {
  state: 'pending' | 'active' | 'closed';
  creatorName?: string;
  creatorLanguage?: string;
}

/**
 * Create a new call-me link.
 */
export async function createCall(nickname: string, language: string): Promise<CreateCallResult> {
  const res = await fetch(`${API_URL}/calls`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ nickname, language }),
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || `Failed to create call (${res.status})`);
  }

  return res.json();
}

/**
 * Check the status of a call link by its token.
 */
export async function getCallStatus(token: string): Promise<CallStatus> {
  const res = await fetch(`${API_URL}/calls/${token}`);

  if (res.status === 404) {
    throw new Error('This call link has expired or does not exist');
  }
  if (res.status === 410) {
    throw new Error('This call link has expired');
  }
  if (res.status === 409) {
    throw new Error('Call already in progress or finished');
  }
  if (res.status === 429) {
    throw new Error('Too many requests. Please try again later.');
  }
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || `Failed to check call status (${res.status})`);
  }

  return res.json();
}

/**
 * Fetch TURN server credentials from the backend.
 * The backend proxies the Metered.ca API to keep the API key secret.
 */
export async function getTurnCredentials(): Promise<RTCIceServer[]> {
  try {
    const res = await fetch(`${API_URL}/turn-credentials`);
    if (!res.ok) throw new Error(`Failed to fetch TURN credentials (${res.status})`);
    return res.json();
  } catch (err) {
    console.warn('[API] Failed to fetch TURN credentials, using STUN fallback:', err);
    return [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
    ];
  }
}

/**
 * Get the WebSocket URL for the current environment.
 */
export function getWsUrl(): string {
  const wsUrl = import.meta.env.VITE_WS_URL;
  if (wsUrl) return wsUrl;

  // In production (no explicit WS URL set), derive from the API URL
  const apiUrl = import.meta.env.VITE_API_URL;
  if (apiUrl) {
    const protocol = apiUrl.startsWith('https') ? 'wss:' : 'ws:';
    const host = apiUrl.replace(/^https?:\/\//, '');
    return `${protocol}//${host}`;
  }

  // In development with Vite proxy, connect directly to the backend
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//localhost:3001`;
}
