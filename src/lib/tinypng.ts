/**
 * TinyPNG (Tinify) Compression Service for RAnderer 2.0
 * Uses the official TinyPNG API to optimize PNG battlefield renders & preview images.
 */

const STORAGE_KEY = 'ra_tinypng_api_key';

export interface TinyPngResult {
  success: boolean;
  compressedBlob?: Blob;
  compressedUrl?: string;
  originalSize: number;
  compressedSize: number;
  savedBytes: number;
  savingsPercent: number;
  compressionCount?: number;
  error?: string;
}

/**
 * Retrieve saved TinyPNG API key from localStorage
 */
export function getTinyPngApiKey(): string {
  try {
    return localStorage.getItem(STORAGE_KEY) || '';
  } catch {
    return '';
  }
}

/**
 * Save TinyPNG API key to localStorage
 */
export function setTinyPngApiKey(key: string): void {
  try {
    const cleanKey = key.trim();
    if (cleanKey) {
      localStorage.setItem(STORAGE_KEY, cleanKey);
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  } catch (err) {
    console.warn('Failed to save TinyPNG API key to localStorage:', err);
  }
}

/**
 * Format bytes into human-readable size (e.g., 245.5 KB, 1.2 MB)
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

/**
 * Convert Canvas or DataURL to Blob
 */
export async function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('Failed to create Blob from canvas'));
    }, 'image/png');
  });
}

/**
 * Test if a TinyPNG API key is valid
 */
export async function validateTinyPngApiKey(apiKey: string): Promise<{ valid: boolean; compressionCount?: number; error?: string }> {
  const cleanKey = apiKey.trim();
  if (!cleanKey) {
    return { valid: false, error: 'API key cannot be empty' };
  }

  // Create a minimal 1x1 transparent PNG blob for verification
  const testCanvas = document.createElement('canvas');
  testCanvas.width = 1;
  testCanvas.height = 1;
  const blob = await canvasToBlob(testCanvas);

  try {
    const result = await compressWithTinyPng(blob, cleanKey);
    if (result.success) {
      return { valid: true, compressionCount: result.compressionCount };
    }
    return { valid: false, error: result.error || 'Failed to validate API key' };
  } catch (err) {
    return { valid: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * Compress a PNG Blob using TinyPNG API
 */
export async function compressWithTinyPng(
  imageBlob: Blob,
  customApiKey?: string
): Promise<TinyPngResult> {
  const apiKey = (customApiKey || getTinyPngApiKey()).trim();

  if (!apiKey) {
    return {
      success: false,
      originalSize: imageBlob.size,
      compressedSize: imageBlob.size,
      savedBytes: 0,
      savingsPercent: 0,
      error: 'TinyPNG API Key is missing. Please enter your free API key in Settings.',
    };
  }

  const originalSize = imageBlob.size;
  const authHeader = 'Basic ' + btoa('api:' + apiKey);

  // Candidate endpoints depending on environment:
  // 1. Local Vite dev proxy /api/tinypng/shrink (bypasses CORS in dev & fullstack)
  // 2. Direct https://api.tinify.com/shrink (works in Electron & server environments)
  // 3. Fallback CORS proxy for static web deployments (e.g. GitHub Pages)
  const candidateEndpoints = [
    '/api/tinypng/shrink',
    'https://api.tinify.com/shrink',
    `https://corsproxy.io/?url=${encodeURIComponent('https://api.tinify.com/shrink')}`,
  ];

  let lastError = '';

  for (const endpoint of candidateEndpoints) {
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          Authorization: authHeader,
          'Content-Type': 'image/png',
        },
        body: imageBlob,
      });

      if (response.status === 401) {
        return {
          success: false,
          originalSize,
          compressedSize: originalSize,
          savedBytes: 0,
          savingsPercent: 0,
          error: 'Invalid TinyPNG API key. Please check your key at tinypng.com/developers',
        };
      }

      if (response.status === 429) {
        return {
          success: false,
          originalSize,
          compressedSize: originalSize,
          savedBytes: 0,
          savingsPercent: 0,
          error: 'TinyPNG monthly free quota exceeded (500 images/month limit reached).',
        };
      }

      if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        lastError = `TinyPNG error HTTP ${response.status}: ${errorText || response.statusText}`;
        continue;
      }

      // Read compression count from response headers if available
      const countHeader = response.headers.get('Compression-Count');
      const compressionCount = countHeader ? parseInt(countHeader, 10) : undefined;

      // TinyPNG returns JSON metadata with the download URL in output.url
      const data = await response.json();
      const outputUrl = data?.output?.url;

      if (!outputUrl) {
        lastError = 'TinyPNG did not return an output URL.';
        continue;
      }

      // Fetch the compressed binary image from outputUrl
      let downloadEndpoint = outputUrl;
      // If we used the local proxy or CORS proxy, adapt download URL accordingly if needed
      if (endpoint.startsWith('/api/tinypng')) {
        downloadEndpoint = outputUrl.replace('https://api.tinify.com', '/api/tinypng');
      }

      let downloadRes = await fetch(downloadEndpoint, {
        headers: {
          Authorization: authHeader,
        },
      });

      if (!downloadRes.ok) {
        // Fallback to direct outputUrl
        downloadRes = await fetch(outputUrl, {
          headers: {
            Authorization: authHeader,
          },
        });
      }

      if (!downloadRes.ok) {
        lastError = `Failed to download compressed image from TinyPNG (${downloadRes.status})`;
        continue;
      }

      const compressedBlob = await downloadRes.blob();
      const compressedSize = compressedBlob.size;
      const savedBytes = Math.max(0, originalSize - compressedSize);
      const savingsPercent = originalSize > 0 ? Math.round((savedBytes / originalSize) * 100) : 0;
      const compressedUrl = URL.createObjectURL(compressedBlob);

      return {
        success: true,
        compressedBlob,
        compressedUrl,
        originalSize,
        compressedSize,
        savedBytes,
        savingsPercent,
        compressionCount,
      };
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
    }
  }

  return {
    success: false,
    originalSize,
    compressedSize: originalSize,
    savedBytes: 0,
    savingsPercent: 0,
    error: lastError || 'Network request to TinyPNG failed. Please verify your connection or API key.',
  };
}
