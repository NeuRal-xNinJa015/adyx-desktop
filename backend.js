const { WebSocketServer } = require('ws');
const { randomBytes, createHash } = require('crypto');
const { createServer } = require('http');
const logger = require('./logger');

let wss = null;
let httpServer = null;

// ── Configuration ──
const HEARTBEAT_INTERVAL = 30000;       // 30s ping/pong
const ROOM_TTL = 10 * 60 * 1000;        // 10 min idle TTL
const RATE_LIMIT_ROOMS = 5;             // max rooms per minute
const RATE_LIMIT_MESSAGES = 60;         // max messages per minute
const MAX_ROOM_SIZE = 10;               // max members per room
const MAX_PAYLOAD_SIZE = 256 * 1024;    // 256KB max message payload
const MAX_DEVICE_ID_LEN = 32;
const FILE_EXPIRY_MS = 10 * 60 * 1000;  // 10 min file expiry
const MAX_FILE_STORE_BYTES = 50 * 1024 * 1024; // 50MB global file store cap
const RECONNECT_GRACE_MS = 30000;       // 30s grace period for reconnection
const MAX_NICKNAME_LEN = 20;
const RATE_LIMIT_WORLD = 20;            // world messages per minute
const WORLD_ROOM = '__world__';         // special world chat room code
const MAX_WORLD_HISTORY = 50;           // keep last N world messages in memory
const VALID_TYPES = new Set(['auth', 'create_room', 'join_room', 'join_by_passphrase', 'key_exchange', 'message', 'typing', 'end_session', 'file_upload', 'file_chunk', 'file_download', 'file_delete', 'world_message', 'set_nickname', 'invite', 'get_online_users', 'get_world_history']);

// ── State ──
const connections = new Map();   // deviceId → { ws, alive, roomRateWindow, msgRateWindow }
const wsToConn = new WeakMap();  // ws → connInfo (O(1) lookup for heartbeat)
const rooms = new Map();         // roomCode → { creator, members, lastActivity }
const fileStore = new Map();     // fileId → { chunks[], totalChunks... }
let fileStoreBytes = 0;          // Track total file store memory usage
const disconnectedDevices = new Map(); // deviceId → { timeout, rooms[] } for reconnect grace
const nicknames = new Map();     // deviceId → nickname string
const worldHistory = [];         // last N world chat messages

let heartbeatInterval = null;
let cleanupInterval = null;

function generateRoomCode() {
    let code;
    let attempts = 0;
    do {
        code = randomBytes(3).toString('hex');
        attempts++;
        // Safety: avoid infinite loop if rooms map is huge
        if (attempts > 100) break;
    } while (rooms.has(code));
    return code;
}

function log(tag, ...args) {
    logger.info(tag, ...args);
}

function isValidDeviceId(id) {
    return typeof id === 'string' && id.length > 0 && id.length <= MAX_DEVICE_ID_LEN && /^[a-zA-Z0-9_-]+$/.test(id);
}

function isValidRoomCode(code) {
    return typeof code === 'string' && /^[a-f0-9]{6}$/.test(code);
}

function isValidFileId(id) {
    return typeof id === 'string' && id.length > 0 && id.length <= 64 && /^[a-zA-Z0-9_-]+$/.test(id);
}

function isValidNickname(name) {
    return typeof name === 'string' && name.length >= 1 && name.length <= MAX_NICKNAME_LEN && /^[a-zA-Z0-9_\- ]+$/.test(name);
}

function getDisplayName(deviceId) {
    return nicknames.get(deviceId) || `anon_${deviceId.slice(0, 6)}`;
}

function safeSend(ws, data) {
    try {
        if (ws.readyState === 1) {
            ws.send(typeof data === 'string' ? data : JSON.stringify(data));
            return true;
        }
    } catch (err) {
        log('SEND_ERR', err.message);
    }
    return false;
}

function sendError(ws, error) {
    safeSend(ws, { type: 'error', error });
}

function checkRate(connInfo, type) {
    const now = Date.now();
    const window = type === 'room' ? connInfo.roomRateWindow : connInfo.msgRateWindow;
    const limit = type === 'room' ? RATE_LIMIT_ROOMS : RATE_LIMIT_MESSAGES;

    while (window.length > 0 && window[0] < now - 60000) {
        window.shift();
    }

    if (window.length >= limit) return false;
    window.push(now);
    return true;
}

/**
 * Check if a device is a member of a room
 */
function isMemberOfRoom(room, deviceId) {
    return room.members.some(m => m.deviceId === deviceId);
}

/**
 * Estimate the byte size of a chunk for memory tracking
 */
