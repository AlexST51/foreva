import express from 'express';
import cors from 'cors';
import http from 'http';
import { WebSocketServer } from 'ws';
import { createHttpRouter } from './handlers/httpHandlers';
import { setupWebSocketServer } from './handlers/wsHandlers';

// ─── Configuration ──────────────────────────────────────────────────────────

const PORT = parseInt(process.env.PORT || '3001', 10);
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173';
const NODE_ENV = process.env.NODE_ENV || 'development';

// Render uses PORT=10000 by default and binds to 0.0.0.0
const HOST = process.env.HOST || '0.0.0.0';

// ─── Express App ────────────────────────────────────────────────────────────

const app = express();

// Parse JSON bodies
app.use(express.json());

// CORS: allow the client origin
// In production, restrict this to your actual domain.
app.use(
  cors({
    origin: CLIENT_URL,
    methods: ['GET', 'POST'],
    credentials: true,
  })
);

// Trust proxy for correct IP detection behind reverse proxy
// (needed for rate limiting by IP)
app.set('trust proxy', 1);

// ─── HTTP Routes ────────────────────────────────────────────────────────────

const apiRouter = createHttpRouter(CLIENT_URL);
app.use(apiRouter);

// ─── HTTP Server ────────────────────────────────────────────────────────────

const server = http.createServer(app);

// ─── WebSocket Server ───────────────────────────────────────────────────────
// Single WebSocket endpoint for:
//   - WebRTC signalling (offer, answer, iceCandidate)
//   - Chat messages
//   - Room join/leave
//
// NOTE: In production, HTTPS/WSS termination is handled by a reverse proxy
// (e.g. nginx, Cloudflare, AWS ALB/ELB). This server is transport-agnostic.

const wss = new WebSocketServer({ server });
setupWebSocketServer(wss);

// ─── Start ──────────────────────────────────────────────────────────────────

server.listen(PORT, HOST, () => {
  console.log(`
╔══════════════════════════════════════════════════════════╗
║  Foreva Server                                          ║
║  Mode:    ${NODE_ENV.padEnd(46)}║
║  Host:    ${HOST.padEnd(46)}║
║  HTTP:    http://${HOST}:${String(PORT).padEnd(38 - HOST.length)}║
║  WS:      ws://${HOST}:${String(PORT).padEnd(39 - HOST.length)}║
║  Client:  ${CLIENT_URL.padEnd(46)}║
╚══════════════════════════════════════════════════════════╝
  `);
});

// ─── Graceful Shutdown ──────────────────────────────────────────────────────

process.on('SIGTERM', () => {
  console.log('[Server] SIGTERM received, shutting down...');
  wss.close();
  server.close();
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('[Server] SIGINT received, shutting down...');
  wss.close();
  server.close();
  process.exit(0);
});
