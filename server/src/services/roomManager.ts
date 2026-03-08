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

  /** Closed room cleanup time in ms (default: 5 minutes after closing) */
  private readonly CLOSED_CLEANUP_MS = 5 * 60 * 1000;

  /** How often to check for expired rooms (default: 5 minutes) */
  private readonly CLEANUP_INTERVAL_MS = 5 * 60 * 1000;

  /** Fixed test token for development/testing */
  static readonly TEST_TOKEN = 'test';

  constructor() {
    this.startCleanupTimer();
    this.createTestRoom();
  }

  /**
   * Create a fixed test room that never expires.
   * Accessible via /c/test
   */
  private createTestRoom(): void {
    const room: Room = {
      roomId: 'test-room-fixed',
      joinToken: RoomManager.TEST_TOKEN,
      state: 'pending',
      participants: [],
      createdAt: Date.now(),
    };
    this.roomsByToken.set(room.joinToken, room);
    this.roomsByRoomId.set(room.roomId, room);
    console.log('[RoomManager] Fixed test room created (token: test)');
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
    language: string,
    activeUserIds?: Set<string>
  ): { role: ParticipantRole } | { error: string } {
    if (room.state === 'closed') {
      // Test room should never stay closed — reset it
      if (room.joinToken === RoomManager.TEST_TOKEN) {
        room.state = 'pending';
        room.participants = [];
        room.closedAt = undefined;
        console.log('[RoomManager] Test room was closed, resetting for new join');
      } else {
        return { error: 'This call link has expired' };
      }
    }

    // For the test room, clean up stale/ghost participants that no longer have active connections
    if (room.joinToken === RoomManager.TEST_TOKEN && activeUserIds) {
      const before = room.participants.length;
      room.participants = room.participants.filter((p) => activeUserIds.has(p.userId));
      if (room.participants.length < before) {
        console.log(`[RoomManager] Test room: cleaned ${before - room.participants.length} stale participant(s)`);
        if (room.participants.length < 2) {
          room.state = 'pending';
        }
      }
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
   * If both participants have left, close the room (or reset if it's the test room).
   */
  removeParticipant(roomId: string, userId: string): void {
    const room = this.roomsByRoomId.get(roomId);
    if (!room) return;

    const before = room.participants.length;
    room.participants = room.participants.filter((p) => p.userId !== userId);

    if (room.participants.length === before) return; // user wasn't in the room

    console.log(`[RoomManager] Removed ${userId} from ${roomId}, ${room.participants.length} participant(s) remain`);

    // If one participant remains, go back to pending
    if (room.participants.length === 1 && room.state === 'active') {
      room.state = 'pending';
      console.log(`[RoomManager] Room ${roomId} back to pending (1 participant left)`);
    }

    // If no participants remain
    if (room.participants.length === 0) {
      // Test room resets instead of closing so it can be reused
      if (room.joinToken === RoomManager.TEST_TOKEN) {
        room.state = 'pending';
        room.closedAt = undefined;
        console.log('[RoomManager] Test room reset to pending');
      } else {
        this.closeRoom(room, 'All participants left');
      }
    }
  }

  /**
   * Close a room immediately. No further joins allowed.
   * The test room resets instead of closing.
   */
  closeRoom(room: Room, _reason: string): void {
    if (room.state === 'closed') return;

    // Test room resets instead of permanently closing
    if (room.joinToken === RoomManager.TEST_TOKEN) {
      room.state = 'pending';
      room.participants = [];
      room.closedAt = undefined;
      console.log('[RoomManager] Test room reset to pending (close attempted)');
      return;
    }

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
      const toDelete: string[] = [];

      for (const [token, room] of this.roomsByToken) {
        // Never expire the fixed test room
        if (token === RoomManager.TEST_TOKEN) continue;

        // Expire pending rooms that have been waiting too long
        if (
          room.state === 'pending' &&
          now - room.createdAt > this.PENDING_EXPIRY_MS
        ) {
          this.closeRoom(room, 'Pending room expired (timeout)');
          console.log(`[RoomManager] Auto-expired pending room: ${room.roomId}`);
        }

        // Remove closed rooms from memory after a grace period
        if (
          room.state === 'closed' &&
          room.closedAt &&
          now - room.closedAt > this.CLOSED_CLEANUP_MS
        ) {
          toDelete.push(token);
        }
      }

      // Clean up closed rooms from maps
      for (const token of toDelete) {
        const room = this.roomsByToken.get(token);
        if (room) {
          this.roomsByRoomId.delete(room.roomId);
          this.roomsByToken.delete(token);
          console.log(`[RoomManager] Cleaned up closed room: ${room.roomId}`);
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