function estimateChunkSize(data) {
    if (typeof data === 'string') return data.length * 2; // rough UTF-16 estimate
    if (Buffer.isBuffer(data)) return data.length;
    return JSON.stringify(data).length;
}

/**
 * Starts the ADYX WebSocket Relay Server
 * @param {number} [fixedPort] — If provided, bind to 0.0.0.0:fixedPort (standalone). If omitted, use OS-assigned port on 127.0.0.1 (embedded).
 * @returns {Promise<number>} Resolves with the port the server is listening on
 */
function startEmbeddedServer(fixedPort) {
    return new Promise((resolve, reject) => {
        const CORS_HEADERS = {
            'Access-Control-Allow-Origin': fixedPort ? '*' : 'http://127.0.0.1',
            'Access-Control-Allow-Methods': 'GET, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
        };

        httpServer = createServer((req, res) => {
            if (req.method === 'OPTIONS') {
                res.writeHead(204, CORS_HEADERS);
                res.end();
                return;
            }
            if (req.url === '/health' && req.method === 'GET') {
                res.writeHead(200, { 'Content-Type': 'application/json', ...CORS_HEADERS });
                res.end(JSON.stringify({ status: 'ok', connections: connections.size, rooms: rooms.size, onlineUsers: connections.size, worldMessages: worldHistory.length }));
            } else {
                res.writeHead(404, CORS_HEADERS);
                res.end();
            }
        });

        wss = new WebSocketServer({ server: httpServer });

        // Heartbeat — uses WeakMap for O(1) lookup instead of O(n) find()
        heartbeatInterval = setInterval(() => {
            wss.clients.forEach(ws => {
                const info = wsToConn.get(ws);
                if (info && !info.alive) {
                    log('HEARTBEAT', `Terminating stale connection: ${info.deviceId || 'unknown'}`);
                    ws.terminate();
                    return;
                }
                if (info) info.alive = false;
                ws.ping();
            });
        }, HEARTBEAT_INTERVAL);

        // Cleanup expired rooms and files
        cleanupInterval = setInterval(() => {
            const now = Date.now();
            for (const [roomCode, room] of rooms.entries()) {
                if (now - room.lastActivity > ROOM_TTL) {
                    log('CLEANUP', `Room ${roomCode} expired`);
                    room.members.forEach(m => {
                        safeSend(m.ws, { type: 'session_ended', roomCode, reason: 'Room expired due to inactivity' });
                    });
                    rooms.delete(roomCode);
                    // Clean up files belonging to this room
                    for (const [fileId, file] of fileStore.entries()) {
                        if (file.roomCode === roomCode) {
                            fileStoreBytes -= file.bytesUsed || 0;
                            fileStore.delete(fileId);
                        }
                    }
                }
            }
            for (const [fileId, file] of fileStore.entries()) {
                if (file.expiry && now > file.expiry) {
                    fileStoreBytes -= file.bytesUsed || 0;
                    fileStore.delete(fileId);
                }
            }
            // Safety clamp
            if (fileStoreBytes < 0) fileStoreBytes = 0;
        }, 60000);

        // WS Connection Handler
        wss.on('connection', (ws) => {
            let deviceId = null;
            let authenticated = false;
            let connInfo = null;

            log('WS', 'New connection');

            ws.on('pong', () => {
                if (connInfo) connInfo.alive = true;
            });

            ws.on('message', (raw) => {
                if (raw.length > MAX_PAYLOAD_SIZE) {
                    sendError(ws, 'Message too large');
                    return;
                }

                let msg;
                try {
                    msg = JSON.parse(raw.toString());
                } catch (e) {
                    sendError(ws, 'Invalid JSON');
                    return;
                }

                if (!msg.type || !VALID_TYPES.has(msg.type)) {
                    sendError(ws, 'Unknown message type');
                    return;
                }

                // ── AUTH ──
                if (msg.type === 'auth') {
                    if (!isValidDeviceId(msg.deviceId)) {
                        sendError(ws, 'Invalid device ID');
                        return;
                    }
                    deviceId = msg.deviceId;
                    authenticated = true;
                    connInfo = { ws, deviceId, alive: true, roomRateWindow: [], msgRateWindow: [] };
                    connections.set(deviceId, connInfo);
                    wsToConn.set(ws, connInfo); // O(1) heartbeat lookup

                    // ── Reconnection: restore room membership if within grace period ──
                    const pendingDisconnect = disconnectedDevices.get(deviceId);
                    if (pendingDisconnect) {
                        clearTimeout(pendingDisconnect.timeout);
                        disconnectedDevices.delete(deviceId);
                        // Update WS reference in all rooms this device was in
                        for (const roomCode of pendingDisconnect.rooms) {
                            const room = rooms.get(roomCode);
                            if (room) {
                                const member = room.members.find(m => m.deviceId === deviceId);
                                if (member) {
                                    member.ws = ws; // Update to new WebSocket
                                    log('RECONNECT', `${deviceId} reconnected to room ${roomCode}`);
                                    // Notify peer that this device is back
                                    room.members.forEach(m => {
                                        if (m.deviceId !== deviceId) {
                                            safeSend(m.ws, { type: 'peer_reconnected', deviceId, roomCode });
                                        }
                                    });
                                }
                            }
                        }
                        log('AUTH', `Device re-authenticated (reconnected): ${deviceId}`);
                        safeSend(ws, { type: 'auth_ok', deviceId, status: 'reconnected' });
                    } else {
                        log('AUTH', `Device authenticated: ${deviceId}`);
                        safeSend(ws, { type: 'auth_ok', deviceId, status: 'authenticated' });
                    }

                    // ── Auto-join World Chat ──
                    // Send online users list to new user
                    const onlineUsers = [];
                    connections.forEach((conn) => {
                        onlineUsers.push({ deviceId: conn.deviceId, nickname: getDisplayName(conn.deviceId) });
                    });
                    safeSend(ws, { type: 'online_users', users: onlineUsers, count: onlineUsers.length });

                    // Send world chat history
                    if (worldHistory.length > 0) {
                        safeSend(ws, { type: 'world_history', messages: worldHistory });
                    }

                    // Notify everyone that a new user joined
                    connections.forEach((conn) => {
                        if (conn.deviceId !== deviceId) {
                            safeSend(conn.ws, { type: 'user_joined_world', deviceId, nickname: getDisplayName(deviceId) });
                        }
                    });
                    return;
                }

                if (!authenticated) {
                    sendError(ws, 'Not authenticated. Send auth message first.');
                    return;
                }

                // ── CREATE ROOM ──
                if (msg.type === 'create_room') {
                    if (!checkRate(connInfo, 'room')) {
                        sendError(ws, 'Rate limit: too many rooms created. Wait a moment.');
                        return;
                    }
                    const roomCode = generateRoomCode();
                    const maxMembers = Math.min(Math.max(parseInt(msg.maxMembers) || MAX_ROOM_SIZE, 2), MAX_ROOM_SIZE);
                    rooms.set(roomCode, { creator: deviceId, members: [{ deviceId, ws }], lastActivity: Date.now(), maxMembers });
                    log('ROOM', `Room ${roomCode} created by ${deviceId} (max: ${maxMembers})`);
                    safeSend(ws, { type: 'room_created', roomCode, maxMembers });
                    return;
                }

                // ── JOIN ROOM ──
                if (msg.type === 'join_room') {
                    const roomCode = msg.roomCode;
                    if (!isValidRoomCode(roomCode)) {
                        sendError(ws, 'Invalid room code format');
                        return;
                    }
                    const room = rooms.get(roomCode);
                    if (!room) {
                        sendError(ws, 'Room not found');
                        return;
                    }
                    if (isMemberOfRoom(room, deviceId)) {
                        sendError(ws, 'Already in this room');
                        return;
                    }
                    if (room.members.length >= (room.maxMembers || MAX_ROOM_SIZE)) {
                        sendError(ws, `Room is full (max ${room.maxMembers || MAX_ROOM_SIZE} members)`);
                        return;
                    }

                    room.members.push({ deviceId, ws });
                    room.lastActivity = Date.now();
                    log('ROOM', `${deviceId} joined room ${roomCode}`);

                    safeSend(ws, { type: 'room_joined', roomCode, memberCount: room.members.length, maxMembers: room.maxMembers || MAX_ROOM_SIZE });

                    room.members.forEach(member => {
                        if (member.deviceId !== deviceId) {
                            safeSend(member.ws, { type: 'peer_joined', deviceId, roomCode, memberCount: room.members.length });
                            safeSend(ws, { type: 'peer_joined', deviceId: member.deviceId, roomCode, memberCount: room.members.length });
                        }
                    });
                    return;
                }

                // ── JOIN BY PASSPHRASE ──
                // Both users type the same phrase → both land in the same room
                if (msg.type === 'join_by_passphrase') {
                    if (!checkRate(connInfo, 'room')) {
                        sendError(ws, 'Rate limit: too many attempts. Wait a moment.');
                        return;
                    }

                    const passphrase = msg.passphrase;
                    if (!passphrase || typeof passphrase !== 'string' || passphrase.trim().length < 3 || passphrase.length > 100) {
                        sendError(ws, 'Passphrase must be 3-100 characters');
                        return;
                    }

                    // Derive room code from passphrase: SHA-256 → first 6 hex chars
                    const hash = createHash('sha256').update(passphrase.trim().toLowerCase()).digest('hex');
                    const roomCode = hash.slice(0, 6);

                    const existingRoom = rooms.get(roomCode);

                    if (existingRoom) {
                        // Room exists — join it
                        if (isMemberOfRoom(existingRoom, deviceId)) {
                            sendError(ws, 'You are already in this room');
                            return;
                        }
                        if (existingRoom.members.length >= (existingRoom.maxMembers || MAX_ROOM_SIZE)) {
                            sendError(ws, 'Room is full');
                            return;
                        }

                        existingRoom.members.push({ deviceId, ws });
                        existingRoom.lastActivity = Date.now();
                        log('PASSPHRASE', `${deviceId} joined room ${roomCode} via passphrase`);

                        safeSend(ws, { type: 'room_joined', roomCode, memberCount: existingRoom.members.length, maxMembers: existingRoom.maxMembers || MAX_ROOM_SIZE, joinedVia: 'passphrase' });

                        existingRoom.members.forEach(member => {
                            if (member.deviceId !== deviceId) {
                                safeSend(member.ws, { type: 'peer_joined', deviceId, roomCode, memberCount: existingRoom.members.length });
                                safeSend(ws, { type: 'peer_joined', deviceId: member.deviceId, roomCode, memberCount: existingRoom.members.length });
                            }
                        });
                    } else {
                        // Room doesn't exist — create it and wait for friend
                        const maxMembers = Math.min(Math.max(parseInt(msg.maxMembers) || MAX_ROOM_SIZE, 2), MAX_ROOM_SIZE);
                        rooms.set(roomCode, { creator: deviceId, members: [{ deviceId, ws }], lastActivity: Date.now(), maxMembers });
                        log('PASSPHRASE', `${deviceId} created room ${roomCode} via passphrase (waiting for friend)`);

                        safeSend(ws, { type: 'room_created', roomCode, maxMembers, joinedVia: 'passphrase', waiting: true });
                    }
                    return;
                }

                // ── KEY EXCHANGE ──
                if (msg.type === 'key_exchange') {
                    const roomCode = msg.roomCode;
                    if (!isValidRoomCode(roomCode)) {
                        sendError(ws, 'Invalid room code format');
                        return;
                    }
                    const room = rooms.get(roomCode);
                    if (!room) {
                        sendError(ws, 'Room not found');
                        return;
                    }
                    if (!isMemberOfRoom(room, deviceId)) {
                        sendError(ws, 'Not a member of this room');
                        return;
                    }
                    if (!msg.publicKey) {
                        sendError(ws, 'Missing public key');
                        return;
                    }
                    room.lastActivity = Date.now();
                    room.members.forEach(member => {
                        if (member.deviceId !== deviceId) {
                            safeSend(member.ws, { type: 'key_exchange', publicKey: msg.publicKey, deviceId, roomCode });
                        }
                    });
                    log('E2E', `Key exchange relayed in room ${roomCode}`);
                    return;
                }

                // ── MESSAGE ──
                if (msg.type === 'message') {
                    if (!checkRate(connInfo, 'message')) {
                        sendError(ws, 'Rate limit: sending too fast. Slow down.');
                        return;
                    }
                    const roomCode = msg.roomCode;
                    if (!isValidRoomCode(roomCode)) {
                        sendError(ws, 'Invalid room code format');
                        return;
                    }
                    const room = rooms.get(roomCode);
                    if (!room) {
                        sendError(ws, 'Room not found');
                        return;
                    }
                    if (!isMemberOfRoom(room, deviceId)) {
                        sendError(ws, 'Not a member of this room');
                        return;
                    }

                    room.lastActivity = Date.now();
                    const messageId = msg.messageId || randomBytes(4).toString('hex');
                    let delivered = false;

                    room.members.forEach(member => {
                        if (member.deviceId !== deviceId) {
                            const sent = safeSend(member.ws, {
                                type: 'message',
                                from: deviceId,
                                deviceId,
                                payload: msg.payload,
                                iv: msg.iv || null,
                                encrypted: msg.encrypted || false,
                                messageId
                            });
                            if (sent) delivered = true;
                        }
                    });

                    safeSend(ws, { type: 'ack', messageId, status: delivered ? 'delivered' : 'queued' });
                    return;
                }

                // ── TYPING ──
                if (msg.type === 'typing') {
                    const roomCode = msg.roomCode;
                    if (!isValidRoomCode(roomCode)) return;
                    const room = rooms.get(roomCode);
                    if (room && isMemberOfRoom(room, deviceId)) {
                        room.members.forEach(member => {
                            if (member.deviceId !== deviceId) safeSend(member.ws, { type: 'typing', deviceId, roomCode });
                        });
                    }
                    return;
                }

                // ── END SESSION ──
                if (msg.type === 'end_session') {
                    const roomCode = msg.roomCode;
                    if (!isValidRoomCode(roomCode)) {
                        sendError(ws, 'Invalid room code format');
                        return;
                    }
                    const room = rooms.get(roomCode);
                    if (room) {
                        if (!isMemberOfRoom(room, deviceId)) {
                            sendError(ws, 'Not a member of this room');
                            return;
                        }
                        room.members.forEach(member => {
                            if (member.deviceId !== deviceId) safeSend(member.ws, { type: 'session_ended', roomCode, reason: 'Peer ended the session' });
                        });
                        rooms.delete(roomCode);
                        for (const [fileId, file] of fileStore.entries()) {
                            if (file.roomCode === roomCode) {
                                fileStoreBytes -= file.bytesUsed || 0;
                                fileStore.delete(fileId);
                            }
                        }
                        log('SESSION', `Room ${roomCode} ended by ${deviceId}`);
                    }
                    safeSend(ws, { type: 'session_ended', roomCode, reason: 'You ended the session' });
                    return;
                }

                // ── FILE TRANSFER ──
                if (['file_upload', 'file_chunk', 'file_download', 'file_delete'].includes(msg.type)) {
                    const fileId = msg.fileId;

                    // Validate fileId for all file operations
                    if (!isValidFileId(fileId)) {
                        sendError(ws, 'Invalid file ID');
                        return;
                    }

                    if (msg.type === 'file_upload') {
                        const roomCode = msg.roomCode;
                        if (!isValidRoomCode(roomCode)) {
                            sendError(ws, 'Invalid room code format');
                            return;
                        }
                        if (!rooms.has(roomCode)) {
                            sendError(ws, 'Room not found');
                            return;
                        }
                        const room = rooms.get(roomCode);
                        if (!isMemberOfRoom(room, deviceId)) {
                            sendError(ws, 'Not a member of this room');
                            return;
                        }

                        // Check global memory cap
                        if (fileStoreBytes >= MAX_FILE_STORE_BYTES) {
                            sendError(ws, 'Server file storage full. Try again later.');
                            return;
                        }

                        fileStore.set(fileId, {
                            chunks: [], totalChunks: msg.totalChunks || 1, metadata: msg.encryptedMetadata,
                            thumbnail: msg.thumbnail, iv: msg.iv, hash: msg.hash, ephemeral: msg.ephemeral,
                            displayCategory: msg.displayCategory || 'documents', expiry: Date.now() + FILE_EXPIRY_MS,
                            roomCode, senderId: deviceId, receivedChunks: 0, bytesUsed: 0
                        });
                        safeSend(ws, { type: 'file_upload_ack', fileId, status: 'ready' });
                    }

                    if (msg.type === 'file_chunk') {
                        const file = fileStore.get(fileId);
                        if (!file) {
                            sendError(ws, 'File not found');
                            return;
                        }
                        if (file.senderId !== deviceId) {
                            sendError(ws, 'Unauthorized: not the file sender');
                            return;
                        }

                        const chunkSize = estimateChunkSize(msg.data);

                        // Check global memory cap before accepting chunk
                        if (fileStoreBytes + chunkSize > MAX_FILE_STORE_BYTES) {
                            sendError(ws, 'Server file storage full. Try again later.');
                            return;
                        }

                        file.chunks.push(msg.data);
                        file.receivedChunks++;
                        file.bytesUsed += chunkSize;
                        fileStoreBytes += chunkSize;

                        if (file.receivedChunks >= file.totalChunks) {
                            const room = rooms.get(file.roomCode);
                            if (room) {
                                room.lastActivity = Date.now();
                                room.members.forEach(member => {
                                    if (member.deviceId !== deviceId) {
                                        safeSend(member.ws, {
                                            type: 'file_ready', fileId, from: deviceId, deviceId,
                                            totalChunks: file.totalChunks, iv: file.iv, hash: file.hash,
                                            encryptedMetadata: file.metadata, thumbnail: file.thumbnail,
                                            ephemeral: file.ephemeral, displayCategory: file.displayCategory
                                        });
                                    }
                                });
                            }
                            safeSend(ws, { type: 'file_upload_complete', fileId });
                        } else {
                            safeSend(ws, { type: 'file_chunk_ack', fileId, received: file.receivedChunks });
                        }
                    }

                    if (msg.type === 'file_download') {
                        const file = fileStore.get(fileId);
                        if (!file) {
                            sendError(ws, 'File not found');
                            return;
                        }

                        // Verify the requester is a member of the file's room
                        const room = rooms.get(file.roomCode);
                        if (!room || !isMemberOfRoom(room, deviceId)) {
                            sendError(ws, 'Unauthorized: not a member of the file room');
                            return;
                        }

                        for (let i = 0; i < file.chunks.length; i++) {
                            safeSend(ws, { type: 'file_chunk_data', fileId, chunkIndex: i, data: file.chunks[i], totalChunks: file.chunks.length });
                        }
                    }

                    if (msg.type === 'file_delete') {
                        const file = fileStore.get(fileId);
                        if (file && (file.senderId === deviceId || msg.reason === 'panic_wipe')) {
                            const roomCode = file.roomCode;
                            fileStoreBytes -= file.bytesUsed || 0;
                            fileStore.delete(fileId);
                            const room = rooms.get(roomCode);
                            if (room) {
                                room.members.forEach(member => {
                                    if (member.deviceId !== deviceId) safeSend(member.ws, { type: 'file_deleted', fileId });
                                });
                            }
                        }
                    }
                }

                // ── WORLD CHAT MESSAGE ──
                if (msg.type === 'world_message') {
                    if (!connInfo.worldRateWindow) connInfo.worldRateWindow = [];
                    const now = Date.now();
                    while (connInfo.worldRateWindow.length > 0 && connInfo.worldRateWindow[0] < now - 60000) {
                        connInfo.worldRateWindow.shift();
                    }
                    if (connInfo.worldRateWindow.length >= RATE_LIMIT_WORLD) {
                        sendError(ws, 'Slow down! Too many world chat messages.');
                        return;
                    }
                    connInfo.worldRateWindow.push(now);

                    if (!msg.text || typeof msg.text !== 'string' || msg.text.trim().length === 0 || msg.text.length > 500) {
                        sendError(ws, 'Invalid message (max 500 chars)');
                        return;
                    }

                    const worldMsg = {
                        type: 'world_message',
                        from: deviceId,
                        nickname: getDisplayName(deviceId),
                        text: msg.text.trim(),
                        timestamp: Date.now(),
                        messageId: randomBytes(4).toString('hex'),
                    };

                    // Store in world history buffer
                    worldHistory.push(worldMsg);
                    while (worldHistory.length > MAX_WORLD_HISTORY) {
                        worldHistory.shift();
                    }

                    // Broadcast to ALL connected clients
                    connections.forEach((conn) => {
                        safeSend(conn.ws, worldMsg);
                    });
                    return;
                }

                // ── SET NICKNAME ──
                if (msg.type === 'set_nickname') {
                    const nickname = typeof msg.nickname === 'string' ? msg.nickname.trim() : '';
                    if (!isValidNickname(nickname)) {
                        sendError(ws, 'Invalid nickname. Use 1-20 alphanumeric characters, spaces, dashes, or underscores.');
                        return;
                    }

                    // Check if nickname is already taken
                    for (const [otherId, otherNick] of nicknames.entries()) {
                        if (otherId !== deviceId && otherNick.toLowerCase() === nickname.toLowerCase()) {
                            sendError(ws, 'Nickname already taken');
                            return;
                        }
                    }

                    nicknames.set(deviceId, nickname);
                    log('NICKNAME', `${deviceId} set nickname to: ${nickname}`);
                    safeSend(ws, { type: 'nickname_set', nickname: nickname, deviceId });

                    // Notify everyone in world chat
                    connections.forEach((conn) => {
                        if (conn.deviceId !== deviceId) {
                            safeSend(conn.ws, { type: 'user_updated', deviceId, nickname: nickname });
                        }
                    });
                    return;
                }

                // ── INVITE TO PRIVATE ROOM ──
                if (msg.type === 'invite') {
                    if (!checkRate(connInfo, 'room')) {
                        sendError(ws, 'Rate limit: too many invites. Wait a moment.');
                        return;
                    }
                    const targetId = msg.targetDeviceId;
                    if (!targetId || !isValidDeviceId(targetId)) {
                        sendError(ws, 'Invalid target device ID');
                        return;
                    }
                    if (targetId === deviceId) {
                        sendError(ws, 'Cannot invite yourself');
                        return;
                    }

                    const targetConn = connections.get(targetId);
                    if (!targetConn) {
                        sendError(ws, 'User is not online');
                        return;
                    }

                    // Create a new private room for the invite
                    const roomCode = generateRoomCode();
                    const maxMembers = Math.min(Math.max(parseInt(msg.maxMembers) || MAX_ROOM_SIZE, 2), MAX_ROOM_SIZE);
                    rooms.set(roomCode, { creator: deviceId, members: [{ deviceId, ws }], lastActivity: Date.now(), maxMembers });

                    log('INVITE', `${deviceId} invited ${targetId} to room ${roomCode}`);

                    // Tell the inviter they've created the room
                    safeSend(ws, { type: 'room_created', roomCode, maxMembers, inviteSent: true });

                    // Send invite to target
                    safeSend(targetConn.ws, {
                        type: 'invite_received',
                        from: deviceId,
                        nickname: getDisplayName(deviceId),
                        roomCode,
                    });
                    return;
                }

                // ── GET ONLINE USERS ──
                if (msg.type === 'get_online_users') {
                    const users = [];
                    connections.forEach((conn) => {
                        users.push({
                            deviceId: conn.deviceId,
                            nickname: getDisplayName(conn.deviceId),
                        });
                    });
                    safeSend(ws, { type: 'online_users', users, count: users.length });
                    return;
                }

                // ── GET WORLD CHAT HISTORY ──
                if (msg.type === 'get_world_history') {
                    safeSend(ws, { type: 'world_history', messages: worldHistory });
                    return;
                }
            });

            ws.on('close', () => {
                log('WS', `Device ${deviceId} disconnected`);
                if (deviceId) {
                    connections.delete(deviceId);
                    nicknames.delete(deviceId);

                    // Notify world chat that user left
                    connections.forEach((conn) => {
                        safeSend(conn.ws, { type: 'user_left_world', deviceId });
                    });

                    // Find all rooms this device is in
                    const deviceRooms = [];
                    for (const [roomCode, room] of rooms.entries()) {
                        if (room.members.some(m => m.deviceId === deviceId)) {
                            deviceRooms.push(roomCode);
                        }
                    }

                    if (deviceRooms.length > 0) {
                        // Start reconnection grace period instead of immediately removing
                        log('RECONNECT', `${deviceId} disconnected, grace period started (${RECONNECT_GRACE_MS / 1000}s)`);

                        // Notify peers that this device is temporarily disconnected
                        for (const roomCode of deviceRooms) {
                            const room = rooms.get(roomCode);
                            if (room) {
                                room.members.forEach(member => {
                                    if (member.deviceId !== deviceId) {
                                        safeSend(member.ws, { type: 'peer_disconnected', deviceId, roomCode });
                                    }
                                });
                            }
                        }

                        // Set timeout to actually remove from rooms after grace period
                        const timeout = setTimeout(() => {
                            disconnectedDevices.delete(deviceId);
                            log('RECONNECT', `${deviceId} grace period expired, removing from rooms`);

                            for (const roomCode of deviceRooms) {
                                const room = rooms.get(roomCode);
                                if (room) {
                                    const idx = room.members.findIndex(m => m.deviceId === deviceId);
                                    if (idx !== -1) {
                                        room.members.splice(idx, 1);
                                        room.members.forEach(member => safeSend(member.ws, { type: 'peer_left', deviceId, roomCode }));
                                        if (room.members.length === 0) {
                                            rooms.delete(roomCode);
                                            for (const [fileId, file] of fileStore.entries()) {
                                                if (file.roomCode === roomCode) {
                                                    fileStoreBytes -= file.bytesUsed || 0;
                                                    fileStore.delete(fileId);
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }, RECONNECT_GRACE_MS);

                        disconnectedDevices.set(deviceId, { timeout, rooms: deviceRooms });
                    }
                }
            });

            ws.on('error', (err) => log('ERROR', `${deviceId}: ${err.message}`));
        });

        // Standalone mode: fixed port on 0.0.0.0 | Embedded mode: OS-assigned port on 127.0.0.1
        const bindHost = fixedPort ? '0.0.0.0' : '127.0.0.1';
        const bindPort = fixedPort || 0;
        httpServer.listen(bindPort, bindHost, () => {
            const port = httpServer.address().port;
            log('SERVER', `ADYX Backend running on ${bindHost}:${port}${fixedPort ? ' (standalone)' : ' (embedded)'}`);
            resolve(port);
        });

        httpServer.on('error', (err) => reject(err));
    });
}

function stopEmbeddedServer() {
    if (heartbeatInterval) clearInterval(heartbeatInterval);
    if (cleanupInterval) clearInterval(cleanupInterval);

    if (wss) {
        wss.clients.forEach(ws => {
            safeSend(ws, { type: 'session_ended', reason: 'Server shutting down' });
            try { ws.close(1001, 'Server shutting down'); } catch (_) { }
        });
        wss.close();
    }

    if (httpServer) {
        httpServer.close();
    }

    // Clear all in-memory state
    connections.clear();
    rooms.clear();
    fileStore.clear();
    fileStoreBytes = 0;

    // Clear all reconnection grace timers
    for (const [, entry] of disconnectedDevices.entries()) {
        clearTimeout(entry.timeout);
    }
    disconnectedDevices.clear();
    nicknames.clear();
    worldHistory.length = 0;
}

// ═══════════════════════════════════════════════════════════
//  LAN Mode — Serve frontend to mobile devices on same Wi-Fi
// ═══════════════════════════════════════════════════════════

let lanServer = null;
let lanPort = null;

/**
 * Get the machine's LAN IP address
 */
function getLanIP() {
    const os = require('os');
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name]) {
            if (iface.family === 'IPv4' && !iface.internal) {
                return iface.address;
            }
        }
    }
    return '127.0.0.1';
}

/**
 * Start a LAN-accessible HTTP server that serves the frontend
 * @param {string} appDir — path to the 'app' directory containing the React build
 * @param {number} backendWsPort — port of the embedded WS backend
 * @returns {Promise<{url: string, port: number, ip: string}>}
 */
function startLanServer(appDir, backendWsPort) {
    return new Promise((resolve, reject) => {
        if (lanServer) {
            const ip = getLanIP();
            resolve({ url: `http://${ip}:${lanPort}`, port: lanPort, ip });
            return;
        }

        const fs = require('fs');
        const pathModule = require('path');

        const MIME_TYPES = {
            '.html': 'text/html',
            '.js': 'text/javascript',
            '.css': 'text/css',
            '.json': 'application/json',
            '.svg': 'image/svg+xml',
            '.png': 'image/png',
            '.ico': 'image/x-icon',
            '.woff': 'font/woff',
            '.woff2': 'font/woff2',
            '.ttf': 'font/ttf',
        };

        lanServer = createServer((req, res) => {
            // CORS for LAN access
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');

            if (req.method === 'OPTIONS') {
                res.writeHead(204);
                res.end();
                return;
            }

            // Serve backend info endpoint so frontend can discover WS port
            if (req.url === '/api/config') {
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    wsPort: backendWsPort,
                    wsHost: req.headers.host?.split(':')[0] || getLanIP(),
                }));
                return;
            }

            // Serve static files from app directory
            let filePath = pathModule.join(appDir, req.url === '/' ? 'index.html' : req.url);

            // SPA fallback: if file doesn't exist, serve index.html
            if (!fs.existsSync(filePath)) {
                filePath = pathModule.join(appDir, 'index.html');
            }

            try {
                const ext = pathModule.extname(filePath).toLowerCase();
                const contentType = MIME_TYPES[ext] || 'application/octet-stream';
                const content = fs.readFileSync(filePath);
                res.writeHead(200, { 'Content-Type': contentType });
                res.end(content);
            } catch (err) {
                res.writeHead(404);
                res.end('Not Found');
            }
        });

        // Use port 0 for OS-assigned port
        lanServer.listen(0, '0.0.0.0', () => {
            lanPort = lanServer.address().port;
            const ip = getLanIP();
            const url = `http://${ip}:${lanPort}`;
            log('LAN', `LAN server started: ${url}`);
            resolve({ url, port: lanPort, ip });
        });

        lanServer.on('error', (err) => {
            log('LAN', `LAN server error: ${err.message}`);
            reject(err);
        });
    });
}

/**
 * Stop the LAN server
 */
function stopLanServer() {
    if (lanServer) {
        lanServer.close();
        lanServer = null;
        lanPort = null;
        log('LAN', 'LAN server stopped');
    }
}

/**
 * Check if LAN mode is active
 */
function isLanActive() {
    return lanServer !== null;
}

/**
 * Get the current LAN URL
 */
function getLanUrl() {
    if (!lanServer) return null;
    return `http://${getLanIP()}:${lanPort}`;
}

module.exports = {
    startEmbeddedServer,
    stopEmbeddedServer,
    startLanServer,
    stopLanServer,
    isLanActive,
    getLanUrl,
    getLanIP,
};
