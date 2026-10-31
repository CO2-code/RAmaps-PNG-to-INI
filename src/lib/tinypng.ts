/**
 * TinyPNG (Tinify) Compression Service for RAnderer 2.0
 * Multi-layer architecture:
 * 1. Electron Native IPC bridge (Direct Node https, Zero CORS, Win7 CA-safe)
 * 2. Server-side proxy endpoints (/api/tinypng/*) for Express and Electron fallback server
 * 3. Direct browser fetch fallback (for CORS-enabled contexts)
 */

declare global {
  interface Window {
    electronAPI?: {
      isElectron?: boolean;
      validateTinyPng?: (apiKey: string) => Promise<{
        valid: boolean;
        compressionCount?: number;
        error?: string;
      }>;
      compressTinyPng?: (payload: {
        apiKey: string;
        imageBase64: string;
      }) => Promise<{
        success: boolean;
        compressedBase64?: string;
        originalSize?: number;
        compressedSize?: number;
        savedBytes?: number;
        savingsPercent?: number;
        compressionCount?: number;
        error?: string;
      }>;
      exitApp?: () => Promise<void>;
    };
  }
}

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
 * Helper to convert Blob to Base64 Data URL
 */
function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('Failed to convert Blob to base64.'));
      }
    };
    reader.onerror = () => reject(reader.error || new Error('FileReader error'));
    reader.readAsDataURL(blob);
  });
}

/**
 * Helper to convert Base64 Data URL to Blob
 */
async function base64ToBlob(base64Data: string): Promise<Blob> {
  const res = await fetch(base64Data);
  return await res.blob();
}

/**
 * Test if a TinyPNG API key is valid without consuming monthly compressions
 */
