import { ConversionOptions, ConversionResult, DecodedPreview, PaletteId } from '../types';
import { PALETTES, quantizeImageTo8Bit, convertToRGB565 } from './palettes';
import { LCW } from './lcw';
import { compressCncNetLzo24Bit, decompressCncNetLzo24Bit } from './lzo';

/**
 * Encodes a Uint8Array to a Base64 string (browser-safe & high-performance)
 * Chunked processing prevents call stack overflow and memory thrashing on large HD images.
 */
const B64_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

/**
 * Encodes a Uint8Array to a Base64 string (browser-safe, zero-copy lookup table)
 * Avoids String.fromCharCode concatenation and btoa() call limits on large HD images.
 */
export function bytesToBase64(bytes: Uint8Array): string {
  const len = bytes.length;
  if (len === 0) return '';

  const extra = len % 3;
  const mainLen = len - extra;
  const CHUNK_BYTES = 3 * 8192; // 24,576 raw bytes -> 32,768 Base64 chars
  const chunks: string[] = [];

  for (let i = 0; i < mainLen; i += CHUNK_BYTES) {
    const end = Math.min(i + CHUNK_BYTES, mainLen);
    let chunkStr = '';
    for (let j = i; j < end; j += 3) {
      const b0 = bytes[j];
      const b1 = bytes[j + 1];
      const b2 = bytes[j + 2];
      chunkStr +=
        B64_CHARS[b0 >> 2] +
        B64_CHARS[((b0 & 3) << 4) | (b1 >> 4)] +
        B64_CHARS[((b1 & 15) << 2) | (b2 >> 6)] +
        B64_CHARS[b2 & 63];
    }
    chunks.push(chunkStr);
  }

  if (extra === 1) {
    const b0 = bytes[mainLen];
    chunks.push(B64_CHARS[b0 >> 2] + B64_CHARS[(b0 & 3) << 4] + '==');
  } else if (extra === 2) {
    const b0 = bytes[mainLen];
    const b1 = bytes[mainLen + 1];
    chunks.push(
      B64_CHARS[b0 >> 2] +
        B64_CHARS[((b0 & 3) << 4) | (b1 >> 4)] +
        B64_CHARS[(b1 & 15) << 2] +
        '='
    );
  }

  return chunks.join('');
}

/**
 * Decodes a Base64 string to a Uint8Array (browser-safe)
 */
