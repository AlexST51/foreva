import crypto from 'crypto';

/**
 * Generate a cryptographically secure, URL-safe token.
 * Uses 16 bytes (128 bits) of entropy, encoded as base64url (22 characters).
 * This produces an unguessable token suitable for single-use call links.
 */
export function generateJoinToken(): string {
  return crypto.randomBytes(16).toString('base64url');
}

/**
 * Generate a unique room ID (internal use only, not exposed in URLs).
 */
export function generateRoomId(): string {
  return crypto.randomUUID();
}

/**
 * Generate a unique user ID for a participant.
 */
export function generateUserId(): string {
  return crypto.randomUUID();
}
