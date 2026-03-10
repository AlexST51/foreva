import { WebSocket, WebSocketServer } from 'ws';
import { IncomingMessage } from 'http';
import { v4 as uuidv4 } from 'uuid';
import { roomManager } from '../services/roomManager';
import { translateText } from '../services/translator';
import { ClientMessage, ServerMessage } from '../types';

// ─── Connection tracking ────────────────────────────────────────────────────

interface ConnectedClient {
  ws: WebSocket;
  userId: string;
  roomId: string;
  name: string;
  language: string;
}

/** Map of WebSocket → client info (set after 'join' message) */
const clients = new Map<WebSocket, ConnectedClient>();

/** Map of roomId → Set of WebSockets in that room */
const roomSockets = new Map<string, Set<WebSocket>>();

// ─── Helpers ────────────────────────────────────────────────────────────────

function send(ws: WebSocket, msg: ServerMessage): void {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(msg));
  }
}

function sendToRoom(roomId: string, msg: ServerMessage, excludeWs?: WebSocket): void {
  const sockets = roomSockets.get(roomId);
  if (!sockets) return;
  for (const ws of sockets) {
    if (ws !== excludeWs) {
      send(ws, msg);
    }
  }
}

function removeClientFromRoom(ws: WebSocket): void {
  const client = clients.get(ws);
  if (!client) return;

  const { roomId, userId } = client;

  // Remove from room sockets
  const sockets = roomSockets.get(roomId);
  if (sockets) {
    sockets.delete(ws);
    if (sockets.size === 0) {
      roomSockets.delete(roomId);
    }
  }

  // Notify peer
  sendToRoom(roomId, { type: 'peer:left', peerId: userId });

  // Remove participant from room manager
  roomManager.removeParticipant(roomId, userId);

  // Clean up client entry
  clients.delete(ws);

  console.log(`[WS] User ${userId} left room ${roomId}`);
}

// ─── Message Handlers ───────────────────────────────────────────────────────

async function handleJoin(ws: WebSocket, msg: Extract<ClientMessage, { type: 'join' }>): Promise<void> {
  const { joinToken, userId, name, language } = msg;

  // Look up room by token
  const room = roomManager.getRoomByToken(joinToken);
  if (!room) {
    send(ws, { type: 'error', message: 'This call link has expired or does not exist' });
    return;
  }

  // Build set of currently connected userIds in this room (for stale participant cleanup)
  const activeUserIds = new Set<string>();
  const roomSocketSet = roomSockets.get(room.roomId);
  if (roomSocketSet) {
    for (const sock of roomSocketSet) {
      const c = clients.get(sock);
      if (c && sock.readyState === WebSocket.OPEN) {
        activeUserIds.add(c.userId);
      }
    }
  }

  // Try to add participant
  const result = roomManager.addParticipant(room, userId, name, language, activeUserIds);
  if ('error' in result) {
    send(ws, { type: 'error', message: result.error });
    return;
  }

  // Track this connection
  const client: ConnectedClient = {
    ws,
    userId,
    roomId: room.roomId,
    name,
    language,
  };
  clients.set(ws, client);

  // Add to room sockets
  if (!roomSockets.has(room.roomId)) {
    roomSockets.set(room.roomId, new Set());
  }
  roomSockets.get(room.roomId)!.add(ws);

  // Send join confirmation
  send(ws, {
    type: 'joined',
    roomId: room.roomId,
    userId,
    role: result.role,
    participants: room.participants.map((p: { userId: string; name: string; language: string; role: string }) => ({
      userId: p.userId,
      name: p.name,
      language: p.language,
      role: p.role as 'creator' | 'receiver',
    })),
  });

  // Notify existing peer that someone joined
  if (result.role === 'receiver') {
    sendToRoom(room.roomId, {
      type: 'peer:joined',
      peerId: userId,
      peerName: name,
      peerLanguage: language,
    }, ws);
  }

  console.log(`[WS] User ${userId} (${name}) joined room ${room.roomId} as ${result.role}`);
}

function handleWebRTCOffer(ws: WebSocket, msg: Extract<ClientMessage, { type: 'webrtc:offer' }>): void {
  const client = clients.get(ws);
  if (!client) return;

  // Forward offer to the other peer in the room
  sendToRoom(client.roomId, { type: 'webrtc:offer', offer: msg.offer }, ws);
}

function handleWebRTCAnswer(ws: WebSocket, msg: Extract<ClientMessage, { type: 'webrtc:answer' }>): void {
  const client = clients.get(ws);
  if (!client) return;

  sendToRoom(client.roomId, { type: 'webrtc:answer', answer: msg.answer }, ws);
}

