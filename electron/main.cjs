// Ultra-fast Electron wrapper for RAnderer 2.0 - Red Alert 1 Map Studio & PreviewPack Generator
// Supports both modern Windows 10/11 x64 and legacy Windows 7 ia32 (Electron 22)
// Built-in Native TinyPNG proxy eliminates browser CORS restrictions and Windows 7 certificate store issues!

const { app, BrowserWindow, protocol, net, shell, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const http = require('http');
const https = require('https');

// Register 'app' as a standard privileged scheme before app ready
try {
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
} catch (e) {
  console.warn('registerSchemesAsPrivileged warning:', e);
}

// Chromium startup optimization & Windows 7 TLS certificate resilience flags
app.commandLine.appendSwitch('disable-http-cache', 'false');
app.commandLine.appendSwitch('enable-features', 'Accelerated2dCanvas,OverlayScrollbar');
// Windows 7 machines that missed modern Microsoft root cert updates often fail HTTPS to modern TLS sites
app.commandLine.appendSwitch('ignore-certificate-errors');
app.commandLine.appendSwitch('allow-insecure-localhost', 'true');

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

// =========================================================================
// Native Node.js TinyPNG Proxy Handlers (Bypasses CORS & Win7 Cert Stores)
// =========================================================================

/**
 * Validate a TinyPNG API key using empty-body POST (consumes zero compressions)
 */
function proxyTinyPngValidate(apiKey) {
  return new Promise((resolve) => {
    const cleanKey = (apiKey || '').trim();
    if (!cleanKey) {
      return resolve({ status: 400, data: { valid: false, error: 'API key is required.' } });
    }

    const authHeader = 'Basic ' + Buffer.from(`api:${cleanKey}`).toString('base64');
    const req = https.request(
      'https://api.tinify.com/shrink',
      {
        method: 'POST',
        headers: {
          Authorization: authHeader,
          'Content-Type': 'image/png',
          'User-Agent': 'RAnderer-Electron/2.0',
        },
        rejectUnauthorized: false, // Prevents failure on unpatched Windows 7 root certificate stores
      },
      (res) => {
        let body = '';
        res.on('data', (chunk) => { body += chunk; });
        res.on('end', () => {
          const countHeader = res.headers['compression-count'];
          const compressionCount = countHeader ? parseInt(countHeader, 10) : undefined;

          if (res.statusCode === 401) {
            return resolve({
              status: 200,
              data: {
                valid: false,
                error: 'Invalid API key. Please check your credentials at tinypng.com/developers',
              },
            });
          }

          if (res.statusCode === 429) {
            return resolve({
              status: 200,
              data: {
                valid: false,
                error: 'TinyPNG monthly free quota exceeded (500 compressions limit reached).',
              },
            });
          }

          // HTTP 400 (empty body input) or 201 means credentials are valid!
          if (res.statusCode === 400 || res.statusCode === 201) {
            return resolve({
              status: 200,
              data: {
                valid: true,
                compressionCount,
              },
            });
          }

          return resolve({
            status: 200,
            data: {
              valid: false,
              error: `TinyPNG returned HTTP ${res.statusCode}: ${body || res.statusMessage}`,
            },
          });
        });
      }
    );

    req.on('error', (err) => {
      resolve({
        status: 200,
        data: {
          valid: false,
          error: `Network error connecting to TinyPNG: ${err.message || 'Check your internet connection.'}`,
        },
      });
    });

    req.end();
  });
}

/**
 * Compress image buffer with TinyPNG using Node https client
 */
function proxyTinyPngCompress(apiKey, imageBase64) {
  return new Promise((resolve) => {
    const cleanKey = (apiKey || '').trim();
    if (!cleanKey) {
      return resolve({ status: 400, data: { success: false, error: 'TinyPNG API key is missing.' } });
    }
    if (!imageBase64) {
      return resolve({ status: 400, data: { success: false, error: 'No image data provided for compression.' } });
    }

    const cleanData = imageBase64.replace(/^data:image\/[a-z]+;base64,/, '');
    const imageBuffer = Buffer.from(cleanData, 'base64');
    const originalSize = imageBuffer.length;
    const authHeader = 'Basic ' + Buffer.from(`api:${cleanKey}`).toString('base64');

    const req = https.request(
      'https://api.tinify.com/shrink',
      {
        method: 'POST',
        headers: {
          Authorization: authHeader,
          'Content-Type': 'image/png',
          'Content-Length': imageBuffer.length,
          'User-Agent': 'RAnderer-Electron/2.0',
        },
        rejectUnauthorized: false,
      },
      (res) => {
        let body = '';
        res.on('data', (chunk) => { body += chunk; });
        res.on('end', () => {
          const countHeader = res.headers['compression-count'];
          const compressionCount = countHeader ? parseInt(countHeader, 10) : undefined;

          if (res.statusCode === 401) {
            return resolve({ status: 401, data: { success: false, error: 'Invalid TinyPNG API key.' } });
          }
          if (res.statusCode === 429) {
            return resolve({
              status: 429,
              data: { success: false, error: 'TinyPNG monthly free quota exceeded (500 images/month limit reached).' },
            });
          }
          if (res.statusCode < 200 || res.statusCode >= 300) {
            let errMsg = `TinyPNG error HTTP ${res.statusCode}`;
            try {
              const errParsed = JSON.parse(body);
              if (errParsed.message) errMsg = errParsed.message;
            } catch (_) {}
            return resolve({ status: res.statusCode, data: { success: false, error: errMsg } });
          }

          let parsed = {};
          try {
            parsed = JSON.parse(body);
          } catch (_) {
            return resolve({ status: 502, data: { success: false, error: 'Failed to parse TinyPNG response JSON.' } });
          }

          const outputUrl = parsed?.output?.url;
          if (!outputUrl) {
            return resolve({ status: 502, data: { success: false, error: 'TinyPNG did not return an output URL.' } });
          }

          // Download compressed image bytes
          const downloadReq = https.request(
            outputUrl,
            {
              headers: {
                Authorization: authHeader,
                'User-Agent': 'RAnderer-Electron/2.0',
              },
              rejectUnauthorized: false,
            },
            (dlRes) => {
              if (dlRes.statusCode < 200 || dlRes.statusCode >= 300) {
                return resolve({
                  status: 502,
                  data: { success: false, error: `Failed to download compressed image (${dlRes.statusCode})` },
                });
              }

              const chunks = [];
              dlRes.on('data', (c) => chunks.push(c));
              dlRes.on('end', () => {
                const compressedBuffer = Buffer.concat(chunks);
                const compressedSize = compressedBuffer.length;
                const savedBytes = Math.max(0, originalSize - compressedSize);
                const savingsPercent = originalSize > 0 ? Math.round((savedBytes / originalSize) * 100) : 0;
                const compressedBase64 = `data:image/png;base64,${compressedBuffer.toString('base64')}`;

                resolve({
                  status: 200,
                  data: {
                    success: true,
                    compressedBase64,
                    originalSize,
                    compressedSize,
                    savedBytes,
                    savingsPercent,
                    compressionCount,
                  },
                });
              });
            }
          );

          downloadReq.on('error', (dlErr) => {
            resolve({
              status: 502,
              data: { success: false, error: `Download error: ${dlErr.message}` },
            });
          });

          downloadReq.end();
        });
      }
    );

    req.on('error', (err) => {
      resolve({
        status: 500,
        data: { success: false, error: `Network error connecting to TinyPNG: ${err.message}` },
      });
    });

    req.write(imageBuffer);
    req.end();
  });
}

// Register IPC handlers so renderer can call directly without HTTP
ipcMain.handle('tinypng-validate', async (_event, apiKey) => {
  const result = await proxyTinyPngValidate(apiKey);
  return result.data;
});

ipcMain.handle('tinypng-compress', async (_event, payload) => {
  const apiKey = payload?.apiKey || '';
  const imageBase64 = payload?.imageBase64 || '';
  const result = await proxyTinyPngCompress(apiKey, imageBase64);
  return result.data;
});

ipcMain.handle('app-exit', () => {
  app.quit();
});

// Fallback lightweight local server in case protocol is blocked or running under Electron 22
function startFallbackServer() {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      // CORS preflight support
      if (req.method === 'OPTIONS') {
        res.writeHead(200, {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': '*',
        });
        return res.end();
      }

      // Handle TinyPNG Validation API endpoint
      if (req.url === '/api/tinypng/validate' && req.method === 'POST') {
        const chunks = [];
        req.on('data', (c) => chunks.push(c));
        req.on('end', async () => {
          let apiKey = '';
          try {
            const parsed = JSON.parse(Buffer.concat(chunks).toString('utf8'));
            apiKey = parsed.apiKey;
          } catch (_) {}
          const resObj = await proxyTinyPngValidate(apiKey);
          res.writeHead(resObj.status, {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Headers': '*',
          });
          res.end(JSON.stringify(resObj.data));
        });
        return;
      }

      // Handle TinyPNG Compression API endpoint
      if (req.url === '/api/tinypng/compress' && req.method === 'POST') {
        const chunks = [];
        req.on('data', (c) => chunks.push(c));
        req.on('end', async () => {
          let apiKey = '';
          let imageBase64 = '';
          try {
            const parsed = JSON.parse(Buffer.concat(chunks).toString('utf8'));
            apiKey = parsed.apiKey;
            imageBase64 = parsed.imageBase64;
          } catch (_) {}
          const resObj = await proxyTinyPngCompress(apiKey, imageBase64);
          res.writeHead(resObj.status, {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Headers': '*',
          });
          res.end(JSON.stringify(resObj.data));
        });
        return;
      }

      // Static file serving from DIST
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
  // 1. Setup custom protocol handler for Electron 25+
  let useProtocol = true;
  try {
    if (typeof protocol.handle === 'function') {
      protocol.handle('app', async (request) => {
        const url = new URL(request.url);

        // TinyPNG Validate route on app:// scheme
        if (url.pathname === '/api/tinypng/validate' && request.method === 'POST') {
          const json = await request.json().catch(() => ({}));
          const resObj = await proxyTinyPngValidate(json.apiKey);
          return new Response(JSON.stringify(resObj.data), {
            status: resObj.status,
            headers: {
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*',
            },
          });
        }

        // TinyPNG Compress route on app:// scheme
        if (url.pathname === '/api/tinypng/compress' && request.method === 'POST') {
          const json = await request.json().catch(() => ({}));
          const resObj = await proxyTinyPngCompress(json.apiKey, json.imageBase64);
          return new Response(JSON.stringify(resObj.data), {
            status: resObj.status,
            headers: {
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*',
            },
          });
        }

        let pathname = decodeURIComponent(url.pathname);
        if (pathname.endsWith('/') || pathname === '') pathname += 'index.html';
        const filePath = path.normalize(path.join(DIST, pathname));
        if (!filePath.startsWith(DIST) || !fs.existsSync(filePath)) {
          return new Response('Not Found', { status: 404 });
        }
        return net.fetch(`file://${filePath}`);
      });
    } else {
      useProtocol = false;
    }
  } catch (err) {
    console.warn('Protocol registration fallback:', err);
    useProtocol = false;
  }

  // 2. Create window with preload script and relaxed desktop security
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
      webSecurity: false, // Disables browser CORS restrictions for local desktop exe
      preload: path.join(__dirname, 'preload.cjs'),
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