export function base64ToBytes(base64: string): Uint8Array {
  // Strip non-base64 characters like whitespace or quotes
  const clean = base64.replace(/[^A-Za-z0-9+/=]/g, '');
  const binary = atob(clean);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * Chunks a Base64 string into numbered INI lines (1=..., 2=...)
 * Standard Westwood & Olaf van der Spek XCC Mixer chunk size is strictly 70 characters.
 * Chunked string aggregation avoids allocating hundreds of thousands of intermediate string objects.
 */
export function chunkIntoIniLines(base64: string, lineLength: number = 70): string[] {
  const totalLength = base64.length;
  if (totalLength === 0) return [];

  const lines: string[] = [];
  let lineNum = 1;

  for (let i = 0; i < totalLength; i += lineLength) {
    const chunk = base64.substring(i, i + lineLength);
    lines.push(`${lineNum}=${chunk}`);
    lineNum++;
  }

  return lines;
}

/**
 * Port of Olaf van der Spek's XCC Mixer (CXCCMixerView::copy_as_map_ts_preview):
 * https://github.com/OlafvdSpek/xcc
 *
 * Direct 1:1 implementation:
 * 1. Takes source image at full native dimensions (Size=0,0,width,height)
 * 2. Reads 24-bit TrueColor RGB (3 bytes per pixel: R, G, B)
 * 3. Compresses with LZO1X in 8192-byte chunks (Format 5) with 4-byte header:
 *    [uint16 LE size_in (compressed), uint16 LE size_out (uncompressed)]
 * 4. Encodes binary payload with Base64
 * 5. Emits [Preview] and [PreviewPack] with 70 characters per line
 */
export function convertPngToXccPreviewPack(
  canvas: HTMLCanvasElement,
  customDimensions?: { width: number; height: number }
): ConversionResult {
  const w = customDimensions?.width ?? canvas.width;
  const h = customDimensions?.height ?? canvas.height;

  return convertImageToPreviewPack(canvas, {
    width: w,
    height: h,
    palette: 'temperat',
    encoding: 'cncnet_lzo_24bit',
    dithering: false,
    lineLength: 70,
    includePreviewSection: true,
    compressionOptimization: 'max',
    maintainAspectRatio: true,
    colorNoiseReduction: false, // Pure raw 24-bit RGB888, exact match to XCC Mixer
    targetLineBudget: undefined,
  });
}

/**
 * Fast 3x3 unsharp-mask filter designed specifically for Red Alert 1 downsampled maps.
 * Restores razor-sharp high-frequency contrast along tile borders, tree foliage, ore gems, cliff ridges, and roads.
 */
export function applyUnsharpMask(
  imageData: ImageData,
  amount: number = 0.45,
  threshold: number = 1
): ImageData {
  const { width, height, data } = imageData;
  const output = new ImageData(new Uint8ClampedArray(data), width, height);
  const outData = output.data;

  // 3x3 Gaussian-approximating convolution kernel:
  // [1, 2, 1]
  // [2, 4, 2] / 16
  // [1, 2, 1]
  const kernel = [1, 2, 1, 2, 4, 2, 1, 2, 1];
  const kernelSum = 16;

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = (y * width + x) * 4;

      let rSum = 0;
      let gSum = 0;
      let bSum = 0;
      let k = 0;

      for (let ky = -1; ky <= 1; ky++) {
        for (let kx = -1; kx <= 1; kx++) {
          const pIdx = ((y + ky) * width + (x + kx)) * 4;
          const weight = kernel[k++];
          rSum += data[pIdx] * weight;
          gSum += data[pIdx + 1] * weight;
          bSum += data[pIdx + 2] * weight;
        }
      }

      const rBlur = rSum / kernelSum;
      const gBlur = gSum / kernelSum;
      const bBlur = bSum / kernelSum;

      const rDiff = data[idx] - rBlur;
      const gDiff = data[idx + 1] - gBlur;
      const bDiff = data[idx + 2] - bBlur;

      if (Math.abs(rDiff) >= threshold) {
        outData[idx] = Math.max(0, Math.min(255, Math.round(data[idx] + rDiff * amount)));
      }
      if (Math.abs(gDiff) >= threshold) {
        outData[idx + 1] = Math.max(0, Math.min(255, Math.round(data[idx + 1] + gDiff * amount)));
      }
      if (Math.abs(bDiff) >= threshold) {
        outData[idx + 2] = Math.max(0, Math.min(255, Math.round(data[idx + 2] + bDiff * amount)));
      }
      outData[idx + 3] = data[idx + 3];
    }
  }

  return output;
}

/**
 * Ultra-high-fidelity tactical map downsampler.
 * Avoids multi-stage blur accumulation (which turns fine tile details into mush)
 * by using an optimal two-pass downscale followed by calibrated unsharp-masking.
 */
