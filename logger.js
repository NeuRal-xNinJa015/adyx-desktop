// ═══════════════════════════════════════════════════════════
//  ADYX Desktop — Logger Module
//  Persistent file logging with rotation + console output.
//  Logs are stored in the app's userData directory.
// ═══════════════════════════════════════════════════════════

const fs = require('fs');
const path = require('path');

// ── Configuration ──
const MAX_LOG_SIZE = 5 * 1024 * 1024;  // 5MB per log file
const MAX_LOG_FILES = 3;                // Keep 3 rotated files
const LOG_DIR_NAME = 'logs';

let logDir = null;
let logFile = null;
let logStream = null;

/**
 * Initialize the logger. Must be called after app.getPath('userData') is available.
 * @param {string} userDataPath — app.getPath('userData')
 */
function initLogger(userDataPath) {
    logDir = path.join(userDataPath, LOG_DIR_NAME);

    // Ensure log directory exists
    if (!fs.existsSync(logDir)) {
        fs.mkdirSync(logDir, { recursive: true });
    }

    logFile = path.join(logDir, 'adyx.log');

    // Rotate if current log is too big
    rotateIfNeeded();

    // Open append stream
    logStream = fs.createWriteStream(logFile, { flags: 'a' });

    // Write startup marker
    const divider = '═'.repeat(60);
    const startMsg = `\n${divider}\n  ADYX Session Started — ${new Date().toISOString()}\n${divider}\n`;
    logStream.write(startMsg);
}

/**
 * Rotate log files if the current one exceeds MAX_LOG_SIZE
 */
function rotateIfNeeded() {
    try {
        if (!fs.existsSync(logFile)) return;

        const stats = fs.statSync(logFile);
        if (stats.size < MAX_LOG_SIZE) return;

        // Shift existing rotated logs: adyx.3.log → delete, adyx.2.log → adyx.3.log, etc.
        for (let i = MAX_LOG_FILES; i >= 1; i--) {
            const older = path.join(logDir, `adyx.${i}.log`);
            const newer = i === 1 ? logFile : path.join(logDir, `adyx.${i - 1}.log`);

            if (i === MAX_LOG_FILES && fs.existsSync(older)) {
                fs.unlinkSync(older);
            }
            if (fs.existsSync(newer)) {
                fs.renameSync(newer, path.join(logDir, `adyx.${i}.log`));
            }
        }
    } catch (err) {
        console.error('[LOGGER] Rotation failed:', err.message);
    }
}

/**
 * Get a timestamp string for log entries
 */
function timestamp() {
    return new Date().toISOString();
}

/**
 * Write a log entry to both console and file
 */
function writeLog(level, tag, ...args) {
    const ts = timestamp();
    const message = args.map(a => (typeof a === 'object' ? JSON.stringify(a, null, 2) : String(a))).join(' ');
    const line = `[${ts}] [${level}] [${tag}] ${message}`;

    // Console output
    switch (level) {
        case 'ERROR':
            console.error(line);
            break;
        case 'WARN':
            console.warn(line);
            break;
        default:
            console.log(line);
    }

    // File output
    if (logStream && !logStream.destroyed) {
        logStream.write(line + '\n');
    }
}

/**
 * Close the log stream gracefully
 */
function closeLogger() {
    if (logStream && !logStream.destroyed) {
        logStream.write(`\n[${timestamp()}] [INFO] [SHUTDOWN] Logger closed\n`);
        logStream.end();
        logStream = null;
    }
}

// ── Public API ──
const logger = {
    init: initLogger,
    close: closeLogger,
    info: (tag, ...args) => writeLog('INFO', tag, ...args),
    warn: (tag, ...args) => writeLog('WARN', tag, ...args),
    error: (tag, ...args) => writeLog('ERROR', tag, ...args),
    debug: (tag, ...args) => {
        // Only log debug in development
        if (process.env.NODE_ENV !== 'production') {
            writeLog('DEBUG', tag, ...args);
        }
    },
    getLogPath: () => logDir,
};

module.exports = logger;
