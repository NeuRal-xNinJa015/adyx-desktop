// ═══════════════════════════════════════════════════════════
//  ADYX Desktop — Electron Main Process
//  Loads the bundled ADYX web platform inside a native window.
//  Includes: file logging, crash reporting, auto-updater,
//            chat history, LAN mode, QR sharing.
// ═══════════════════════════════════════════════════════════

const { app, BrowserWindow, shell, Menu, Tray, nativeImage, dialog, ipcMain } = require('electron');
const path = require('path');
const logger = require('./logger');
const { startEmbeddedServer, stopEmbeddedServer, startLanServer, stopLanServer, isLanActive, getLanUrl } = require('./backend');
const { initUpdater, checkForUpdates, scheduleUpdateCheck } = require('./updater');
const { initHistory, saveMessage, getHistory, clearHistory, clearAllHistory, listHistory } = require('./history');
const { generateQR, generateShareLinks } = require('./sharing');

// ── Configuration ──────────────────────────────────────────
let backendPort = null;
const APP_NAME = 'ADYX';
const APP_VERSION = require('./package.json').version;
const WINDOW_WIDTH = 1280;
const WINDOW_HEIGHT = 800;
const MIN_WIDTH = 900;
const MIN_HEIGHT = 600;

// ── Initialize logger early ────────────────────────────────
logger.init(app.getPath('userData'));
logger.info('APP', `ADYX Desktop v${APP_VERSION} starting...`);
logger.info('APP', `Platform: ${process.platform} | Arch: ${process.arch} | Electron: ${process.versions.electron}`);
logger.info('APP', `User data: ${app.getPath('userData')}`);
logger.info('APP', `Packaged: ${app.isPackaged}`);

// ── Initialize modules ────────────────────────────────────
initUpdater(APP_VERSION);
initHistory(app.getPath('userData'));

// ── Crash Reporting ───────────────────────────────────────
process.on('uncaughtException', (error) => {
  logger.error('CRASH', `Uncaught Exception: ${error.message}`);
  logger.error('CRASH', error.stack || 'No stack trace');
  try {
    dialog.showErrorBox('ADYX — Unexpected Error',
      `An unexpected error occurred:\n\n${error.message}\n\nThe application will continue running. Check logs for details.`
    );
  } catch (_) { }
});

process.on('unhandledRejection', (reason) => {
  logger.error('CRASH', `Unhandled Promise Rejection: ${reason}`);
  if (reason instanceof Error) {
    logger.error('CRASH', reason.stack || 'No stack trace');
  }
});

// ── Single Instance Lock ────────────────────────────────────
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  logger.info('APP', 'Another instance is already running. Quitting.');
  app.quit();
}

let mainWindow = null;
let tray = null;
let isQuitting = false;

// ── Register custom protocol: adyx:// ─────────────────────
if (process.defaultApp) {
  if (process.argv.length >= 2) {
    app.setAsDefaultProtocolClient('adyx', process.execPath, [path.resolve(process.argv[1])]);
  }
} else {
  app.setAsDefaultProtocolClient('adyx');
}