export function downsampleCanvasHighQuality(
  sourceCanvas: HTMLCanvasElement,
  targetWidth: number,
  targetHeight: number,
  enableSharpening: boolean = true
): HTMLCanvasElement {
  const srcW = sourceCanvas.width;
  const srcH = sourceCanvas.height;

  // Exact 1:1 match -> return direct copy without any resampling or blur
  if (srcW === targetWidth && srcH === targetHeight) {
    const res = document.createElement('canvas');
    res.width = targetWidth;
    res.height = targetHeight;
    const ctx = res.getContext('2d');
    if (ctx) {
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(sourceCanvas, 0, 0);
    }
    return res;
  }

  // If target is larger than or equal to source, draw with high-quality smoothing
  if (srcW <= targetWidth && srcH <= targetHeight) {
    const res = document.createElement('canvas');
    res.width = targetWidth;
    res.height = targetHeight;
    const ctx = res.getContext('2d');
    if (ctx) {
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(sourceCanvas, 0, 0, targetWidth, targetHeight);
    }
    return res;
  }

  // For downsampling from high-resolution renders (e.g. 2000px-6000px down to 512px or 256px):
  // We perform an optimal two-pass downsample to avoid blur stacking:
  // Pass 1: Downscale to an intermediate 2x oversampled resolution (targetWidth * 2, targetHeight * 2)
  // Pass 2: Downscale to final target resolution
  // Pass 3: Apply calibrated unsharp mask to restore the crisp, tactile edge contrast of tiles and ore.
  let currentCanvas: HTMLCanvasElement = sourceCanvas;

  const scaleFactorW = srcW / targetWidth;
  const scaleFactorH = srcH / targetHeight;
  const maxScaleFactor = Math.max(scaleFactorW, scaleFactorH);

  if (maxScaleFactor > 2.5) {
    const interW = Math.round(targetWidth * 2);
    const interH = Math.round(targetHeight * 2);
    const interCanvas = document.createElement('canvas');
    interCanvas.width = interW;
    interCanvas.height = interH;
    const interCtx = interCanvas.getContext('2d');
    if (interCtx) {
      interCtx.imageSmoothingEnabled = true;
      interCtx.imageSmoothingQuality = 'high';
      interCtx.drawImage(sourceCanvas, 0, 0, interW, interH);
      currentCanvas = interCanvas;
    }
  }

  const finalCanvas = document.createElement('canvas');
  finalCanvas.width = targetWidth;
  finalCanvas.height = targetHeight;
  const fCtx = finalCanvas.getContext('2d');
  if (!fCtx) return finalCanvas;

  fCtx.imageSmoothingEnabled = true;
  fCtx.imageSmoothingQuality = 'high';
  fCtx.drawImage(currentCanvas, 0, 0, targetWidth, targetHeight);

  if (enableSharpening) {
    try {
      const imgData = fCtx.getImageData(0, 0, targetWidth, targetHeight);
      const sharpened = applyUnsharpMask(imgData, 0.45, 1);
      fCtx.putImageData(sharpened, 0, 0);
    } catch {
      // Fallback if origin isolation prevents getImageData
    }
  }

  return finalCanvas;
}

/**
 * Converts an HTML Image or Canvas into Red Alert 1 [Preview] and [PreviewPack] INI sections
 */
