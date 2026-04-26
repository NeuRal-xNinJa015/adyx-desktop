// ═══════════════════════════════════════════════════════════
//  ADYX — Standalone Relay Server
//  Deploy this on Railway, Render, Heroku, or any Node.js host.
//  All ADYX desktop apps connect to this shared server.
//
//  Usage:
//    node server.js
//    PORT=4567 node server.js
//
//  Environment variables:
//    PORT — Server port (default: 4567)
// ═══════════════════════════════════════════════════════════

const { startEmbeddedServer, stopEmbeddedServer } = require('./backend');
const logger = require('./logger');
const path = require('path');
const fs = require('fs');

// Initialize logger to current directory for standalone mode
const logDir = path.join(__dirname, 'logs');
if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });
logger.init(__dirname);

const PORT = parseInt(process.env.PORT) || 4567;

logger.info('SERVER', '═══════════════════════════════════════');
logger.info('SERVER', '  ADYX Public Relay Server');
logger.info('SERVER', '═══════════════════════════════════════');
logger.info('SERVER', `Starting on port ${PORT}...`);

// Override the dynamic port selection — use fixed PORT
startEmbeddedServer(PORT)
    .then((port) => {
        logger.info('SERVER', `✓ ADYX Relay Server running on port ${port}`);
        logger.info('SERVER', `  WebSocket: ws://0.0.0.0:${port}`);
        logger.info('SERVER', `  Health:    http://0.0.0.0:${port}/health`);
        logger.info('SERVER', '');
        logger.info('SERVER', '  Clients can connect using:');
        logger.info('SERVER', `  ws://YOUR_SERVER_IP:${port}`);
        logger.info('SERVER', '');
        logger.info('SERVER', '  Press Ctrl+C to stop.');
    })
    .catch((err) => {
        logger.error('SERVER', `Failed to start: ${err.message}`);
        process.exit(1);
    });

// Graceful shutdown
process.on('SIGINT', () => {
    logger.info('SERVER', 'Shutting down...');
    stopEmbeddedServer();
    logger.close();
    process.exit(0);
});

process.on('SIGTERM', () => {
    logger.info('SERVER', 'Shutting down (SIGTERM)...');
    stopEmbeddedServer();
    logger.close();
    process.exit(0);
});

process.on('uncaughtException', (err) => {
    logger.error('SERVER', `Uncaught exception: ${err.message}`);
    logger.error('SERVER', err.stack);
});

process.on('unhandledRejection', (reason) => {
    logger.error('SERVER', `Unhandled rejection: ${reason}`);
});
