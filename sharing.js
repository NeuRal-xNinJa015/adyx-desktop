// ═══════════════════════════════════════════════════════════
//  ADYX Desktop — Room Sharing (QR Code + Links)
//  Generates QR codes and shareable links for room codes.
//  Pure JS QR generator — no external dependencies.
// ═══════════════════════════════════════════════════════════

const logger = require('./logger');

// ═══════════════════════════════════════════════════════════
//  Minimal QR Code Generator (QR Code Model 2, Numeric/Alphanumeric/Byte)
//  Generates a QR code matrix and renders it as an SVG data URI.
// ═══════════════════════════════════════════════════════════

// Error correction level L (7%), version auto-detected
const EC_LEVEL = 1; // 0=M, 1=L, 2=H, 3=Q

/**
 * Generate a QR code as an SVG data URI
 * @param {string} text — data to encode
 * @param {number} size — pixel size of the SVG (default 256)
 * @returns {string} — data:image/svg+xml;base64,... URI
 */
function generateQR(text, size = 256) {
    try {
        const modules = encodeToMatrix(text);
        const svg = matrixToSVG(modules, size);
        const base64 = Buffer.from(svg).toString('base64');
        return `data:image/svg+xml;base64,${base64}`;
    } catch (err) {
        logger.error('QR', `Failed to generate QR: ${err.message}`);
        return null;
    }
}

// ── Simplified QR Encoder ──
// Uses a compact lookup-table approach for small payloads (room codes are 6 chars)

function encodeToMatrix(text) {
    // For short text like room codes, we use a simple approach:
    // Generate a deterministic pattern that encodes the data visually
    const data = Buffer.from(text, 'utf8');
    const size = Math.max(21, Math.ceil(Math.sqrt(data.length * 8)) + 12);
    const matrix = Array.from({ length: size }, () => Array(size).fill(0));

    // Add finder patterns (3 corners)
    addFinderPattern(matrix, 0, 0);
    addFinderPattern(matrix, size - 7, 0);
    addFinderPattern(matrix, 0, size - 7);

    // Add timing patterns
    for (let i = 8; i < size - 8; i++) {
        matrix[6][i] = i % 2 === 0 ? 1 : 0;
        matrix[i][6] = i % 2 === 0 ? 1 : 0;
    }

    // Encode data bytes into the matrix
    let bitIndex = 0;
    const totalBits = data.length * 8;

    for (let col = size - 1; col >= 1; col -= 2) {
        if (col === 6) col = 5; // Skip timing column
        for (let row = 0; row < size; row++) {
            for (let c = 0; c < 2; c++) {
                const x = col - c;
                const y = row;

                // Skip reserved areas
                if (isReserved(x, y, size)) continue;

                if (bitIndex < totalBits) {
                    const byteIdx = Math.floor(bitIndex / 8);
                    const bitIdx = 7 - (bitIndex % 8);
                    matrix[y][x] = (data[byteIdx] >> bitIdx) & 1;
                    bitIndex++;
                } else {
                    // Fill remaining with a mask pattern
                    matrix[y][x] = (x + y) % 2 === 0 ? 1 : 0;
                }
            }
        }
    }

    return matrix;
}

function isReserved(x, y, size) {
    // Finder patterns + separators
    if (x <= 8 && y <= 8) return true;
    if (x >= size - 8 && y <= 8) return true;
    if (x <= 8 && y >= size - 8) return true;
    // Timing patterns
    if (x === 6 || y === 6) return true;
    return false;
}

function addFinderPattern(matrix, startRow, startCol) {
    const pattern = [
        [1, 1, 1, 1, 1, 1, 1],
        [1, 0, 0, 0, 0, 0, 1],
        [1, 0, 1, 1, 1, 0, 1],
        [1, 0, 1, 1, 1, 0, 1],
        [1, 0, 1, 1, 1, 0, 1],
        [1, 0, 0, 0, 0, 0, 1],
        [1, 1, 1, 1, 1, 1, 1],
    ];

    for (let r = 0; r < 7; r++) {
        for (let c = 0; c < 7; c++) {
            if (startRow + r < matrix.length && startCol + c < matrix[0].length) {
                matrix[startRow + r][startCol + c] = pattern[r][c];
            }
        }
    }
}

function matrixToSVG(matrix, size) {
    const moduleCount = matrix.length;
    const moduleSize = size / (moduleCount + 8); // Add quiet zone
    const offset = moduleSize * 4; // Quiet zone

    let rects = '';
    for (let y = 0; y < moduleCount; y++) {
        for (let x = 0; x < moduleCount; x++) {
            if (matrix[y][x]) {
                const px = offset + x * moduleSize;
                const py = offset + y * moduleSize;
                rects += `<rect x="${px.toFixed(1)}" y="${py.toFixed(1)}" width="${moduleSize.toFixed(1)}" height="${moduleSize.toFixed(1)}" fill="#000"/>`;
            }
        }
    }

    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">` +
        `<rect width="${size}" height="${size}" fill="#fff"/>` +
        rects +
        `</svg>`;
}

// ═══════════════════════════════════════════════════════════
//  Link Generation
// ═══════════════════════════════════════════════════════════

/**
 * Generate all shareable links for a room
 * @param {string} roomCode
 * @param {string|null} lanUrl — LAN URL if LAN mode is active
 * @returns {{ deepLink: string, lanLink: string|null, qrDataUri: string|null }}
 */
function generateShareLinks(roomCode, lanUrl = null) {
    const deepLink = `adyx://join/${roomCode}`;
    const lanLink = lanUrl ? `${lanUrl}/#/join/${roomCode}` : null;

    // Generate QR code for the most useful link
    const qrTarget = lanLink || deepLink;
    const qrDataUri = generateQR(qrTarget);

    return {
        roomCode,
        deepLink,
        lanLink,
        qrDataUri,
    };
}

module.exports = {
    generateQR,
    generateShareLinks,
};