export function convertImageToPreviewPack(
  canvas: HTMLCanvasElement,
  options: ConversionOptions
): ConversionResult {
  const {
    width: requestedW,
    height: requestedH,
    palette: paletteId,
    encoding,
    dithering,
    lineLength,
    includePreviewSection,
    compressionOptimization,
    maintainAspectRatio = true,
    sharpening = true,
  } = options;

  let width = Math.max(16, Math.min(2048, Math.round(requestedW || 128)));
  let height = Math.max(16, Math.min(2048, Math.round(requestedH || 128)));

  // PROPORTIONAL ASPECT RATIO (ZERO LETTERBOXING):
  // When maintaining aspect ratio, adjust target width and height directly to match
  // the source map's aspect ratio perfectly!
  // This completely eliminates blurry black letterboxing bars and fills 100% of the
  // [Preview] rectangle with crisp map pixels.
  if (maintainAspectRatio && canvas.width > 0 && canvas.height > 0) {
    const srcAspect = canvas.width / canvas.height;
    const dstAspect = width / height;

    if (Math.abs(srcAspect - dstAspect) > 0.01) {
      if (srcAspect > dstAspect) {
        // Source is wider than requested box -> lock width, scale height proportionally to even integer
        height = Math.max(16, Math.round((width / srcAspect) / 2) * 2);
      } else {
        // Source is taller than requested box -> lock height, scale width proportionally to even integer
        width = Math.max(16, Math.round((height * srcAspect) / 2) * 2);
      }
    }
  }

  // Ensure both dimensions are even numbers for clean scanline alignment and optimal LZO chunking
  if (width % 2 !== 0) width++;
  if (height % 2 !== 0) height++;

  if (width * height > 1500000) {
    throw new Error(
      `Target preview dimensions (${width}×${height} = ${(width * height).toLocaleString()} pixels) exceed safe limits for Red Alert INI packs. Scale to 512px or 1024px to prevent browser OOM and multiplayer disconnects.`
    );
  }

  // Downsample source canvas to target dimensions with high-fidelity sharpening
  const offscreen = downsampleCanvasHighQuality(canvas, width, height, sharpening);
  const offCtx = offscreen.getContext('2d');
  if (!offCtx) throw new Error('Could not create offscreen canvas context');

  const srcImageData = offCtx.getImageData(0, 0, width, height);
  const pal = PALETTES[paletteId]?.colors || PALETTES.temperat.colors;

  let finalBytes: Uint8Array;
  let rawByteCount: number;
  let quantizedImageData: ImageData;
  let encodingName = '';

  if (encoding === 'cncnet_lzo_24bit') {
    // 24-bit RGB (3 bytes per pixel) compressed with LZO1X in 8KB blocks (xna-cncnet-client & XCC Mixer)
    rawByteCount = width * height * 3;
    const rgb24 = new Uint8Array(rawByteCount);
    const noiseFilter = !!options.colorNoiseReduction;

    for (let i = 0; i < width * height; i++) {
      let r = srcImageData.data[i * 4];
      let g = srcImageData.data[i * 4 + 1];
      let b = srcImageData.data[i * 4 + 2];

      if (noiseFilter) {
        // Clear subtle sensor/JPEG noise in lowest 2 bits (diff < 4/255, visually imperceptible)
        // This dramatically increases LZO repeating runs, slashing lines by up to 35%!
        r = r & 0xfc;
        g = g & 0xfc;
        b = b & 0xfc;
      }

      rgb24[i * 3] = r;
      rgb24[i * 3 + 1] = g;
      rgb24[i * 3 + 2] = b;
    }
    finalBytes = compressCncNetLzo24Bit(rgb24);
    quantizedImageData = srcImageData;
    encodingName = 'CnCNet XNA Client (LZO 24-bit RGB · XCC Standard)';
  } else if (encoding === 'lcw_8bit' || encoding === 'raw_8bit') {
    // 8-bit Indexed Color (1 byte per pixel)
    const res = quantizeImageTo8Bit(srcImageData, pal, dithering);
    rawByteCount = res.indices.length;
    quantizedImageData = res.quantizedImageData;

    if (encoding === 'lcw_8bit') {
      finalBytes = LCW.compress(res.indices, compressionOptimization);
      encodingName = 'Classic Red Alert 1 Engine (LCW 8-bit Indexed · Format80)';
    } else {
      finalBytes = res.indices;
      encodingName = 'Raw 8-bit Uncompressed (Palette Indexed)';
    }
  } else {
    // 16-bit RGB 565 mode
    const res = convertToRGB565(srcImageData);
    rawByteCount = res.buffer.length;
    quantizedImageData = res.previewImageData;
    finalBytes = LCW.compress(res.buffer, compressionOptimization);
    encodingName = 'Tiberian Sun / RA2 Vanilla (LCW 16-bit RGB 565)';
  }

  const base64 = bytesToBase64(finalBytes);
  const iniLines = chunkIntoIniLines(base64, lineLength);

  const previewSection = `[Preview]\nSize=0,0,${width},${height}`;
  const previewPackSection = `[PreviewPack]\n${iniLines.join('\n')}`;

  const fullIniText = includePreviewSection
    ? `${previewSection}\n\n${previewPackSection}`
    : previewPackSection;

  const compressionRatio = rawByteCount > 0 ? (finalBytes.length / rawByteCount) * 100 : 100;

  return {
    previewSection,
    previewPackSection,
    fullIniText,
    sourceWidth: canvas.width,
    sourceHeight: canvas.height,
    targetWidth: width,
    targetHeight: height,
    rawByteCount,
    compressedByteCount: finalBytes.length,
    lineCount: iniLines.length,
    compressionRatio,
    quantizedImageData,
    paletteColors: pal,
    encodingName,
  };
}

