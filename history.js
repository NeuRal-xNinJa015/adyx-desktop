// ═══════════════════════════════════════════════════════════
//  ADYX Desktop — Encrypted Chat History
//  Opt-in local storage for chat messages, encrypted at rest.
//  Uses AES-256-GCM with a machine-derived key.
// ═══════════════════════════════════════════════════════════

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const logger = require('./logger');

// ── Configuration ──
const HISTORY_DIR_NAME = 'history';
const AUTO_PURGE_DAYS = 7;              // Delete history older than 7 days
const MAX_MESSAGES_PER_ROOM = 500;      // Keep last 500 messages per room
const ALGORITHM = 'aes-256-gcm';
const KEY_LENGTH = 32;
const IV_LENGTH = 16;
const SALT = 'adyx-history-v1';

let historyDir = null;
let encryptionKey = null;

/**
 * Initialize history module.
 * @param {string} userDataPath — app.getPath('userData')
 */
function initHistory(userDataPath) {
    historyDir = path.join(userDataPath, HISTORY_DIR_NAME);

    // Ensure directory exists
    if (!fs.existsSync(historyDir)) {
        fs.mkdirSync(historyDir, { recursive: true });
    }

    // Derive encryption key from machine-specific info
    // Uses hostname + username + a salt — unique per machine, no user input needed
    const machineId = `${require('os').hostname()}-${require('os').userInfo().username}-${SALT}`;
    encryptionKey = crypto.scryptSync(machineId, SALT, KEY_LENGTH);

    // Auto-purge old history files
    purgeOldHistory();

    logger.info('HISTORY', `Chat history initialized at ${historyDir}`);
}

/**
 * Encrypt data using AES-256-GCM
 */
function encrypt(plaintext) {
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, encryptionKey, iv);
    let encrypted = cipher.update(plaintext, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag().toString('hex');
    return { iv: iv.toString('hex'), encrypted, authTag };
}

/**
 * Decrypt data using AES-256-GCM
 */
function decrypt(encryptedData) {
    const { iv, encrypted, authTag } = encryptedData;
    const decipher = crypto.createDecipheriv(ALGORITHM, encryptionKey, Buffer.from(iv, 'hex'));
    decipher.setAuthTag(Buffer.from(authTag, 'hex'));
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
}

/**
 * Get the file path for a room's history
 */
function getHistoryFile(roomCode) {
    // Sanitize room code for use as filename — only allow alphanumeric
    const safe = String(roomCode).replace(/[^a-f0-9]/g, '');
    if (!safe || safe.length === 0 || safe.length > 64) return null;
    return path.join(historyDir, `${safe}.enc`);
}

/**
 * Load existing history for a room (decrypted)
 */
function loadRoomHistory(roomCode) {
    const filePath = getHistoryFile(roomCode);
    if (!filePath || !fs.existsSync(filePath)) return [];

    try {
        const raw = fs.readFileSync(filePath, 'utf8');
        const encryptedData = JSON.parse(raw);
        const decrypted = decrypt(encryptedData);
        return JSON.parse(decrypted);
    } catch (err) {
        logger.warn('HISTORY', `Failed to load history for room ${roomCode}: ${err.message}`);
        return [];
    }
}

/**
 * Save a message to a room's history
 * @param {string} roomCode
 * @param {object} message — { from, payload, timestamp, messageId, ... }
 */
function saveMessage(roomCode, message) {
    if (!historyDir || !encryptionKey) {
        logger.warn('HISTORY', 'History not initialized');
        return false;
    }

    try {
        const filePath = getHistoryFile(roomCode);
        if (!filePath) return false;

        // Load existing messages
        const messages = loadRoomHistory(roomCode);

        // Add new message with timestamp
        messages.push({
            ...message,
            savedAt: Date.now(),
        });

        // Trim to max messages
        while (messages.length > MAX_MESSAGES_PER_ROOM) {
            messages.shift();
        }

        // Encrypt and save
        const plaintext = JSON.stringify(messages);
        const encryptedData = encrypt(plaintext);
        fs.writeFileSync(getHistoryFile(roomCode), JSON.stringify(encryptedData), 'utf8');

        return true;
    } catch (err) {
        logger.error('HISTORY', `Failed to save message for room ${roomCode}: ${err.message}`);
        return false;
    }
}

/**
 * Get chat history for a room
 * @param {string} roomCode
 * @returns {Array} — array of message objects
 */
function getHistory(roomCode) {
    if (!historyDir || !encryptionKey) return [];
    return loadRoomHistory(roomCode);
}

/**
 * Clear history for a specific room
 */
function clearHistory(roomCode) {
    try {
        const filePath = getHistoryFile(roomCode);
        if (!filePath) return false;
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
            logger.info('HISTORY', `Cleared history for room ${roomCode}`);
        }
        return true;
    } catch (err) {
        logger.error('HISTORY', `Failed to clear history for room ${roomCode}: ${err.message}`);
        return false;
    }
}

/**
 * Clear ALL chat history
 */
function clearAllHistory() {
    try {
        if (!historyDir || !fs.existsSync(historyDir)) return true;

        const files = fs.readdirSync(historyDir).filter(f => f.endsWith('.enc'));
        for (const file of files) {
            fs.unlinkSync(path.join(historyDir, file));
        }
        logger.info('HISTORY', `Cleared all history (${files.length} rooms)`);
        return true;
    } catch (err) {
        logger.error('HISTORY', `Failed to clear all history: ${err.message}`);
        return false;
    }
}

/**
 * List all rooms that have saved history
 * @returns {Array<{roomCode: string, messageCount: number, lastSaved: number}>}
 */
function listHistory() {
    if (!historyDir || !fs.existsSync(historyDir)) return [];

    try {
        const files = fs.readdirSync(historyDir).filter(f => f.endsWith('.enc'));
        return files.map(file => {
            const roomCode = file.replace('.enc', '');
            const messages = loadRoomHistory(roomCode);
            const lastMsg = messages[messages.length - 1];
            return {
                roomCode,
                messageCount: messages.length,
                lastSaved: lastMsg?.savedAt || 0,
            };
        }).sort((a, b) => b.lastSaved - a.lastSaved);
    } catch (err) {
        logger.error('HISTORY', `Failed to list history: ${err.message}`);
        return [];
    }
}

/**
 * Auto-purge history files older than AUTO_PURGE_DAYS
 */
function purgeOldHistory() {
    if (!historyDir || !fs.existsSync(historyDir)) return;

    try {
        const now = Date.now();
        const maxAge = AUTO_PURGE_DAYS * 24 * 60 * 60 * 1000;
        const files = fs.readdirSync(historyDir).filter(f => f.endsWith('.enc'));

        let purged = 0;
        for (const file of files) {
            const filePath = path.join(historyDir, file);
            const stats = fs.statSync(filePath);
            if (now - stats.mtimeMs > maxAge) {
                fs.unlinkSync(filePath);
                purged++;
            }
        }

        if (purged > 0) {
            logger.info('HISTORY', `Auto-purged ${purged} expired history files`);
        }
    } catch (err) {
        logger.warn('HISTORY', `Auto-purge failed: ${err.message}`);
    }
}

module.exports = {
    initHistory,
    saveMessage,
    getHistory,
    clearHistory,
    clearAllHistory,
    listHistory,
};