// ── Create Main Window ─────────────────────────────────────
function createWindow() {
  const iconPath = path.join(__dirname, 'assets', 'icon.png');

  mainWindow = new BrowserWindow({
    width: WINDOW_WIDTH,
    height: WINDOW_HEIGHT,
    minWidth: MIN_WIDTH,
    minHeight: MIN_HEIGHT,
    title: APP_NAME,
    icon: iconPath,
    backgroundColor: '#000000',
    show: true,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
      webviewTag: false,
      spellcheck: true,
    },
  });

  // ── Load splash screen first ──
  mainWindow.loadFile(path.join(__dirname, 'loading.html'));
  logger.info('WINDOW', 'Main window created, splash loaded');

  // ── Only open DevTools in development ──
  if (!app.isPackaged) {
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  }

  // ── Set Content Security Policy ──
  mainWindow.webContents.session.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [
          "default-src 'self';" +
          " script-src 'self' 'unsafe-inline';" +
          " style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;" +
          " font-src 'self' https://fonts.gstatic.com;" +
          " img-src 'self' data: blob:;" +
          " connect-src 'self' ws://127.0.0.1:* http://127.0.0.1:* ws://localhost:* http://localhost:* ws://*:* http://*:*;" +
          " media-src 'self' blob:;" +
          " object-src 'none';" +
          " base-uri 'self';"
        ]
      }
    });
  });

  // ── Once splash is shown, start loading bundled app ──
  mainWindow.webContents.on('did-finish-load', () => {
    if (!mainWindow) return;
    const currentURL = mainWindow.webContents.getURL();
    if (currentURL.includes('loading.html') && !currentURL.includes('error=true')) {
      logger.info('WINDOW', 'Splash loaded');
      if (backendPort) {
        setTimeout(() => loadLocalApp(), 1000);
      }
    }
  });

  // ── Handle load failures ──
  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
    logger.error('WINDOW', `Load failed: ${errorCode} ${errorDescription} — ${validatedURL}`);
    if (!mainWindow) return;
    if (validatedURL && (validatedURL.includes('app/index.html') || validatedURL.startsWith('http'))) {
      mainWindow.loadFile(path.join(__dirname, 'loading.html'), {
        query: { error: 'true', message: errorDescription || 'Failed to load ADYX UI' }
      });
    }
  });

  // ── Renderer crash handling ──
  mainWindow.webContents.on('render-process-gone', (event, details) => {
    logger.error('CRASH', `Renderer process gone: ${details.reason} (exitCode: ${details.exitCode})`);
    if (details.reason !== 'clean-exit') {
      mainWindow.loadFile(path.join(__dirname, 'loading.html'), {
        query: { error: 'true', message: `Renderer crashed: ${details.reason}` }
      });
    }
  });

  // ── Window Events ──
  mainWindow.on('close', (e) => {
    if (!isQuitting) {
      e.preventDefault();
      mainWindow.hide();
      logger.info('WINDOW', 'Window hidden to tray');
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
    logger.info('WINDOW', 'Window closed');
  });

  // ── Handle external links ──
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http') && !url.includes('localhost')) {
      shell.openExternal(url);
      return { action: 'deny' };
    }
    return { action: 'allow' };
  });

  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (!url.startsWith('file://') && !url.includes('localhost')) {
      event.preventDefault();
      shell.openExternal(url);
    }
  });

  // ── Context Menu ──
  mainWindow.webContents.on('context-menu', (event, params) => {
    const menu = Menu.buildFromTemplate([
      { role: 'cut', visible: params.isEditable },
      { role: 'copy' },
      { role: 'paste', visible: params.isEditable },
      { role: 'selectAll' },
      { type: 'separator' },
      { role: 'reload' },
      {
        label: 'Open DevTools',
        click: () => mainWindow.webContents.openDevTools(),
        visible: !app.isPackaged,
      },
    ]);
    menu.popup();
  });

  createTray(iconPath);
}

// ── Load Local App ────────────────────────────────────────
function loadLocalApp() {
  if (!mainWindow) return;
  logger.info('APP', 'Loading local bundled app');
  mainWindow.loadFile(path.join(__dirname, 'app', 'index.html')).catch((err) => {
    logger.error('APP', 'Failed to load app/index.html:', err.message);
  });
}

// ── Handle deep link (adyx://join/roomcode) ───────────────
function handleDeepLink(url) {
  logger.info('DEEPLINK', `Received: ${url}`);
  const match = url.match(/adyx:\/\/join\/([a-f0-9]{6})/);
  if (match && mainWindow) {
    const roomCode = match[1];
    logger.info('DEEPLINK', `Auto-joining room: ${roomCode}`);
    // Send room code to renderer to trigger auto-join
    mainWindow.webContents.send('deep-link-join', roomCode);
    mainWindow.show();
    mainWindow.focus();
  }
}

