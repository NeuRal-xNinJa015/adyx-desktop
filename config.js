// ═══════════════════════════════════════════════════════════
//  ADYX — Centralized Configuration
//  Single source of truth for all app settings.
//  Works in both Electron (embedded) and standalone (cloud) mode.
// ═══════════════════════════════════════════════════════════

const config = {
    // ── App Identity ──
    APP_NAME: 'ADYX',
    APP_VERSION: '1.0.0',

    // ── Public Relay Server ──
    // Change this to your deployed server URL when you host it
    // Example: 'wss://adyx-relay.onrender.com' or 'wss://adyx.yourdomain.com'
    RELAY_URL: process.env.ADYX_RELAY_URL || 'ws://127.0.0.1:4567',

    // ── Server Settings ──
    STANDALONE_PORT: parseInt(process.env.PORT) || 4567,
    HEARTBEAT_INTERVAL: 30000,          // 30s ping/pong
    ROOM_TTL: 10 * 60 * 1000,           // 10 min idle room expiry
    MAX_ROOM_SIZE: 10,                   // max members per room
    MAX_PAYLOAD_SIZE: 256 * 1024,        // 256KB max message payload
    MAX_DEVICE_ID_LEN: 32,
    MAX_NICKNAME_LEN: 20,

    // ── Rate Limiting ──
    RATE_LIMIT_ROOMS: 5,                 // rooms per minute
    RATE_LIMIT_MESSAGES: 60,             // private messages per minute
    RATE_LIMIT_WORLD: 20,               // world chat messages per minute

    // ── File Transfer ──
    FILE_EXPIRY_MS: 10 * 60 * 1000,      // 10 min
    MAX_FILE_STORE_BYTES: 50 * 1024 * 1024, // 50MB global cap

    // ── Reconnection ──
    RECONNECT_GRACE_MS: 30000,           // 30s grace period

    // ── World Chat ──
    WORLD_ROOM_CODE: '__world__',        // special room code for world chat
    MAX_WORLD_HISTORY: 50,               // keep last 50 world messages in memory
};

module.exports = config;