/**
 * Reverse-decodes a pasted [Preview] and [PreviewPack] INI block into an ImageData preview.
 * Supports both CnCNet LZO 24-bit RGB (XCC Mixer) and classic Westwood LCW (Format80).
 */
export function decodePreviewFromIni(
  iniText: string,
  paletteId: PaletteId = 'temperat'
): DecodedPreview {
  const lines = iniText.split(/\r?\n/);

  // 1. Extract dimensions from [Preview] Size=0,0,W,H
  let width = 128;
  let height = 128;
  let inPreview = false;
  let inPreviewPack = false;
  const base64Chunks: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith(';')) continue;

    if (trimmed.toLowerCase() === '[preview]') {
      inPreview = true;
      inPreviewPack = false;
      continue;
    }
    if (trimmed.toLowerCase() === '[previewpack]') {
      inPreviewPack = true;
      inPreview = false;
      continue;
    }
    if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
      inPreview = false;
      inPreviewPack = false;
      continue;
    }

    if (inPreview) {
      const match = trimmed.match(/size\s*=\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
      if (match) {
        width = parseInt(match[3], 10);
        height = parseInt(match[4], 10);
      } else {
        const wMatch = trimmed.match(/width\s*=\s*(\d+)/i);
        const hMatch = trimmed.match(/height\s*=\s*(\d+)/i);
        if (wMatch) width = parseInt(wMatch[1], 10);
        if (hMatch) height = parseInt(hMatch[1], 10);
      }
    }

    if (inPreviewPack) {
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx !== -1) {
        const val = trimmed.substring(eqIdx + 1).trim();
        base64Chunks.push(val);
      } else {
        base64Chunks.push(trimmed);
      }
    }
  }

  if (base64Chunks.length === 0) {
    throw new Error('No [PreviewPack] lines found in provided text.');
  }

  const fullBase64 = base64Chunks.join('');
  const compressedBytes = base64ToBytes(fullBase64);

  // Auto-detect CnCNet LZO 24-bit block header
  // First 4 bytes in CnCNet LZO format: uint16 sizeCompressed, uint16 sizeUncompressed (<= 8192)
  let isLzoCandidate = false;
  if (compressedBytes.length >= 4) {
    const sComp = compressedBytes[0] | (compressedBytes[1] << 8);
    const sUncomp = compressedBytes[2] | (compressedBytes[3] << 8);
    if (sComp > 0 && sComp < compressedBytes.length && sUncomp > 0 && sUncomp <= 8192) {
      isLzoCandidate = true;
    }
  }

  if (isLzoCandidate) {
    try {
      const imageData = decompressCncNetLzo24Bit(compressedBytes, width, height);
      return {
        width,
        height,
        imageData,
        encodingDetected: 'CnCNet XNA Client (LZO 24-bit RGB · XCC Standard)',
        lineCount: base64Chunks.length,
        compressedBytes: compressedBytes.length,
        uncompressedBytes: width * height * 3,
      };
    } catch {
      // Fallback to LCW
    }
  }

  // Fallback: Westwood LCW (Format80)
  let uncompressedBytes: Uint8Array;
  let encodingDetected = 'LCW Compressed 8-bit';

  try {
    const expectedPixels = width * height;
    const lcwAttempt = LCW.decompress(compressedBytes, expectedPixels * 2);

    if (lcwAttempt.length === expectedPixels) {
      uncompressedBytes = lcwAttempt;
      encodingDetected = 'LCW 8-bit Indexed';
    } else if (lcwAttempt.length === expectedPixels * 2) {
      uncompressedBytes = lcwAttempt;
      encodingDetected = 'LCW 16-bit RGB 565';
    } else if (compressedBytes.length === expectedPixels) {
      uncompressedBytes = compressedBytes;
      encodingDetected = 'Raw 8-bit Indexed';
    } else if (compressedBytes.length === expectedPixels * 2) {
      uncompressedBytes = compressedBytes;
      encodingDetected = 'Raw 16-bit RGB 565';
    } else {
      uncompressedBytes = lcwAttempt.length > 0 ? lcwAttempt : compressedBytes;
      encodingDetected = `LCW Format80 (${uncompressedBytes.length} bytes)`;
    }
  } catch {
    uncompressedBytes = compressedBytes;
    encodingDetected = 'Raw Bytes';
  }

  // Render to ImageData
  const pal = PALETTES[paletteId]?.colors || PALETTES.temperat.colors;
  const imageData = new ImageData(width, height);
  const totalPixels = width * height;

  if (encodingDetected.includes('16-bit') && uncompressedBytes.length >= totalPixels * 2) {
    for (let i = 0; i < totalPixels; i++) {
      const low = uncompressedBytes[i * 2];
      const high = uncompressedBytes[i * 2 + 1];
      const rgb16 = low | (high << 8);

      const r5 = (rgb16 >> 11) & 0x1f;
      const g6 = (rgb16 >> 5) & 0x3f;
      const b5 = rgb16 & 0x1f;

      imageData.data[i * 4] = Math.round((r5 * 255) / 31);
      imageData.data[i * 4 + 1] = Math.round((g6 * 255) / 63);
      imageData.data[i * 4 + 2] = Math.round((b5 * 255) / 31);
      imageData.data[i * 4 + 3] = 255;
    }
  } else {
    // 8-bit paletted
    for (let i = 0; i < totalPixels; i++) {
      const colorIndex = uncompressedBytes[i] || 0;
      const color = pal[colorIndex] || [0, 0, 0];
      imageData.data[i * 4] = color[0];
      imageData.data[i * 4 + 1] = color[1];
      imageData.data[i * 4 + 2] = color[2];
      imageData.data[i * 4 + 3] = 255;
    }
  }

  return {
    width,
    height,
    imageData,
    encodingDetected,
    lineCount: base64Chunks.length,
    compressedBytes: compressedBytes.length,
    uncompressedBytes: uncompressedBytes.length,
  };
}

