# ADYX — Anonymous Encrypted Communication Platform

> No login. No trace. Just talk.

ADYX is an anonymous, end-to-end encrypted communication desktop app built with Electron. Zero accounts, zero data stored on servers. Everything is ephemeral — when the session ends, all data is destroyed.

## Features

- **🔒 End-to-End Encrypted** — Pairwise key exchange, all messages encrypted client-side
- **👤 Anonymous** — No login, no accounts, no phone number, no email
- **👥 Group Chat** — Up to 10 members per room
- **🌍 World Chat** — Global lobby to meet people, then go private
- **🔑 Passphrase Join** — Both users type the same secret phrase → same room (no code sharing needed)
- **📱 LAN Mode** — Access from your phone via Wi-Fi
- **📎 Encrypted File Transfer** — Share files with E2E encryption
- **💾 Encrypted Local History** — Opt-in AES-256-GCM encrypted chat storage
- **🔗 QR Code Sharing** — Generate QR codes for room links
- **🔄 Auto-Updates** — GitHub Releases based update checker
- **🛡️ Crash Reporting** — Persistent file logging with rotation

## Architecture

```
Electron Main Process
├── Embedded WebSocket Backend (backend.js)
├── React Frontend (app/) — pre-built Vite bundle
├── Preload Bridge (preload.js) — secure IPC
├── Logger (logger.js) — file logging with 5MB rotation
├── Updater (updater.js) — GitHub auto-update checker
├── History (history.js) — AES-256-GCM encrypted local storage
├── Sharing (sharing.js) — QR code generator + link builder
├── Config (config.js) — centralized configuration
└── Server (server.js) — standalone relay server for cloud deployment
```

## Quick Start

```bash
# Install dependencies
npm install

# Run desktop app
npm start

# Run standalone relay server
npm run server
```

## Deploy Relay Server

Deploy `server.js` on any Node.js host (Railway, Render, Heroku):

```bash
# Set port via environment
PORT=4567 node server.js
```

All ADYX desktop apps connect to the shared relay server for World Chat and cross-network communication.

## Build & Distribute

```bash
npm run build       # Build frontend + package + create installer
npm run package     # Package Electron app only
npm run installer   # Create NSIS installer only
```

## How It Works

1. **World Chat** — Open ADYX → you're in the global lobby → meet people
2. **Passphrase** — Tell your friend "type *coffee shop tuesday*" → both land in the same private room
3. **Room Code** — Create a room → share the 6-character code → friend joins
4. **Invite** — Click a user in World Chat → invite to private E2E encrypted room

## Security

- Context isolation + no Node.js in renderer
- Strict Content Security Policy
- Input validation on all WebSocket messages
- Rate limiting (rooms, messages, world chat)
- Room membership enforced on every operation
- AES-256-GCM encrypted local chat history
- 30-second reconnection grace period
- 50MB global file store memory cap

## Tech Stack

- **Electron 33** — Desktop runtime
- **WebSocket (ws)** — Real-time communication
- **Node.js crypto** — AES-256-GCM, SHA-256, scrypt
- **React + Vite** — Frontend (pre-built bundle)
- **NSIS** — Windows installer

## License

Proprietary — See [LICENSE.txt](LICENSE.txt)
