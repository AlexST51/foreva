# Foreva (parlez.me) — Architecture & Technical Overview

> **A peer-to-peer, multilingual video calling application with real-time translation.**
>
> Live at: [https://parlez.me](https://parlez.me)

---

## Table of Contents

1. [Product Overview](#product-overview)
2. [Technology Stack](#technology-stack)
3. [Architecture Diagram](#architecture-diagram)
4. [Project Structure](#project-structure)
5. [Client Application](#client-application)
6. [Server Application](#server-application)
7. [Key Features & Implementation](#key-features--implementation)
8. [Security Design](#security-design)
9. [Deployment Architecture](#deployment-architecture)
10. [Design Decisions & Trade-offs](#design-decisions--trade-offs)
11. [Future Considerations](#future-considerations)

---

## Product Overview

Foreva is a **1-to-1 video calling app** designed for cross-language communication. A user creates a shareable "call-me" link, sends it to someone, and both parties join a peer-to-peer video call. The app provides:

- **Real-time video/audio** via WebRTC (peer-to-peer, no media server)
- **Live speech-to-text** using the browser's Web Speech API
- **Automatic translation** of chat messages between languages
- **Background blur** using MediaPipe Selfie Segmentation
- **Screen recording detection** with peer notification
- **Single-use, expiring call links** for privacy

The entire call is ephemeral — no data is stored, no accounts are required.

---

## Technology Stack

### Client (Frontend)

| Technology | Version | Purpose | Why This Choice |
|---|---|---|---|
| **React** | 19 | UI framework | Component model, hooks for stateful logic, huge ecosystem |
| **TypeScript** | 5.6+ | Type safety | Catches bugs at compile time, self-documenting code |
| **Vite** | 6 | Build tool & dev server | Sub-second HMR, native ESM, fast production builds |
| **React Router** | 7 | Client-side routing | SPA navigation for `/` and `/c/:token` routes |
| **MediaPipe Selfie Segmentation** | 0.1.x | Background blur | Runs entirely in-browser, no server-side processing |
| **Web Speech API** | Browser-native | Speech recognition | Zero-dependency, real-time transcription |
| **WebRTC** | Browser-native | Peer-to-peer media | Direct audio/video between browsers, low latency |

### Server (Backend)

| Technology | Version | Purpose | Why This Choice |
|---|---|---|---|
| **Node.js** | 18+ | Runtime | Non-blocking I/O, ideal for WebSocket-heavy workloads |
| **Express** | 4.21 | HTTP framework | Minimal, well-understood, easy to extend |
| **ws** | 8.18 | WebSocket server | Lightweight, no Socket.IO overhead, full control |
| **TypeScript** | 5.6+ | Type safety | Shared types between client and server |
| **tsx** | 4.19 | Dev runner | Watch mode with instant TypeScript execution |
| **uuid** | 10 | ID generation | RFC-compliant UUIDs for room/user IDs |
| **Node crypto** | Built-in | Token generation | Cryptographically secure random bytes |

### Infrastructure

| Service | Purpose | Why This Choice |
|---|---|---|
| **Vercel** | Client hosting (static SPA) | Free tier, automatic GitHub deploys, global CDN |
| **Render** | Server hosting (Node.js) | Free tier, WebSocket support, auto-deploy from GitHub |
| **Google Translate API** | Chat translation | Free unofficial endpoint, no API key required |
| **Google STUN servers** | NAT traversal (WebRTC) | Free, reliable, globally distributed |
| **Metered.ca TURN** | Relay fallback (WebRTC) | Provisioned but currently parked; needed for symmetric NAT |

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                        CLIENT (Vercel)                          │
│                                                                 │
│  React SPA ──── React Router ──── Vite Build                    │
│       │                                                         │
│  ┌────┴─────────────────────────────────────────────┐           │
│  │  Components                                       │           │
│  │  ├── CreateCall    (home page, create link)       │           │
│  │  ├── JoinCall      (validate link, enter name)    │           │
│  │  ├── VideoCall     (main call UI)                 │           │
│  │  ├── VideoControls (mic, cam, blur, end call)     │           │
│  │  ├── ChatOverlay   (translated chat messages)     │           │
│  │  └── Logo          (branding)                     │           │
│  ├──────────────────────────────────────────────────┤           │
│  │  Custom Hooks                                     │           │
│  │  ├── useWebRTC              (peer connection)     │           │
│  │  ├── useWebSocket           (signalling)          │           │
│  │  ├── useMediaDevices        (camera/mic)          │           │
│  │  ├── useBackgroundBlur      (MediaPipe)           │           │
│  │  ├── useSpeechRecognition   (Web Speech API)      │           │
│  │  └── useScreenCaptureDetection                    │           │
│  └───────────────────────────────────────────────────┘           │
│       │ HTTP (REST)              │ WebSocket                     │
└───────┼──────────────────────────┼───────────────────────────────┘
        │                          │
        ▼                          ▼
┌─────────────────────────────────────────────────────────────────┐
│                        SERVER (Render)                           │
│                                                                 │
│  Express + ws WebSocket Server                                  │
│       │                                                         │
│  ┌────┴─────────────────────────────────────────────┐           │
│  │  HTTP Handlers                                    │           │
│  │  ├── POST /calls          (create room)           │           │
│  │  ├── GET  /calls/:token   (check link status)     │           │
│  │  ├── GET  /turn-credentials (ICE server config)   │           │
│  │  └── GET  /health         (monitoring)            │           │
│  ├──────────────────────────────────────────────────┤           │
│  │  WebSocket Handlers                               │           │
│  │  ├── join / leave                                 │           │
│  │  ├── webrtc:offer / answer / iceCandidate         │           │
│  │  ├── chat:send → translate → chat:message         │           │
│  │  ├── endAndExpire                                 │           │
│  │  └── recording:detected → recording:warning       │           │
│  ├──────────────────────────────────────────────────┤           │
│  │  Services                                         │           │
│  │  ├── RoomManager      (in-memory room store)      │           │
│  │  ├── TokenGenerator   (crypto-secure tokens)      │           │
│  │  ├── RateLimiter      (sliding window per IP)     │           │
│  │  └── Translator       (Google Translate)          │           │
│  └───────────────────────────────────────────────────┘           │
└─────────────────────────────────────────────────────────────────┘
        │                          │
        ▼                          ▼
   ┌─────────┐            ┌──────────────┐
   │  STUN   │            │  Peer-to-Peer │
   │ Servers │            │  Media Stream │
   └─────────┘            └──────────────┘
```

---

## Project Structure

```
foreva/
├── client/                     # React SPA (Vite)
│   ├── src/
│   │   ├── components/         # React components
│   │   │   ├── CreateCall.tsx   # Home page — create a call link
│   │   │   ├── JoinCall.tsx     # Validate link, enter name/language
│   │   │   ├── VideoCall.tsx    # Main video call interface
│   │   │   ├── VideoControls.tsx# Call controls (mic, cam, blur, etc.)
│   │   │   ├── ChatOverlay.tsx  # Translated chat message overlay
│   │   │   └── Logo.tsx         # App branding
│   │   ├── hooks/              # Custom React hooks
│   │   │   ├── useWebRTC.ts     # WebRTC peer connection management
│   │   │   ├── useWebSocket.ts  # WebSocket connection & messaging
│   │   │   ├── useMediaDevices.ts # Camera/microphone access
│   │   │   ├── useBackgroundBlur.ts # MediaPipe background blur
│   │   │   ├── useSpeechRecognition.ts # Web Speech API
│   │   │   └── useScreenCaptureDetection.ts
│   │   ├── types/              # Client-specific TypeScript types
│   │   ├── utils/              # API URL helpers
│   │   ├── App.tsx             # Router setup
│   │   ├── main.tsx            # Entry point
│   │   ├── i18n.ts             # Internationalisation config
│   │   └── styles.css          # Global styles
│   ├── index.html
│   ├── vite.config.ts
│   ├── vercel.json             # Vercel SPA rewrite rules
│   └── package.json
│
├── server/                     # Node.js + Express + ws
│   ├── src/
│   │   ├── handlers/
│   │   │   ├── httpHandlers.ts  # REST API routes
│   │   │   └── wsHandlers.ts    # WebSocket message handlers
│   │   ├── services/
│   │   │   ├── roomManager.ts   # In-memory room lifecycle
│   │   │   ├── tokenGenerator.ts# Crypto-secure token/ID generation
│   │   │   ├── rateLimiter.ts   # Sliding-window rate limiter
│   │   │   └── translator.ts    # Google Translate integration
│   │   ├── index.ts             # Server entry point
│   │   └── types.ts             # Server-specific types
│   ├── package.json
│   └── tsconfig.json
│
├── shared/                     # Shared types between client & server
│   └── types.ts
│
├── .clinerules/                # AI assistant configuration
│   ├── cline-model-usage.json   # Model selection cheat sheet
│   └── model-policy.yaml        # Cost-aware model policy
│
├── render.yaml                 # Render deployment config
├── vercel.json                 # Root Vercel config
└── README.md
```

---

## Client Application

### Component Architecture

The client follows a **hooks-first** architecture. Each major capability is encapsulated in a custom hook, keeping components thin and focused on rendering.

#### Components

| Component | Responsibility |
|---|---|
| `CreateCall` | Landing page. User enters nickname + language, clicks "Create call-me link". Calls `POST /calls`, displays the shareable URL. |
| `JoinCall` | Link validation page. Extracts `:token` from URL, calls `GET /calls/:token` to check validity, prompts for name/language. |
| `VideoCall` | Main call interface. Orchestrates all hooks (WebRTC, WebSocket, media, blur, speech). Renders local/remote video, chat overlay, controls. |
| `VideoControls` | Toolbar with toggle buttons: microphone, camera, background blur, end call, expire link. |
| `ChatOverlay` | Floating panel showing speech-to-text transcriptions with automatic translations. |

#### Custom Hooks

| Hook | What It Does |
|---|---|
| `useWebRTC` | Creates and manages the `RTCPeerConnection`. Handles offer/answer exchange, ICE candidate gathering, and media stream attachment. Fetches ICE server config from `/turn-credentials`. |
| `useWebSocket` | Manages a single WebSocket connection to the server. Provides `connect`, `disconnect`, `send`, and `addMessageHandler`. Implements 25-second keepalive pings. |
| `useMediaDevices` | Requests camera/microphone permissions via `getUserMedia`. Provides stream and toggle functions. |
| `useBackgroundBlur` | Uses MediaPipe Selfie Segmentation to segment the person from the background, then composites a blurred background onto a `<canvas>`. Outputs a `MediaStream` from the canvas. Includes mobile-safe guards (checks `video.readyState` before processing). |
| `useSpeechRecognition` | Wraps the Web Speech API for continuous speech recognition. Feeds recognised text into the chat system. |
| `useScreenCaptureDetection` | Detects if the browser's screen capture API is active (e.g., someone is recording). Sends a warning to the peer via WebSocket. |

### Routing

```
/           → CreateCall (create a new call link)
/c/:token   → JoinCall → VideoCall (join an existing call)
```

Vercel is configured with SPA rewrites so all paths serve `index.html`, letting React Router handle navigation.

---

## Server Application

### HTTP API

| Endpoint | Method | Purpose | Rate Limit |
|---|---|---|---|
| `/calls` | POST | Create a new ephemeral room | 5/min/IP |
| `/calls/:token` | GET | Check link validity & room state | 10 invalid/min/IP |
| `/turn-credentials` | GET | Fetch TURN server credentials (keeps API key secret) | — |
| `/health` | GET | Health check with room stats | — |

### WebSocket Protocol

All signalling and chat goes through a single WebSocket connection. Messages are JSON with a `type` discriminator.

#### Client → Server Messages

| Type | Purpose |
|---|---|
| `join` | Join a room by token (includes userId, name, language) |
| `leave` | Leave the current room |
| `webrtc:offer` | Forward SDP offer to peer |
| `webrtc:answer` | Forward SDP answer to peer |
| `webrtc:iceCandidate` | Forward ICE candidate to peer |
| `chat:send` | Send a chat message (server translates, then broadcasts) |
| `endAndExpire` | Creator ends the call and expires the link |
| `recording:detected` | Notify server that screen recording was detected |
| `ping` | Keepalive ping (server responds with `pong`) |

#### Server → Client Messages

| Type | Purpose |
|---|---|
| `joined` | Confirmation of successful join (includes role, participants) |
| `peer:joined` | A peer has joined the room |
| `peer:left` | A peer has left the room |
| `webrtc:offer/answer/iceCandidate` | Forwarded signalling messages |
| `chat:message` | Translated chat message (broadcast to all in room) |
| `room:closed` | Room has been closed/expired |
| `recording:warning` | Peer detected screen recording |
| `error` | Error message |
| `pong` | Keepalive response |

### Services

#### RoomManager

The core state machine for room lifecycle:

```
                    ┌──────────┐
         create ──▶ │ pending  │ ◀── reset (permanent rooms)
                    └────┬─────┘
                         │ 2nd participant joins
                         ▼
                    ┌──────────┐
                    │  active  │
                    └────┬─────┘
                         │ participant leaves / creator expires
                         ▼
                    ┌──────────┐
                    │  closed  │ ──▶ cleaned up after 5 min
                    └──────────┘
```

- **Ephemeral rooms**: Created on demand, max 2 participants, auto-expire after 60 minutes if unused, cleaned up 5 minutes after closing.
- **Permanent rooms** (`test`, `eva`): Never expire, always reset to `pending` instead of closing. Stale participants are cleaned up on join using active WebSocket connection tracking.

#### TokenGenerator

- **Join tokens**: 128-bit cryptographically secure random bytes, base64url-encoded (22 characters). Unguessable.
- **Room IDs / User IDs**: RFC 4122 v4 UUIDs via `crypto.randomUUID()`.

#### RateLimiter

Sliding-window rate limiter, per IP address:
- `POST /calls`: Max 5 requests per minute
- Invalid token lookups: Max 10 per minute (prevents token scanning/enumeration)
- Background cleanup of expired entries every 60 seconds

#### Translator

Server-side translation using Google Translate's free `translate.googleapis.com` endpoint:
- No API key required
- Graceful degradation: returns original text on failure
- Same-language messages skip translation entirely

---

## Key Features & Implementation

### 1. Peer-to-Peer Video (WebRTC)

Media flows **directly between browsers** — the server is only used for signalling (exchanging SDP offers/answers and ICE candidates). This means:
- **Low latency**: No media server in the path
- **Privacy**: Audio/video never touches our servers
- **Cost**: No bandwidth costs for media relay

ICE server configuration:
- **STUN**: Google's free STUN servers for NAT traversal
- **TURN**: Metered.ca relay (provisioned, currently parked). Needed when both peers are behind symmetric NATs.

### 2. Real-Time Translation

The translation pipeline:
1. **Speech Recognition** (client): Web Speech API transcribes spoken words
2. **Chat Send** (client → server): Transcribed text sent via WebSocket
3. **Translation** (server): Google Translate API translates to peer's language
4. **Broadcast** (server → both clients): Both original and translated text delivered

### 3. Background Blur

Uses **MediaPipe Selfie Segmentation** running entirely in the browser:
1. Video frames are fed to the segmentation model
2. Model outputs a person/background mask
3. Background pixels are blurred using canvas operations
4. The canvas output is captured as a `MediaStream` and used as the WebRTC video source

Mobile-safe: checks `video.readyState >= 2` before processing to avoid errors on devices with slower video initialisation.

### 4. Screen Recording Detection

The `useScreenCaptureDetection` hook monitors for active screen capture. When detected:
1. Client sends `recording:detected` via WebSocket
2. Server forwards `recording:warning` to the peer
3. Peer sees a visual warning that recording may be in progress

### 5. Single-Use Expiring Links

- Each call link contains a cryptographically random token
- Links are single-use: once both participants have joined and left, the room closes
- Unused rooms auto-expire after 60 minutes
- The creator can manually expire the link via `endAndExpire`
- Closed rooms are cleaned from memory after 5 minutes

---

## Security Design

| Concern | Mitigation |
|---|---|
| **Token guessing** | 128-bit crypto-random tokens (2¹²⁸ possible values) |
| **Token scanning** | Rate limiting on invalid token lookups (10/min/IP) |
| **Room creation spam** | Rate limiting on POST /calls (5/min/IP) |
| **CORS** | Whitelist-based: specific client URL, parlez.me, *.vercel.app, localhost |
| **XSS** | React auto-escapes all rendered content; no `dangerouslySetInnerHTML` |
| **Input validation** | Server validates nickname (required, max 30 chars) and language (required) |
| **TURN API key exposure** | Key stays server-side; client fetches credentials via `/turn-credentials` |
| **Media privacy** | Peer-to-peer WebRTC — audio/video never passes through our servers |
| **Data persistence** | None — all rooms are in-memory only, lost on server restart |
| **Proxy trust** | `trust proxy` set to 1 (single reverse proxy on Render) |
| **Graceful shutdown** | SIGTERM/SIGINT handlers cleanly close WebSocket and HTTP servers |

---

## Deployment Architecture

```
┌──────────────┐     HTTPS      ┌──────────────┐
│   Browser    │ ◀────────────▶ │   Vercel     │  (Static SPA)
│              │                │   CDN        │
│              │     WSS        ├──────────────┤
│              │ ◀────────────▶ │   Render     │  (Node.js server)
│              │                │              │
│              │   P2P (SRTP)   │              │
│              │ ◀──────────────────────────▶  │  (Direct peer connection)
└──────────────┘                └──────────────┘
```

- **Client**: Deployed to **Vercel** as a static SPA. Automatic deploys on push to `main`. Global CDN. Custom domain: `parlez.me`.
- **Server**: Deployed to **Render** as a Node.js web service. Automatic deploys on push to `main`. WebSocket support included. HTTPS/WSS termination at the reverse proxy.
- **DNS**: `parlez.me` points to Vercel. The client connects to the Render server URL for API and WebSocket.

### Environment Variables

**Server** (`.env`):
| Variable | Purpose |
|---|---|
| `PORT` | HTTP port (default: 3001, Render uses 10000) |
| `CLIENT_URL` | Allowed CORS origin |
| `NODE_ENV` | development / production |
| `METERED_API_KEY` | TURN server API key (optional) |
| `METERED_APP_NAME` | TURN server app name (optional) |

**Client** (`.env`):
| Variable | Purpose |
|---|---|
| `VITE_API_URL` | Server HTTP URL |
| `VITE_WS_URL` | Server WebSocket URL |

---

## Design Decisions & Trade-offs

### Why WebRTC (no media server)?

**Decision**: Direct peer-to-peer media, no SFU/MCU.

**Pros**: Zero media server cost, lowest possible latency, maximum privacy.
**Cons**: Limited to 1-to-1 calls (no group calls without an SFU), TURN relay needed for some network configurations.
**Trade-off accepted**: This is a 1-to-1 app by design.

### Why `ws` instead of Socket.IO?

**Decision**: Raw WebSocket library instead of Socket.IO.

**Pros**: Smaller bundle, no unnecessary abstraction, full control over the protocol, no polling fallback overhead.
**Cons**: No built-in reconnection, rooms, or acknowledgements.
**Trade-off accepted**: We implement only what we need. The protocol is simple enough that Socket.IO's features would be unused overhead.

### Why in-memory room storage?

**Decision**: No database. Rooms live in a `Map` in server memory.

**Pros**: Zero infrastructure cost, zero latency for lookups, simplest possible implementation.
**Cons**: Rooms lost on server restart, doesn't scale horizontally.
**Trade-off accepted**: Calls are ephemeral by design. A server restart simply means active calls end — acceptable for an MVP.

### Why Google Translate's free endpoint?

**Decision**: Use the unofficial `translate.googleapis.com` endpoint instead of the paid Cloud Translation API.

**Pros**: No API key, no billing, no quota management.
**Cons**: No SLA, could be rate-limited or blocked by Google at any time.
**Trade-off accepted**: For an MVP, this is pragmatic. Easy to swap for the official API later.

### Why MediaPipe for background blur?

**Decision**: Client-side ML model instead of server-side processing.

**Pros**: No server cost, works offline, no video data leaves the browser.
**Cons**: CPU-intensive on mobile devices, requires WASM/WebGL support.
**Trade-off accepted**: Added `readyState` guards and graceful degradation for mobile.

### Why split hosting (Vercel + Render)?

**Decision**: Static client on Vercel, dynamic server on Render.

**Pros**: Both have generous free tiers, automatic deploys, and are optimised for their respective workloads. Vercel's CDN is excellent for static assets.
**Cons**: Two services to manage, CORS configuration needed.
**Trade-off accepted**: The cost savings and performance benefits outweigh the minor operational complexity.

---

## Future Considerations

1. **WebSocket hardening**: Add per-connection message rate limiting, origin validation, and `maxPayload` limits.
2. **Security headers**: Add `helmet` middleware for X-Frame-Options, CSP, etc.
3. **TURN server**: Re-enable Metered.ca TURN for users behind symmetric NATs.
4. **Reconnection**: Add exponential backoff WebSocket reconnection on the client.
5. **End-to-end encryption**: Currently media is encrypted by WebRTC (SRTP), but signalling messages are plaintext on the server. E2EE for chat would add privacy.
6. **Horizontal scaling**: If needed, move room state to Redis and use pub/sub for cross-instance WebSocket messaging.
7. **Paid translation API**: Swap to Google Cloud Translation or DeepL for reliability and SLA.
8. **Group calls**: Would require an SFU (Selective Forwarding Unit) like mediasoup or Janus.

---

*Last updated: March 2026*
