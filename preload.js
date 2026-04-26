// ═══════════════════════════════════════════════════════════
//  ADYX Desktop — Preload Script
//  Exposes a minimal, secure API to the renderer process.
//  No Node.js APIs are leaked — only safe bridge methods.
// ═══════════════════════════════════════════════════════════

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('adyxDesktop', {
    // ── App Info ──
    platform: process.platform,
    isDesktop: true,
    getVersion: () => ipcRenderer.invoke('get-app-version'),
    getLogPath: () => ipcRenderer.invoke('get-log-path'),
    getRelayUrl: () => ipcRenderer.invoke('get-relay-url'),

    // ── Window Controls ──
    minimize: () => ipcRenderer.send('window-minimize'),
    maximize: () => ipcRenderer.send('window-maximize'),
    close: () => ipcRenderer.send('window-close'),
    retry: () => ipcRenderer.send('retry-load'),

    // ── Backend ──
    getBackendPort: () => ipcRenderer.invoke('get-backend-port'),

    // ── Auto-Update ──
    checkForUpdates: () => ipcRenderer.send('check-for-updates'),

    // ── Chat History (Encrypted Local Storage) ──
    saveMessage: (roomCode, message) => ipcRenderer.invoke('save-chat-message', roomCode, message),
    getHistory: (roomCode) => ipcRenderer.invoke('get-chat-history', roomCode),
    clearHistory: (roomCode) => ipcRenderer.invoke('clear-chat-history', roomCode),
    clearAllHistory: () => ipcRenderer.invoke('clear-all-history'),
    listHistory: () => ipcRenderer.invoke('list-chat-history'),

    // ── LAN Mode (Mobile Access) ──
    toggleLanMode: () => ipcRenderer.invoke('toggle-lan-mode'),
    getLanStatus: () => ipcRenderer.invoke('get-lan-status'),

    // ── QR Code & Sharing ──
    generateRoomQR: (roomCode) => ipcRenderer.invoke('generate-room-qr', roomCode),
    generateQR: (text) => ipcRenderer.invoke('generate-qr', text),

    // ── Deep Link Listener ──
    onDeepLinkJoin: (callback) => {
        ipcRenderer.on('deep-link-join', (event, roomCode) => callback(roomCode));
    },

    // ── World Chat Events (from main process) ──
    onInviteReceived: (callback) => {
        ipcRenderer.on('invite-received', (event, data) => callback(data));
    },
});
