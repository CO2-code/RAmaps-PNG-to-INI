import express, { Request, Response } from 'express';
import http from 'http';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const port = parseInt(process.env.PORT || '3000', 10);
  const isDev = process.env.NODE_ENV !== 'production';

  // Increase payload limit for raw image uploads & base64
  app.use(express.json({ limit: '64mb' }));
  app.use(express.urlencoded({ extended: true, limit: '64mb' }));

  // ==========================================
  // TinyPNG Server-Side Proxy Endpoints
  // Bypasses browser CORS & iframe header limits
  // ==========================================

  // 1. Validate TinyPNG API Key (Zero compressions consumed!)
  app.post('/api/tinypng/validate', async (req: Request, res: Response) => {
    try {
      const apiKey = (req.body?.apiKey || '').trim();
      if (!apiKey) {
        return res.status(400).json({ valid: false, error: 'API key is required.' });
      }

      const authHeader = 'Basic ' + Buffer.from(`api:${apiKey}`).toString('base64');
      const response = await fetch('https://api.tinify.com/shrink', {
        method: 'POST',
        headers: {
          Authorization: authHeader,
          'Content-Type': 'image/png',
        },
        body: '', // Empty body: TinyPNG will return 400 Bad Request if key is VALID, 401 if INVALID
      });

      const countHeader = response.headers.get('compression-count');
      const compressionCount = countHeader ? parseInt(countHeader, 10) : undefined;

      if (response.status === 401) {
        return res.json({
          valid: false,
          error: 'Invalid API key. Please check your credentials at tinypng.com/developers',
        });
      }

      if (response.status === 429) {
        return res.json({
          valid: false,
          error: 'TinyPNG monthly free quota exceeded (500 compressions limit reached).',
        });
      }

      // HTTP 400 (no input image) or 201 means authentication succeeded!
      if (response.status === 400 || response.status === 201) {
        return res.json({
          valid: true,
          compressionCount,
        });
      }

      const text = await response.text().catch(() => '');
      return res.json({
        valid: false,
        error: `TinyPNG returned HTTP ${response.status}: ${text || response.statusText}`,
      });
    } catch (err) {
      console.error('Error validating TinyPNG key:', err);
      return res.status(500).json({
        valid: false,
        error: err instanceof Error ? err.message : 'Server failed to connect to TinyPNG API.',
      });
    }
  });

  // 2. Compress PNG Image via TinyPNG
  app.post('/api/tinypng/compress', async (req: Request, res: Response) => {
    try {
      const apiKey = (req.body?.apiKey || '').trim();
      const imageBase64 = req.body?.imageBase64 || '';

      if (!apiKey) {
        return res.status(400).json({ success: false, error: 'TinyPNG API key is missing.' });
      }

      if (!imageBase64) {
        return res.status(400).json({ success: false, error: 'No image data provided for compression.' });
      }

      // Strip potential DataURL prefix (e.g. data:image/png;base64,...)
      const cleanBase64 = imageBase64.replace(/^data:image\/[a-z]+;base64,/, '');
      const imageBuffer = Buffer.from(cleanBase64, 'base64');
      const originalSize = imageBuffer.length;

      const authHeader = 'Basic ' + Buffer.from(`api:${apiKey}`).toString('base64');

      const shrinkResponse = await fetch('https://api.tinify.com/shrink', {
        method: 'POST',
        headers: {
          Authorization: authHeader,
          'Content-Type': 'image/png',
        },
        body: imageBuffer,
      });

      const countHeader = shrinkResponse.headers.get('compression-count');
      const compressionCount = countHeader ? parseInt(countHeader, 10) : undefined;

      if (shrinkResponse.status === 401) {
        return res.status(401).json({
          success: false,
          error: 'Invalid TinyPNG API key.',
        });
      }

      if (shrinkResponse.status === 429) {
        return res.status(429).json({
          success: false,
          error: 'TinyPNG monthly free quota exceeded (500 images/month limit reached).',
        });
      }

      if (!shrinkResponse.ok) {
        const errorData = await shrinkResponse.json().catch(() => null);
        const errMsg = errorData?.message || `TinyPNG error HTTP ${shrinkResponse.status}`;
        return res.status(shrinkResponse.status).json({ success: false, error: errMsg });
      }

      const shrinkData = (await shrinkResponse.json()) as { output?: { url?: string; size?: number } };
      const outputUrl = shrinkData?.output?.url;

      if (!outputUrl) {
        return res.status(502).json({ success: false, error: 'TinyPNG did not provide a download URL.' });
      }

      // Download the compressed image from TinyPNG
      const downloadResponse = await fetch(outputUrl, {
        headers: {
          Authorization: authHeader,
        },
      });

      if (!downloadResponse.ok) {
        return res.status(502).json({
          success: false,
          error: `Failed to download compressed image from TinyPNG (${downloadResponse.status})`,
        });
      }

      const compressedArrayBuffer = await downloadResponse.arrayBuffer();
      const compressedBuffer = Buffer.from(compressedArrayBuffer);
      const compressedSize = compressedBuffer.length;
      const savedBytes = Math.max(0, originalSize - compressedSize);
      const savingsPercent = originalSize > 0 ? Math.round((savedBytes / originalSize) * 100) : 0;
      const compressedBase64 = `data:image/png;base64,${compressedBuffer.toString('base64')}`;

      return res.json({
        success: true,
        compressedBase64,
        originalSize,
        compressedSize,
        savedBytes,
        savingsPercent,
        compressionCount,
      });
    } catch (err) {
      console.error('Error compressing image with TinyPNG:', err);
      return res.status(500).json({
        success: false,
        error: err instanceof Error ? err.message : 'Server encountered an error while compressing image.',
      });
    }
  });

  // ==========================================
  // Vite Integration (Dev Middleware / Prod Static)
  // ==========================================
  const distPath = path.resolve(__dirname, 'dist');
  const hasDist = fs.existsSync(distPath);

  const httpServer = http.createServer(app);

  if (isDev || !hasDist) {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: {
          server: httpServer,
        },
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  httpServer.listen(port, '0.0.0.0', () => {
    console.log(`RAnderer server running at http://0.0.0.0:${port}`);
  });
}

startServer().catch((err) => {
  console.error('Fatal server startup error:', err);
  process.exit(1);
});