/**
 * Injects or updates [Preview] and [PreviewPack] in an existing .mpr or .ini file.
 * Safely strips any existing [Preview] and [PreviewPack] sections (case-insensitive, CRLF safe)
 * and places the updated block immediately after [Basic] or [Map].
 */
export function injectPreviewIntoMapFile(
  mapFileText: string,
  previewBlockText: string
): string {
  if (!previewBlockText || !previewBlockText.trim()) {
    return mapFileText;
  }

  const isCrlf = mapFileText.includes('\r\n');
  const nl = isCrlf ? '\r\n' : '\n';
  const rawLines = mapFileText.replace(/\r\n/g, '\n').split('\n');

  // 1. Strip existing [Preview] and [PreviewPack] line by line safely
  let skipping = false;
  const cleanedLines: string[] = [];
  for (const line of rawLines) {
    const trimmed = line.trim();
    if (/^\[\s*(Preview|PreviewPack)\s*\]$/i.test(trimmed)) {
      skipping = true;
      continue;
    }
    if (skipping) {
      if (/^\[\s*[^\]]+\s*\]$/i.test(trimmed)) {
        skipping = false;
        cleanedLines.push(line);
      }
      continue;
    }
    cleanedLines.push(line);
  }

  const previewLines = previewBlockText.replace(/\r\n/g, '\n').trim().split('\n');

  // 2. Locate [Basic] section end (where the next section starts, or EOF)
  let basicHeaderIdx = -1;
  let basicEndIdx = -1;

  for (let i = 0; i < cleanedLines.length; i++) {
    const trimmed = cleanedLines[i].trim();
    if (/^\[\s*Basic\s*\]$/i.test(trimmed)) {
      basicHeaderIdx = i;
      continue;
    }
    if (basicHeaderIdx !== -1 && /^\[\s*[^\]]+\s*\]$/i.test(trimmed)) {
      basicEndIdx = i;
      break;
    }
  }
  if (basicHeaderIdx !== -1 && basicEndIdx === -1) {
    basicEndIdx = cleanedLines.length;
  }

  if (basicEndIdx !== -1) {
    // Insert [Preview] & [PreviewPack] directly after [Basic] section ends
    const outputLines = [
      ...cleanedLines.slice(0, basicEndIdx),
      '',
      ...previewLines,
      '',
      ...cleanedLines.slice(basicEndIdx),
    ];
    return outputLines.join(nl);
  }

  // 3. Otherwise try inserting after [Map]
  let mapHeaderIdx = -1;
  let mapEndIdx = -1;

  for (let i = 0; i < cleanedLines.length; i++) {
    const trimmed = cleanedLines[i].trim();
    if (/^\[\s*Map\s*\]$/i.test(trimmed)) {
      mapHeaderIdx = i;
      continue;
    }
    if (mapHeaderIdx !== -1 && /^\[\s*[^\]]+\s*\]$/i.test(trimmed)) {
      mapEndIdx = i;
      break;
    }
  }
  if (mapHeaderIdx !== -1 && mapEndIdx === -1) {
    mapEndIdx = cleanedLines.length;
  }

  if (mapEndIdx !== -1) {
    const outputLines = [
      ...cleanedLines.slice(0, mapEndIdx),
      '',
      ...previewLines,
      '',
      ...cleanedLines.slice(mapEndIdx),
    ];
    return outputLines.join(nl);
  }

  // Fallback: prepend at beginning
  return [...previewLines, '', ...cleanedLines].join(nl);
}