// ── System Tray ────────────────────────────────────────────
function createTray(iconPath) {
  try {
    const trayIcon = nativeImage.createFromPath(iconPath).resize({ width: 16, height: 16 });
    tray = new Tray(trayIcon);
    tray.setToolTip(`${APP_NAME} v${APP_VERSION}`);

    updateTrayMenu();

    tray.on('double-click', () => {
      if (mainWindow) {
        mainWindow.show();
        mainWindow.focus();
      }
    });

    logger.info('TRAY', 'System tray created');
  } catch (err) {
    logger.warn('TRAY', 'Tray creation failed:', err.message);
  }
}

function updateTrayMenu() {
  if (!tray) return;

  const lanActive = isLanActive();
  const lanUrl = getLanUrl();

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Show ADYX',
      click: () => {
        if (mainWindow) {
          mainWindow.show();
          mainWindow.focus();
        }
      },
    },
    { type: 'separator' },
    {
      label: 'Reload',
      click: () => {
        if (mainWindow) loadLocalApp();
      },
    },
    {
      label: 'Check for Updates',
      click: () => {
        if (mainWindow) checkForUpdates(mainWindow, false);
      },
    },
    { type: 'separator' },
    {
      label: lanActive ? `📱 LAN Mode: ON (${lanUrl})` : '📱 Enable LAN Mode (Mobile Access)',
      click: async () => {
        if (lanActive) {
          stopLanServer();
          logger.info('LAN', 'LAN mode disabled by user');
          updateTrayMenu();
        } else {
          const result = await dialog.showMessageBox(mainWindow, {
            type: 'warning',
            title: 'Enable LAN Mode',
            message: 'Share ADYX on your local network?',
            detail: 'This will make ADYX accessible to any device on your Wi-Fi.\nOnly enable this on trusted networks (home/office).\n\nMobile devices can open the URL shown in the tray menu.',
            buttons: ['Enable', 'Cancel'],
            defaultId: 0,
            cancelId: 1,
          });

          if (result.response === 0) {
            try {
              const appDir = path.join(__dirname, 'app');
              const info = await startLanServer(appDir, backendPort);
              logger.info('LAN', `LAN mode enabled: ${info.url}`);
              updateTrayMenu();

              dialog.showMessageBox(mainWindow, {
                type: 'info',
                title: 'LAN Mode Active',
                message: `ADYX is now accessible on your network!`,
                detail: `Open this URL on your phone:\n\n${info.url}\n\nMake sure your phone is on the same Wi-Fi.`,
                buttons: ['OK'],
              });
            } catch (err) {
              logger.error('LAN', 'Failed to start LAN server:', err.message);
              dialog.showErrorBox('LAN Mode Failed', `Could not start LAN server: ${err.message}`);
            }
          }
        }
      },
    },
    {
      label: lanActive ? '  Copy LAN URL' : '  (LAN mode off)',
      enabled: lanActive,
      click: () => {
        if (lanUrl) {
          require('electron').clipboard.writeText(lanUrl);
          logger.info('LAN', `URL copied to clipboard: ${lanUrl}`);
        }
      },
    },
    { type: 'separator' },
    {
      label: `v${APP_VERSION}`,
      enabled: false,
    },
    {
      label: 'Open Logs Folder',
      click: () => {
        const logPath = logger.getLogPath();
        if (logPath) shell.openPath(logPath);
      },
    },
    {
      label: 'Quit ADYX',
      click: () => {
        isQuitting = true;
        app.quit();
      },
    },
  ]);

  tray.setContextMenu(contextMenu);
}

// ── IPC Handlers ───────────────────────────────────────────

// App info
ipcMain.handle('get-backend-port', () => backendPort);
ipcMain.handle('get-app-version', () => APP_VERSION);
ipcMain.handle('get-log-path', () => logger.getLogPath());
ipcMain.handle('get-relay-url', () => {
  const config = require('./config');
  return config.RELAY_URL;
});

