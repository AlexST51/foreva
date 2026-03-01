import { Room, RoomState, Participant, ParticipantRole } from '../types';
import { generateJoinToken, generateRoomId } from './tokenGenerator';

/**
 * In-memory room store.
 * Rooms are keyed by joinToken for fast lookup from URLs,
 * and also indexed by roomId for internal operations.
 */
class RoomManager {
  private roomsByToken = new Map<string, Room>();
  private roomsByRoomId = new Map<string, Room>();
  private expiryTimer: ReturnType<typeof setInterval> | null = null;

  /** Pending room expiry time in ms (default: 60 minutes) */
  private readonly PENDING_EXPIRY_MS = 60 * 60 * 1000;

  /** How often to check for expired rooms (default: 5 minutes) */
  private readonly CLEANUP_INTERVAL_MS = 5 * 60 * 1000;

  constructor() {
    this.startCleanupTimer();
  }

  /**
   * Create a new ephemeral room. Returns the room with a unique joinToken.
   */
  createRoom(): Room {
    const room: Room = {
      roomId: generateRoomId(),
      joinToken: generateJoinToken(),
      state: 'pending',
      participants: [],
      createdAt: Date.now(),
    };

    this.roomsByToken.set(room.joinToken, room);
    this.roomsByRoomId.set(room.roomId, room);

    return room;
  }

  /**
   * Look up a room by its joinToken.
   */
  getRoomByToken(token: string): Room | undefined {
    return this.roomsByToken.get(token);
  }

  /**
   * Look up a room by its internal roomId.
   */
  getRoomById(roomId: string): Room | undefined {
    return this.roomsByRoomId.get(roomId);
  }

  /**
   * Add a participant to a room.
   * Returns the assigned role, or null if the room cannot accept more participants.
   */
  addParticipant(
    room: Room,
    userId: string,
    name: string,
    language: string
  ): { role: ParticipantRole } | { error: string } {
    if (room.state === 'closed') {
      return { error: 'This call link has expired' };
    }

    if (room.participants.length >= 2) {
      return { error: 'Call already in progress or finished' };
    }

    // Check if this userId is already in the room (reconnect scenario)
    const existing = room.participants.find((p) => p.userId === userId);
    if (existing) {
      return { role: existing.role };
    }

    const role: ParticipantRole = room.participants.length === 0 ? 'creator' : 'receiver';

    const participant: Participant = {
      userId,
      name,
      language,
      role,
      connectedAt: Date.now(),
    };

    room.participants.push(participant);

    // Update room state
    if (room.participants.length === 2) {
      room.state = 'active';
    }

    return { role };
  }

  /**
   * Remove a participant from a room.
   * If both participants have left, close the room.
   */
  removeParticipant(roomId: string, userId: string): void {
    const room = this.roomsByRoomId.get(roomId);
    if (!room) return;

    room.participants = room.participants.filter((p) => p.userId !== userId);

    // If no participants remain, close the room
    if (room.participants.length === 0) {
      this.closeRoom(room, 'All participants left');
    }
  }

  /**
   * Close a room immediately. No further joins allowed.
   */
  closeRoom(room: Room, _reason: string): void {
    if (room.state === 'closed') return;

    room.state = 'closed';
    room.closedAt = Date.now();
  }

  /**
   * Close a room by its roomId.
   */
  closeRoomById(roomId: string, reason: string): Room | undefined {
    const room = this.roomsByRoomId.get(roomId);
    if (room) {
      this.closeRoom(room, reason);
    }
    return room;
  }

  /**
   * Get the other participant in a room (the peer).
   */
  getPeer(roomId: string, userId: string): Participant | undefined {
    const room = this.roomsByRoomId.get(roomId);
    if (!room) return undefined;
    return room.participants.find((p) => p.userId !== userId);
  }

  /**
   * Get a participant by userId within a room.
   */
  getParticipant(roomId: string, userId: string): Participant | undefined {
    const room = this.roomsByRoomId.get(roomId);
    if (!room) return undefined;
    return room.participants.find((p) => p.userId === userId);
  }

  /**
   * Start the background cleanup timer for expired pending rooms.
   */
  private startCleanupTimer(): void {
    this.expiryTimer = setInterval(() => {
      const now = Date.now();
      for (const [token, room] of this.roomsByToken) {
        if (
          room.state === 'pending' &&
          now - room.createdAt > this.PENDING_EXPIRY_MS
        ) {
          this.closeRoom(room, 'Pending room expired (timeout)');
          console.log(`[RoomManager] Auto-expired pending room: ${room.roomId}`);
        }
      }
    }, this.CLEANUP_INTERVAL_MS);
  }

  /**
   * Stop the cleanup timer (for graceful shutdown).
   */
  destroy(): void {
    if (this.expiryTimer) {
      clearInterval(this.expiryTimer);
      this.expiryTimer = null;
    }
  }

  /**
   * Get stats (for monitoring, no sensitive data).
   */
  getStats(): { totalRooms: number; pendingRooms: number; activeRooms: number; closedRooms: number } {
    let pending = 0;
    let active = 0;
    let closed = 0;
    for (const room of this.roomsByToken.values()) {
      if (room.state === 'pending') pending++;
      else if (room.state === 'active') active++;
      else closed++;
    }
    return { totalRooms: this.roomsByToken.size, pendingRooms: pending, activeRooms: active, closedRooms: closed };
  }
}

// Singleton instance
export const roomManager = new RoomManager();
