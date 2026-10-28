// Ultra-fast Electron wrapper for RAnderer 2.0 - Red Alert 1 Map Studio & PreviewPack Generator
// Uses Electron custom privileged 'app://' protocol to load files directly from disk
// with ZERO network port binding, eliminating Windows Defender/Firewall socket inspection lag!

const { app, BrowserWindow, protocol, net, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const http = require('http');

// Register 'app' as a standard privileged scheme before app ready
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'app',
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true,
      stream: true,
      bypassCSP: true,
    },
  },
]);

// Chromium startup optimization flags for sub-second launch
app.commandLine.appendSwitch('disable-http-cache', 'false');
app.commandLine.appendSwitch('enable-features', 'Accelerated2dCanvas,OverlayScrollbar');

// Single-instance lock to prevent duplicate heavy background processes
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
  process.exit(0);
}

const DIST = path.join(__dirname, '..', 'dist');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.pack': 'application/octet-stream',
  '.zip': 'application/zip',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

// Fallback lightweight local server in case protocol is blocked
function startFallbackServer() {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      let rel = decodeURIComponent((req.url || '/').split('?')[0]);
      if (rel.endsWith('/')) rel += 'index.html';
      const file = path.normalize(path.join(DIST, rel));
      if (!file.startsWith(DIST)) {
        res.writeHead(403);
        return res.end();
      }
      fs.readFile(file, (err, data) => {
        if (err) {
          res.writeHead(404);
          return res.end('Not found');
        }
        res.writeHead(200, {
          'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream',
          'Access-Control-Allow-Origin': '*',
        });
        res.end(data);
      });
    });
    server.listen(0, '127.0.0.1', () => resolve(server.address().port));
  });
}

let mainWindow = null;

async function createWindow() {
  // 1. Setup custom protocol handler
  let useProtocol = true;
  try {
    protocol.handle('app', async (request) => {
      const url = new URL(request.url);
      let pathname = decodeURIComponent(url.pathname);
      if (pathname.endsWith('/') || pathname === '') pathname += 'index.html';
      const filePath = path.normalize(path.join(DIST, pathname));
      if (!filePath.startsWith(DIST) || !fs.existsSync(filePath)) {
        return new Response('Not Found', { status: 404 });
      }
      return net.fetch(`file://${filePath}`);
    });
  } catch (err) {
    console.warn('Protocol registration fallback:', err);
    useProtocol = false;
  }

  // 2. Create window with dark background and show: false for zero white-flash
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 960,
    minHeight: 640,
    backgroundColor: '#0a0a0c',
    show: false,
    autoHideMenuBar: true,
    title: 'RAnderer 2.0',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: true,
    },
  });

  // Open external links in default browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  // Show window immediately once initial paint is ready for instant perceived startup
  mainWindow.once('ready-to-show', () => {
    if (mainWindow) {
      mainWindow.show();
      mainWindow.focus();
    }
  });

  if (useProtocol) {
    mainWindow.loadURL('app://bundle/index.html').catch(async () => {
      // Fallback to local HTTP if needed
      const port = await startFallbackServer();
      if (mainWindow) mainWindow.loadURL(`http://127.0.0.1:${port}/`);
    });
  } else {
    const port = await startFallbackServer();
    mainWindow.loadURL(`http://127.0.0.1:${port}/`);
  }
}

app.whenReady().then(createWindow);

app.on('second-instance', () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});