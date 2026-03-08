import { Request, Response, Router } from 'express';
import { roomManager } from '../services/roomManager';
import { generateUserId } from '../services/tokenGenerator';
import { createCallLimiter, tokenScanLimiter } from '../services/rateLimiter';
import { CreateCallRequest, CreateCallResponse, CallStatusResponse } from '../types';

export function createHttpRouter(clientUrl: string): Router {
  const router = Router();

  /**
   * POST /calls
   * Create a new call-me link (ephemeral room).
   * Rate limited: max 5 per IP per minute.
   */
  router.post('/calls', (req: Request, res: Response) => {
    const ip = req.ip || req.socket.remoteAddress || 'unknown';

    // Rate limiting
    if (!createCallLimiter.isAllowed(ip)) {
      res.status(429).json({
        error: 'Too many requests. Please wait before creating another call.',
      });
      return;
    }

    const { nickname, language } = req.body as CreateCallRequest;

    // Validate input
    if (!nickname || typeof nickname !== 'string' || nickname.trim().length === 0) {
      res.status(400).json({ error: 'Nickname is required' });
      return;
    }
    if (!language || typeof language !== 'string') {
      res.status(400).json({ error: 'Language is required' });
      return;
    }
    if (nickname.trim().length > 30) {
      res.status(400).json({ error: 'Nickname must be 30 characters or less' });
      return;
    }

    // Create room
    const room = roomManager.createRoom();
    const userId = generateUserId();

    // Build the call URL
    // In production, this would use the actual domain (HTTPS).
    // The clientUrl is the front-end origin.
    const callUrl = `${clientUrl}/c/${room.joinToken}`;

    const response: CreateCallResponse = {
      roomId: room.roomId,
      joinToken: room.joinToken,
      callUrl,
      userId,
    };

    console.log(`[HTTP] Room created: ${room.roomId} (token: ${room.joinToken.substring(0, 6)}...)`);
    res.status(201).json(response);
  });

  /**
   * GET /calls/:token
   * Check the status of a call link.
   * Used by the receiver to validate the link before joining.
   * Rate limited for invalid tokens to prevent scanning.
   */
  router.get('/calls/:token', (req: Request, res: Response) => {
    const { token } = req.params;
    const ip = req.ip || req.socket.remoteAddress || 'unknown';

    const room = roomManager.getRoomByToken(token);

    if (!room) {
      // Rate limit invalid token lookups to detect scanning
      if (!tokenScanLimiter.isAllowed(ip)) {
        res.status(429).json({ error: 'Too many requests' });
        return;
      }
      res.status(404).json({ error: 'This call link has expired or does not exist' });
      return;
    }

    // For the test room, always allow joining — skip all state/capacity checks.
    // Stale participant cleanup happens at WebSocket join time instead.
    if (token === 'test') {
      const creator = room.participants.find((p: { role: string }) => p.role === 'creator');
      const response: CallStatusResponse = {
        state: 'pending',
        creatorName: creator?.name,
        creatorLanguage: creator?.language,
      };
      res.json(response);
      return;
    }

    if (room.state === 'closed') {
      res.status(410).json({ error: 'This call link has expired' });
      return;
    }

    if (room.participants.length >= 2) {
      res.status(409).json({ error: 'Call already in progress or finished' });
      return;
    }

    const creator = room.participants.find((p: { role: string }) => p.role === 'creator');

    const response: CallStatusResponse = {
      state: room.state,
      creatorName: creator?.name,
      creatorLanguage: creator?.language,
    };

    res.json(response);
  });

  /**
   * GET /health
   * Health check endpoint with aggregated stats (no sensitive data).
   */
  router.get('/health', (_req: Request, res: Response) => {
    const stats = roomManager.getStats();
    res.json({ status: 'ok', ...stats });
  });

  return router;
}