export async function validateTinyPngApiKey(
  apiKey: string
): Promise<{ valid: boolean; compressionCount?: number; error?: string }> {
  const cleanKey = apiKey.trim();
  if (!cleanKey) {
    return { valid: false, error: 'API key cannot be empty.' };
  }

  // 1. If running inside Electron desktop app, invoke native IPC bridge first
  // Eliminates browser CORS, Windows 7 SSL certificate expiry, and network port issues!
  if (typeof window !== 'undefined' && window.electronAPI?.validateTinyPng) {
    try {
      const ipcResult = await window.electronAPI.validateTinyPng(cleanKey);
      if (ipcResult) {
        return ipcResult;
      }
    } catch (ipcErr) {
      console.warn('Electron IPC validate route failed, falling back to HTTP:', ipcErr);
    }
  }

  // 2. Try server-side validation endpoint (bypasses browser CORS in Express and Electron fallback server)
  try {
    const response = await fetch('/api/tinypng/validate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ apiKey: cleanKey }),
    });

    if (response.ok) {
      const data = await response.json();
      return {
        valid: Boolean(data.valid),
        compressionCount: data.compressionCount,
        error: data.error,
      };
    }
  } catch (err) {
    console.warn('Server-side validate route unreachable, attempting direct validation:', err);
  }

  // 3. Fallback: Direct call to Tinify API (works when CORS is disabled or in permissive environments)
  try {
    const authHeader = 'Basic ' + btoa('api:' + cleanKey);
    const response = await fetch('https://api.tinify.com/shrink', {
      method: 'POST',
      headers: {
        Authorization: authHeader,
        'Content-Type': 'image/png',
      },
      body: '', // Empty body checks credentials without consuming an image compression
    });

    const countHeader = response.headers.get('compression-count');
    const compressionCount = countHeader ? parseInt(countHeader, 10) : undefined;

    if (response.status === 401) {
      return { valid: false, error: 'Invalid API key. Please check your key at tinypng.com/developers' };
    }
    if (response.status === 400 || response.status === 201) {
      return { valid: true, compressionCount };
    }
    if (response.status === 429) {
      return { valid: false, error: 'TinyPNG monthly free quota exceeded (500 limit reached).' };
    }

    return { valid: false, error: `TinyPNG returned status ${response.status}` };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    if (errorMsg.toLowerCase().includes('failed to fetch') || errorMsg.toLowerCase().includes('networkerror')) {
      return {
        valid: false,
        error: 'Network connection failed. Please verify your internet connection or firewall.',
      };
    }
    return {
      valid: false,
      error: errorMsg || 'Unable to connect to TinyPNG API.',
    };
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

  // 1. If running inside Electron desktop app, invoke native IPC bridge first
  // Zero CORS, zero payload size limits, zero TLS handshake issues on legacy Windows
  if (typeof window !== 'undefined' && window.electronAPI?.compressTinyPng) {
    try {
      const imageBase64 = await blobToBase64(imageBlob);
      const ipcResult = await window.electronAPI.compressTinyPng({
        apiKey,
        imageBase64,
      });

      if (ipcResult && ipcResult.success && ipcResult.compressedBase64) {
        const compressedBlob = await base64ToBlob(ipcResult.compressedBase64);
        const compressedUrl = URL.createObjectURL(compressedBlob);
        return {
          success: true,
          compressedBlob,
          compressedUrl,
          originalSize: ipcResult.originalSize || originalSize,
          compressedSize: ipcResult.compressedSize || compressedBlob.size,
          savedBytes: ipcResult.savedBytes || Math.max(0, originalSize - compressedBlob.size),
          savingsPercent: ipcResult.savingsPercent || 0,
          compressionCount: ipcResult.compressionCount,
        };
      } else if (ipcResult && ipcResult.error) {
        return {
          success: false,
          originalSize,
          compressedSize: originalSize,
          savedBytes: 0,
          savingsPercent: 0,
          error: ipcResult.error,
        };
      }
    } catch (ipcErr) {
      console.warn('Electron IPC compression failed, falling back to HTTP:', ipcErr);
    }
  }

  // 2. Try server-side compression endpoint (Express server or Electron fallback server)
  try {
    const imageBase64 = await blobToBase64(imageBlob);

    const response = await fetch('/api/tinypng/compress', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        apiKey,
        imageBase64,
      }),
    });

    if (response.ok) {
      const data = await response.json();
      if (data.success && data.compressedBase64) {
        const compressedBlob = await base64ToBlob(data.compressedBase64);
        const compressedUrl = URL.createObjectURL(compressedBlob);
        return {
          success: true,
          compressedBlob,
          compressedUrl,
          originalSize: data.originalSize || originalSize,
          compressedSize: data.compressedSize || compressedBlob.size,
          savedBytes: data.savedBytes || Math.max(0, originalSize - compressedBlob.size),
          savingsPercent: data.savingsPercent || 0,
          compressionCount: data.compressionCount,
        };
      } else {
        return {
          success: false,
          originalSize,
          compressedSize: originalSize,
          savedBytes: 0,
          savingsPercent: 0,
          error: data.error || 'TinyPNG compression failed.',
        };
      }
    } else {
      const errData = await response.json().catch(() => null);
      if (response.status === 401) {
        return {
          success: false,
          originalSize,
          compressedSize: originalSize,
          savedBytes: 0,
          savingsPercent: 0,
          error: 'Invalid TinyPNG API key. Please check your credentials.',
        };
      }
      if (errData?.error) {
        return {
          success: false,
          originalSize,
          compressedSize: originalSize,
          savedBytes: 0,
          savingsPercent: 0,
          error: errData.error,
        };
      }
    }
  } catch (err) {
    console.warn('Server compression route failed or unavailable, trying direct:', err);
  }

  // 3. Direct fallback (Direct call to Tinify)
  try {
    const authHeader = 'Basic ' + btoa('api:' + apiKey);
    const shrinkRes = await fetch('https://api.tinify.com/shrink', {
      method: 'POST',
      headers: {
        Authorization: authHeader,
        'Content-Type': 'image/png',
      },
      body: imageBlob,
    });

    if (shrinkRes.status === 401) {
      return {
        success: false,
        originalSize,
        compressedSize: originalSize,
        savedBytes: 0,
        savingsPercent: 0,
        error: 'Invalid TinyPNG API key.',
      };
    }

    if (!shrinkRes.ok) {
      const text = await shrinkRes.text().catch(() => '');
      return {
        success: false,
        originalSize,
        compressedSize: originalSize,
        savedBytes: 0,
        savingsPercent: 0,
        error: `TinyPNG error HTTP ${shrinkRes.status}: ${text}`,
      };
    }

    const data = await shrinkRes.json();
    const outputUrl = data?.output?.url;
    if (!outputUrl) {
      return {
        success: false,
        originalSize,
        compressedSize: originalSize,
        savedBytes: 0,
        savingsPercent: 0,
        error: 'TinyPNG returned invalid response structure.',
      };
    }

    const downloadRes = await fetch(outputUrl, {
      headers: { Authorization: authHeader },
    });
    if (!downloadRes.ok) {
      return {
        success: false,
        originalSize,
        compressedSize: originalSize,
        savedBytes: 0,
        savingsPercent: 0,
        error: `Failed to download compressed image (${downloadRes.status})`,
      };
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
    };
  } catch (directErr) {
    const errorMsg = directErr instanceof Error ? directErr.message : String(directErr);
    return {
      success: false,
      originalSize,
      compressedSize: originalSize,
      savedBytes: 0,
      savingsPercent: 0,
      error: errorMsg.toLowerCase().includes('failed to fetch')
        ? 'Connection to TinyPNG failed. Please check your internet connection.'
        : errorMsg || 'TinyPNG network request failed.',
    };
  }
}