function handleICECandidate(ws: WebSocket, msg: Extract<ClientMessage, { type: 'webrtc:iceCandidate' }>): void {
  const client = clients.get(ws);
  if (!client) return;

  sendToRoom(client.roomId, { type: 'webrtc:iceCandidate', candidate: msg.candidate }, ws);
}

async function handleChatSend(ws: WebSocket, msg: Extract<ClientMessage, { type: 'chat:send' }>): Promise<void> {
  const client = clients.get(ws);
  if (!client) return;

  const { originalText, originalLanguage, senderId, senderName } = msg;

  // Find the peer's language
  const peer = roomManager.getPeer(client.roomId, client.userId);
  const targetLanguage = peer?.language || originalLanguage;

  // Translate (stub for now)
  const translatedText = await translateText(originalText, originalLanguage, targetLanguage);

  // Build the unified chat message
  const chatMessage: Extract<ServerMessage, { type: 'chat:message' }> = {
    type: 'chat:message',
    id: uuidv4(),
    senderId,
    senderName,
    originalText,
    originalLanguage,
    translatedText,
    translatedLanguage: targetLanguage,
    timestamp: Date.now(),
  };

  // Broadcast to ALL participants in the room (including sender)
  sendToRoom(client.roomId, chatMessage);
}

function handleLeave(ws: WebSocket): void {
  removeClientFromRoom(ws);
}

function handleRecordingDetected(ws: WebSocket): void {
  const client = clients.get(ws);
  if (!client) return;

  // Forward recording warning to the other peer with the detector's name
  sendToRoom(client.roomId, { type: 'recording:warning', peerName: client.name }, ws);
  console.log(`[WS] Recording detected by ${client.name} in room ${client.roomId}`);
}

function handleEndAndExpire(ws: WebSocket, msg: Extract<ClientMessage, { type: 'endAndExpire' }>): void {
  const client = clients.get(ws);
  if (!client) return;

  const room = roomManager.getRoomById(client.roomId);
  if (!room) return;

  // Check if the requester is the creator
  const participant = roomManager.getParticipant(client.roomId, client.userId);
  if (!participant || participant.role !== 'creator') {
    send(ws, { type: 'error', message: 'Only the creator can expire the link' });
    return;
  }

  // Notify all participants
  sendToRoom(client.roomId, { type: 'room:closed', reason: 'Creator ended the call and expired the link' });

  // Close the room
  roomManager.closeRoomById(client.roomId, 'Creator expired the link');

  // Disconnect all sockets in the room
  const sockets = roomSockets.get(client.roomId);
  if (sockets) {
    for (const s of sockets) {
      clients.delete(s);
      s.close();
    }
    roomSockets.delete(client.roomId);
  }

  console.log(`[WS] Room ${client.roomId} expired by creator`);
}

// ─── WebSocket Server Setup ─────────────────────────────────────────────────

export function setupWebSocketServer(wss: WebSocketServer): void {
  wss.on('connection', (ws: WebSocket, _req: IncomingMessage) => {
    // NOTE: In production, HTTPS/WSS termination happens at the reverse proxy
    // (e.g. nginx, Cloudflare, AWS ALB). The WebSocket server itself is
    // transport-agnostic and works with both ws:// and wss://.

    ws.on('message', async (data) => {
      try {
        const raw = JSON.parse(data.toString());

        // Handle keepalive ping before type checking
        if (raw.type === 'ping') {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'pong' }));
          }
          return;
        }

        const msg = raw as ClientMessage;

        switch (msg.type) {
          case 'join':
            await handleJoin(ws, msg);
            break;
          case 'webrtc:offer':
            handleWebRTCOffer(ws, msg);
            break;
          case 'webrtc:answer':
            handleWebRTCAnswer(ws, msg);
            break;
          case 'webrtc:iceCandidate':
            handleICECandidate(ws, msg);
            break;
          case 'chat:send':
            await handleChatSend(ws, msg);
            break;
          case 'leave':
            handleLeave(ws);
            break;
          case 'endAndExpire':
            handleEndAndExpire(ws, msg);
            break;
          case 'recording:detected':
            handleRecordingDetected(ws);
            break;
          default:
            send(ws, { type: 'error', message: 'Unknown message type' });
        }
      } catch (err) {
        console.error('[WS] Error processing message:', err);
        send(ws, { type: 'error', message: 'Invalid message format' });
      }
    });

    ws.on('close', () => {
      removeClientFromRoom(ws);
    });

    ws.on('error', (err) => {
      console.error('[WS] Socket error:', err);
      removeClientFromRoom(ws);
    });
  });

  console.log('[WS] WebSocket server ready');
}