/**
 * Strips [Preview] and [PreviewPack] sections from map file text
 */
export function stripPreviewFromMapFile(mapFileText: string): string {
  if (!mapFileText) return '';
  const isCrlf = mapFileText.includes('\r\n');
  const nl = isCrlf ? '\r\n' : '\n';
  const rawLines = mapFileText.replace(/\r\n/g, '\n').split('\n');

  let skipping = false;
  const cleanedLines: string[] = [];

  for (const line of rawLines) {
    const trimmed = line.trim();
    if (/^\[\s*(Preview|PreviewPack)\s*\]$/i.test(trimmed)) {
      skipping = true;
      continue;
    }
    if (skipping) {
      if (/^\[\s*[^\]]+\s*\]$/i.test(trimmed)) {
        skipping = false;
        cleanedLines.push(line);
      }
      continue;
    }
    cleanedLines.push(line);
  }

  return cleanedLines.join(nl) + nl;
}

/**
 * Calculates optimal width and height to fit within a target INI line budget
 * (e.g. 500, 1000, 2000 lines) while preserving the source aspect ratio.
 */
export function calculateDimensionsForLineBudget(
  sourceWidth: number,
  sourceHeight: number,
  targetLines: number,
  encoding: string = 'cncnet_lzo_24bit',
  lineLength: number = 70
): { width: number; height: number } {
  const safeW = sourceWidth > 0 ? sourceWidth : 128;
  const safeH = sourceHeight > 0 ? sourceHeight : 128;
  const aspectRatio = safeH / safeW;

  // Base64 chars = targetLines * lineLength
  // Compressed bytes = (Base64 chars * 3) / 4
  const targetCompressedBytes = (targetLines * lineLength * 3) / 4;

  // Estimated compression factor
  const compFactor = encoding === 'cncnet_lzo_24bit' ? 0.60 : 0.65;
  const bytesPerPixel = encoding === 'cncnet_lzo_24bit' ? 3 : (encoding === 'lcw_16bit' ? 2 : 1);

  const estimatedRawBytes = targetCompressedBytes / compFactor;
  const totalPixels = Math.max(256, Math.floor(estimatedRawBytes / bytesPerPixel));

  let w = Math.max(16, Math.round(Math.sqrt(totalPixels / aspectRatio) / 2) * 2);
  let h = Math.max(16, Math.round((w * aspectRatio) / 2) * 2);

  // Clamp within reasonable game bounds (min 16, max source size)
  w = Math.max(16, Math.min(safeW, w));
  h = Math.max(16, Math.min(safeH, h));
  if (w % 2 !== 0) w--;
  if (h % 2 !== 0) h--;

  return { width: Math.max(16, w), height: Math.max(16, h) };
}

