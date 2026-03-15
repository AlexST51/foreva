# Foreva – Ephemeral 1:1 Video Calls with Dual-Language Chat

A minimal, production-ready starter for a web-based 1:1 video call app with overlaid dual-language chat and translation, using one-time shareable call links and built-in security mitigations.

## ✨ Features

- **No accounts, no sign-up** – Just create a link and share it
- **One-time call links** – Each link works once, then expires permanently
- **WebRTC video calls** – Peer-to-peer audio/video in the browser
- **Dual-language chat** – Each user picks their language; messages show both original and translated text
- **Ephemeral rooms** – No data persisted beyond active sessions
- **Built-in security** – High-entropy tokens, rate limiting, single-use rooms, device privacy

## 🏗️ Architecture

```
foreva/
├── client/          # React + TypeScript + Vite
│   └── src/
│       ├── components/   # CreateCall, JoinCall, VideoCall, ChatOverlay, VideoControls
│       ├── hooks/        # useWebSocket, useWebRTC, useMediaDevices
│       ├── types/        # Client-side TypeScript types
│       └── utils/        # API helpers
│
├── server/          # Node.js + TypeScript + Express + ws
│   └── src/
│       ├── handlers/     # HTTP API + WebSocket message handlers
│       └── services/     # Room manager, token generator, rate limiter, translator
│
└── shared/          # Shared TypeScript types
```

## 🚀 Quick Start

### Prerequisites

- **Node.js** 18+ (recommended: 20+)
- **npm** 9+

### Install

```bash
# Install root dependencies (concurrently)
npm install

# Install client and server dependencies
npm run install:all
```

### Development

```bash
# Start both client and server in development mode
npm run dev
```

This runs:
- **Client** at `http://localhost:5173` (Vite dev server with HMR)
- **Server** at `http://localhost:3001` (Express + WebSocket with auto-reload)

### Production Build

```bash
npm run build
```

## 🔧 Environment Variables

### Server (`server/.env`)

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3001` | Server port |
| `CLIENT_URL` | `http://localhost:5173` | Client origin (for CORS and call URLs) |
| `NODE_ENV` | `development` | Environment mode |
| `TRANSLATION_API_KEY` | – | Future: API key for translation service |

### Client (`client/.env`)

| Variable | Default | Description |
|---|---|---|
| `VITE_API_URL` | `""` (uses Vite proxy) | Backend API URL |
| `VITE_WS_URL` | `ws://localhost:3001` | WebSocket URL |

## 📞 User Flows

### Creator Flow
1. Open `http://localhost:5173`
2. Enter nickname and select language
3. Click **"Create call-me link"**
4. Share the generated link via any messenger
5. Wait for the other person to join (local video preview shown)

### Receiver Flow
1. Click the shared link (e.g., `http://localhost:5173/c/AB4KQ2fX9mPzLkNq`)
2. Enter nickname and select language
3. Click **"Join call"**
4. Video call starts with dual-language chat

### Ending a Call
- Either user can click **"End call"**
- Creator can click **"End & expire"** to immediately invalidate the link
- When both users disconnect, the room closes automatically
- Any future visit to the same link shows "This call link has expired"

## 🔒 Security Features

### High-Entropy Tokens
- Join tokens use `crypto.randomBytes(16)` → base64url (128 bits of entropy, 22 characters)
- Not sequential, not guessable

### Single-Use, 1:1 Rooms
- Each token maps to exactly one room
- Max 2 participants per room
- Access rules enforced server-side

### Room State Machine
```
pending → active → closed
   ↓                  ↑
   └──── (timeout) ───┘
```
- **pending**: Creator waiting for receiver (auto-expires after 60 minutes)
- **active**: Both connected
- **closed**: Both left or creator expired the link (permanent)

### Rate Limiting
- `POST /calls`: Max 5 per IP per minute
- `GET /calls/:token` (invalid): Max 10 different invalid tokens per IP per minute
- In-memory, easy to replace with Redis