// Window controls
ipcMain.on('retry-load', () => {
  logger.info('IPC', 'Retry requested from loading screen');
  loadLocalApp();
});
ipcMain.on('check-for-updates', () => {
  if (mainWindow) checkForUpdates(mainWindow, false);
});
ipcMain.on('window-minimize', () => mainWindow?.minimize());
ipcMain.on('window-maximize', () => {
  if (mainWindow?.isMaximized()) mainWindow.unmaximize();
  else mainWindow?.maximize();
});
ipcMain.on('window-close', () => mainWindow?.close());

// Chat history — with input validation
ipcMain.handle('save-chat-message', (event, roomCode, message) => {
  if (typeof roomCode !== 'string' || !roomCode) return false;
  if (!message || typeof message !== 'object') return false;
  return saveMessage(roomCode, message);
});
ipcMain.handle('get-chat-history', (event, roomCode) => {
  if (typeof roomCode !== 'string' || !roomCode) return [];
  return getHistory(roomCode);
});
ipcMain.handle('clear-chat-history', (event, roomCode) => {
  if (typeof roomCode !== 'string' || !roomCode) return false;
  return clearHistory(roomCode);
});
ipcMain.handle('clear-all-history', () => {
  return clearAllHistory();
});
ipcMain.handle('list-chat-history', () => {
  return listHistory();
});

// LAN mode
ipcMain.handle('toggle-lan-mode', async () => {
  try {
    if (isLanActive()) {
      stopLanServer();
      updateTrayMenu();
      return { active: false, url: null };
    } else {
      const appDir = path.join(__dirname, 'app');
      const info = await startLanServer(appDir, backendPort);
      updateTrayMenu();
      return { active: true, url: info.url };
    }
  } catch (err) {
    logger.error('LAN', `Toggle failed: ${err.message}`);
    return { active: false, url: null, error: err.message };
  }
});
ipcMain.handle('get-lan-status', () => {
  return { active: isLanActive(), url: getLanUrl() };
});

// QR / Sharing — with input validation
ipcMain.handle('generate-room-qr', (event, roomCode) => {
  if (typeof roomCode !== 'string' || !roomCode) return null;
  const lanUrl = getLanUrl();
  return generateShareLinks(roomCode, lanUrl);
});
ipcMain.handle('generate-qr', (event, text) => {
  if (typeof text !== 'string' || !text) return null;
  return generateQR(text);
});

// ── App Lifecycle ──────────────────────────────────────────
app.on('ready', async () => {
  logger.info('APP', 'App ready event fired');
  createWindow();

  try {
    backendPort = await startEmbeddedServer();
    logger.info('APP', `Embedded backend ready on port ${backendPort}`);
    if (mainWindow) {
      setTimeout(() => loadLocalApp(), 1000);
    }
  } catch (err) {
    logger.error('APP', 'Failed to start embedded backend:', err.message);
    if (mainWindow) {
      mainWindow.loadFile(path.join(__dirname, 'loading.html'), {
        query: { error: 'true', message: 'Failed to start internal ADYX server' }
      });
    }
  }

  // Auto-update check (silent, packaged only)
  if (app.isPackaged && mainWindow) {
    scheduleUpdateCheck(mainWindow);
  }
});

// ── Handle deep link on second instance (Windows) ──
app.on('second-instance', (event, commandLine) => {
  logger.info('APP', 'Second instance detected');
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
  }

  // Check if launched with adyx:// URL
  const deepLinkUrl = commandLine.find(arg => arg.startsWith('adyx://'));
  if (deepLinkUrl) {
    handleDeepLink(deepLinkUrl);
  }
});

// ── Handle deep link on macOS ──
app.on('open-url', (event, url) => {
  event.preventDefault();
  handleDeepLink(url);
});

app.on('before-quit', () => {
  logger.info('APP', 'App quitting...');
  isQuitting = true;
  stopLanServer();
  stopEmbeddedServer();
  logger.close();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  } else {
    mainWindow.show();
  }
});

// ── Security: Block permission requests except necessary ones ──
app.on('web-contents-created', (event, contents) => {
  contents.session.setPermissionRequestHandler((webContents, permission, callback) => {
    const allowed = ['clipboard-read', 'clipboard-sanitized-write', 'notifications', 'media'];
    callback(allowed.includes(permission));
  });
});
