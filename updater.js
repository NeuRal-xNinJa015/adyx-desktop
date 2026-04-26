// ═══════════════════════════════════════════════════════════
//  ADYX Desktop — Auto-Update Checker
//  Checks GitHub Releases for new versions on startup.
//  Does NOT auto-download — shows a dialog to the user.
// ═══════════════════════════════════════════════════════════

const { dialog, shell } = require('electron');
const https = require('https');
const logger = require('./logger');

// ── Configuration ──
// Change this to your actual GitHub repo when you publish
const GITHUB_OWNER = 'adyx-team';
const GITHUB_REPO = 'adyx-desktop';
const RELEASES_URL = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/releases/latest`;
const CHECK_DELAY_MS = 10000;  // Wait 10s after app start before checking

let currentVersion = '1.0.0';

/**
 * Initialize the updater with the current app version
 * @param {string} version — app version from package.json
 */
function initUpdater(version) {
    currentVersion = version || '1.0.0';
}

/**
 * Compare two semver strings: returns 1 if b > a, 0 if equal, -1 if a > b
 */
function compareVersions(a, b) {
    const pa = a.replace(/^v/, '').split('.').map(Number);
    const pb = b.replace(/^v/, '').split('.').map(Number);

    for (let i = 0; i < 3; i++) {
        const va = pa[i] || 0;
        const vb = pb[i] || 0;
        if (vb > va) return 1;
        if (va > vb) return -1;
    }
    return 0;
}

/**
 * Fetch the latest release from GitHub
 * @returns {Promise<{version: string, url: string, body: string} | null>}
 */
function fetchLatestRelease() {
    return new Promise((resolve) => {
        const options = {
            hostname: 'api.github.com',
            path: `/repos/${GITHUB_OWNER}/${GITHUB_REPO}/releases/latest`,
            method: 'GET',
            headers: {
                'User-Agent': `ADYX-Desktop/${currentVersion}`,
                'Accept': 'application/vnd.github.v3+json',
            },
            timeout: 10000,
        };

        const req = https.get(options, (res) => {
            let data = '';

            if (res.statusCode !== 200) {
                logger.warn('UPDATER', `GitHub API returned status ${res.statusCode}`);
                resolve(null);
                return;
            }

            res.on('data', (chunk) => { data += chunk; });
            res.on('end', () => {
                try {
                    const release = JSON.parse(data);
                    resolve({
                        version: release.tag_name || release.name,
                        url: release.html_url,
                        body: release.body || '',
                        downloadUrl: release.assets?.[0]?.browser_download_url || release.html_url,
                    });
                } catch (err) {
                    logger.error('UPDATER', 'Failed to parse release data:', err.message);
                    resolve(null);
                }
            });
        });

        req.on('error', (err) => {
            logger.warn('UPDATER', 'Update check failed (network error):', err.message);
            resolve(null);
        });

        req.on('timeout', () => {
            req.destroy();
            logger.warn('UPDATER', 'Update check timed out');
            resolve(null);
        });
    });
}

/**
 * Check for updates and show a dialog if a new version is available
 * @param {BrowserWindow} parentWindow — parent window for the dialog
 * @param {boolean} silent — if true, don't show "you're up to date" dialog
 */
async function checkForUpdates(parentWindow, silent = true) {
    logger.info('UPDATER', `Checking for updates... (current: v${currentVersion})`);

    const latest = await fetchLatestRelease();

    if (!latest) {
        if (!silent) {
            dialog.showMessageBox(parentWindow, {
                type: 'info',
                title: 'ADYX Update',
                message: 'Could not check for updates',
                detail: 'Unable to reach the update server. Check your internet connection and try again.',
                buttons: ['OK'],
            });
        }
        return false;
    }

    const comparison = compareVersions(currentVersion, latest.version);

    if (comparison > 0) {
        // New version available
        logger.info('UPDATER', `New version available: ${latest.version} (current: v${currentVersion})`);

        const result = await dialog.showMessageBox(parentWindow, {
            type: 'info',
            title: 'ADYX Update Available',
            message: `A new version of ADYX is available!`,
            detail: `Current: v${currentVersion}\nLatest: ${latest.version}\n\n${latest.body.slice(0, 300)}`,
            buttons: ['Download Update', 'Later'],
            defaultId: 0,
            cancelId: 1,
        });

        if (result.response === 0) {
            shell.openExternal(latest.downloadUrl || latest.url);
        }

        return true;
    } else {
        logger.info('UPDATER', `App is up to date (v${currentVersion})`);

        if (!silent) {
            dialog.showMessageBox(parentWindow, {
                type: 'info',
                title: 'ADYX Update',
                message: 'You\'re up to date!',
                detail: `ADYX v${currentVersion} is the latest version.`,
                buttons: ['OK'],
            });
        }

        return false;
    }
}

/**
 * Schedule an automatic update check after app start
 * @param {BrowserWindow} parentWindow
 */
function scheduleUpdateCheck(parentWindow) {
    setTimeout(() => {
        checkForUpdates(parentWindow, true).catch(err => {
            logger.error('UPDATER', 'Scheduled update check failed:', err.message);
        });
    }, CHECK_DELAY_MS);
}

module.exports = {
    initUpdater,
    checkForUpdates,
    scheduleUpdateCheck,
};