### Transport Security
- Code is transport-agnostic (works with both HTTP/WS and HTTPS/WSS)
- In production, HTTPS/WSS termination should be handled by a reverse proxy (nginx, Cloudflare, etc.)

### Privacy
- Camera/mic only requested when user initiates a call
- No chat messages or media persisted beyond active rooms
- No content logging (only errors and aggregated stats)
- "End call" stops all local media tracks

## 💬 Dual-Language Chat

### How It Works
1. Each user selects their language when creating/joining
2. When a message is sent, the server translates it to the other user's language
3. Both original and translated text are sent to both users
4. Each user sees their language as the primary (bold) text, with the other language shown below (smaller, gray)

### Translation Stub
The translation function is a stub that returns `[sourceLang→targetLang] text`. To integrate a real translation API:

1. Open `server/src/services/translator.ts`
2. Install your preferred SDK (e.g., `npm install @google-cloud/translate` or `npm install deepl-node`)
3. Set `TRANSLATION_API_KEY` in your environment
4. Replace the stub body with the real API call

## 🚢 Deployment

### Architecture
- **Client** → Vercel (static site, free tier)
- **Server** → Render (web service with WebSocket support, free tier)
- **STUN** → Google public STUN servers (free, no setup needed)
- **Video/Audio** → Peer-to-peer via WebRTC (no server bandwidth cost)

### Step 1: Push to GitHub

```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/YOUR_USERNAME/foreva.git
git push -u origin main
```

### Step 2: Deploy the Server on Render