/**
 * Calculates HD preview dimensions (width & height) from the map's [Map] Width and Height.
 * Preserves the exact aspect ratio of the map, scaling the largest dimension up to maxSize (default 256),
 * and rounds both dimensions to even numbers for clean pixel alignment and optimal LZO block compression.
 *
 * Example: Width=111, Height=28, maxSize=256 -> { width: 256, height: 64 }
 */
export function calculateMapHdDimensions(
  mapWidth: number,
  mapHeight: number,
  maxSize: number = 256
): { width: number; height: number } {
  const safeW = Number(mapWidth) > 0 ? Number(mapWidth) : 64;
  const safeH = Number(mapHeight) > 0 ? Number(mapHeight) : 64;
  const safeMax = maxSize > 0 ? maxSize : 256;

  const maxDim = Math.max(safeW, safeH);
  const scale = safeMax / maxDim;

  // Scale dimensions proportionally directly to the closest even integers (for clean graphics & LZO compression)
  let targetW = Math.max(16, Math.round((safeW * scale) / 2) * 2);
  let targetH = Math.max(16, Math.round((safeH * scale) / 2) * 2);

  // Clamp within safeMax while keeping even
  if (targetW > safeMax) targetW = safeMax % 2 === 0 ? safeMax : safeMax - 1;
  if (targetH > safeMax) targetH = safeMax % 2 === 0 ? safeMax : safeMax - 1;

  targetW = Math.max(16, targetW);
  targetH = Math.max(16, targetH);

  return { width: targetW, height: targetH };
}

/**
 * Extracts Map section info (Width, Height, X, Y, Theater) directly from map text
 */
export function extractMapSectionInfo(mapText: string): {
  width: number;
  height: number;
  x: number;
  y: number;
  theater: string;
} {
  let width = 64;
  let height = 64;
  let x = 1;
  let y = 1;
  let theater = 'TEMPERATE';

  if (!mapText) return { width, height, x, y, theater };

  const mapMatch = mapText.match(/\[Map\]([\s\S]*?)(?=\n\[|$)/i);
  if (mapMatch) {
    const lines = mapMatch[1].split(/\r?\n/);
    for (const line of lines) {
      const trimmed = line.trim();
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx !== -1) {
        const key = trimmed.substring(0, eqIdx).trim().toLowerCase();
        const val = trimmed.substring(eqIdx + 1).trim();
        if (key === 'width') {
          const parsed = parseInt(val, 10);
          if (!isNaN(parsed) && parsed > 0) width = parsed;
        } else if (key === 'height') {
          const parsed = parseInt(val, 10);
          if (!isNaN(parsed) && parsed > 0) height = parsed;
        } else if (key === 'x') {
          const parsed = parseInt(val, 10);
          if (!isNaN(parsed)) x = parsed;
        } else if (key === 'y') {
          const parsed = parseInt(val, 10);
          if (!isNaN(parsed)) y = parsed;
        } else if (key === 'theater') {
          theater = val.toUpperCase();
        }
      }
    }
  }

  return { width, height, x, y, theater };
}