1. Go to [render.com](https://render.com) and sign up (free)
2. Click **"New +"** → **"Blueprint"**
3. Connect your GitHub repo — Render will auto-detect the `render.yaml` file
4. Set the `CLIENT_URL` environment variable to your Vercel URL (you'll get this in Step 3)
   - Example: `https://foreva.vercel.app`
5. Click **"Apply"** — the server will build and deploy
6. Note your Render URL (e.g., `https://foreva-server.onrender.com`)

> **Note:** Render free tier services spin down after 15 minutes of inactivity. The first request after idle takes ~30 seconds to cold-start. This is fine for an MVP.

### Step 3: Deploy the Client on Vercel

1. Go to [vercel.com](https://vercel.com) and log in
2. Click **"Add New Project"** → Import your GitHub repo
3. Set the **Root Directory** to `client`
4. Add environment variables:
   - `VITE_API_URL` = `https://foreva-server.onrender.com` (your Render URL from Step 2)
   - `VITE_WS_URL` = `wss://foreva-server.onrender.com` (same host, `wss://` protocol)
5. Click **"Deploy"**
6. Note your Vercel URL (e.g., `https://foreva.vercel.app`)

### Step 4: Update Render with the Client URL

1. Go back to your Render dashboard
2. Open the `foreva-server` service → **Environment**
3. Set `CLIENT_URL` to your Vercel URL (e.g., `https://foreva.vercel.app`)
4. Save — the server will redeploy automatically

### Deployment Checklist

| Setting | Value |
|---|---|
| **Vercel** `VITE_API_URL` | `https://foreva-server.onrender.com` |
| **Vercel** `VITE_WS_URL` | `wss://foreva-server.onrender.com` |
| **Render** `CLIENT_URL` | `https://foreva.vercel.app` |
| **Render** `NODE_ENV` | `production` |

### Cost

| Service | Tier | Cost |
|---|---|---|
| Vercel (client) | Hobby | **$0/month** |
| Render (server) | Free | **$0/month** |
| Google STUN | Public | **$0** |
| WebRTC media | Peer-to-peer | **$0** |

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 19, TypeScript, Vite |
| Backend | Node.js, TypeScript, Express, ws |
| Video | WebRTC (getUserMedia + RTCPeerConnection) |
| Signalling | WebSocket (single endpoint) |
| STUN | Google public STUN servers |
| Styling | Plain CSS (responsive, dark theme) |

## 📋 API Reference

### `POST /calls`
Create a new call-me link.

**Body:** `{ nickname: string, language: string }`

**Response:** `{ roomId, joinToken, callUrl, userId }`

### `GET /calls/:token`
Check call link status.

**Response:** `{ state, creatorName?, creatorLanguage? }`

**Error codes:** `404` (not found), `410` (expired), `409` (full), `429` (rate limited)

### `GET /health`
Health check with aggregated stats.

### WebSocket Messages
Single WebSocket endpoint at `ws://host:port`. Message types:
- `join`, `leave`, `endAndExpire`
- `webrtc:offer`, `webrtc:answer`, `webrtc:iceCandidate`
- `chat:send` → `chat:message`

## 🔮 Future Improvements

- [ ] TURN server support for restrictive NATs
- [ ] Real translation API integration (Google Translate, DeepL)
- [ ] Accept/reject join flow (creator approves receiver)
- [ ] Screen sharing
- [ ] Text-to-speech for translated messages
- [ ] Redis-backed rate limiting and room store
- [ ] End-to-end encryption for chat messages
- [ ] Mobile app (React Native)

## 🤖 AI Assistant / Cline Model Policy

This project uses **Cline** in VS Code with a cost‑controlled, bring‑your‑own‑key setup.

### Default behaviour

- Use **Gemini 3.1 Flash Lite Preview** as the main default:
  - Q&A and explanations about code
  - Small edits and single‑file tweaks
  - Documentation, migration notes, and simple text transforms
- Prefer **free models** for trivial work:
  - **KAT‑Coder‑Pro V1 (free)** for boilerplate, simple refactors, and low‑risk bugfixes
  - **Trinity‑Large‑Preview (free)** for general chat, docs, and experimentation

### When to use stronger models

- Use **Sonnet 4.6** (Anthropic) for:
  - Initial build of new services or major multi‑file features
  - Architecture and system design
  - Large multi‑file refactors and complex debugging over time
- Use **GPT‑5.3‑Codex** (OpenAI) for:
  - Serious coding sessions on medium‑to‑large features
  - Cross‑file refactors and CI/CD or infra changes
  - Long‑context code analysis where cost still matters
- Use **GPT‑5.4** or **Gemini 3.1 Pro** when:
  - You need frontier‑level general reasoning, huge context, or multimodal analysis (code + docs + images)

### Opus 4.6 usage

- **Opus 4.6 is not a default model.** It is reserved for:
  - Only the most complex, long‑running, high‑risk workflows
  - Mission‑critical refactors or migrations where failure is very costly
- Cline should **never** switch to Opus 4.6 automatically.
  - It must first propose a plan, explain why Opus is worth the extra cost, and wait for explicit approval.

### Cost and safety guidelines

- Cost tiers (per 1M tokens, approximate):
  - Free: KAT‑Coder‑Pro, Trinity‑Large‑Preview
  - Very cheap: Gemini 3.1 Flash Lite
  - Mid‑tier: GPT‑5.3‑Codex, Gemini 3.1 Pro
  - Premium: Sonnet 4.6, GPT‑5.4
  - Extreme premium: Opus 4.6
- Default rule:
  - Start with **free or Flash Lite** for low/medium‑impact work.
  - Escalate to Codex / Sonnet / GPT‑5.4 / Gemini Pro only when cheaper models struggle or the task is clearly high‑impact.
- For multi‑file edits, CI/CD, or mass changes:
  - Cline should show a plan first
  - Changes should only proceed after explicit confirmation

### Configuration files

- **`.clinerules/model-policy.yaml`** – Machine‑readable policy with tiers, rules, and safety/audit settings
- **`.clinerules/cline-model-usage.json`** – Detailed cheat sheet mapping task categories to recommended models with fallbacks and cost tiers

## 📄 License

MIT
