import { ConversionOptions, ConversionResult, DecodedPreview, PaletteId } from '../types';
import { PALETTES, quantizeImageTo8Bit, convertToRGB565 } from './palettes';
import { LCW } from './lcw';
import { compressCncNetLzo24Bit, decompressCncNetLzo24Bit } from './lzo';

/**
 * Encodes a Uint8Array to a Base64 string (browser-safe)
 */
export function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
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
 * Standard Westwood & XCC INI chunk size is 70 characters.
 */
export function chunkIntoIniLines(base64: string, lineLength: number = 70): string[] {
  const lines: string[] = [];
  let lineNum = 1;

  for (let i = 0; i < base64.length; i += lineLength) {
    const chunk = base64.substring(i, i + lineLength);
    lines.push(`${lineNum}=${chunk}`);
    lineNum++;
  }

  return lines;
}

/**
 * Converts an HTML Image or Canvas into Red Alert 1 [Preview] and [PreviewPack] INI sections
 */
export function convertImageToPreviewPack(
  canvas: HTMLCanvasElement,
  options: ConversionOptions
): ConversionResult {
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not access 2D canvas context');

  const {
    width,
    height,
    palette: paletteId,
    encoding,
    dithering,
    lineLength,
    includePreviewSection,
    compressionOptimization,
  } = options;

  // Scale / draw to target dimensions
  const offscreen = document.createElement('canvas');
  offscreen.width = width;
  offscreen.height = height;
  const offCtx = offscreen.getContext('2d');
  if (!offCtx) throw new Error('Could not create offscreen canvas');

  offCtx.imageSmoothingEnabled = true;
  offCtx.imageSmoothingQuality = 'high';
  offCtx.drawImage(canvas, 0, 0, width, height);

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
    for (let i = 0; i < width * height; i++) {
      rgb24[i * 3] = srcImageData.data[i * 4];
      rgb24[i * 3 + 1] = srcImageData.data[i * 4 + 1];
      rgb24[i * 3 + 2] = srcImageData.data[i * 4 + 2];
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
 * Injects or updates [Preview] and [PreviewPack] in an existing .mpr or .ini file
 */
export function injectPreviewIntoMapFile(
  mapFileText: string,
  previewBlockText: string
): string {
  const previewRegex = /\[Preview\][\s\S]*?(?=\n\[|$)/i;
  const previewPackRegex = /\[PreviewPack\][\s\S]*?(?=\n\[|$)/i;

  let cleaned = mapFileText;
  cleaned = cleaned.replace(previewRegex, '').replace(previewPackRegex, '').trim();

  // Insert right after [Basic] or [Map]
  const basicMatch = cleaned.match(/(\[Basic\][\s\S]*?\n)(?=\[|$)/i);
  if (basicMatch && basicMatch.index !== undefined) {
    const insertPos = basicMatch.index + basicMatch[0].length;
    return cleaned.slice(0, insertPos) + '\n' + previewBlockText + '\n\n' + cleaned.slice(insertPos);
  }

  const mapMatch = cleaned.match(/(\[Map\][\s\S]*?\n)(?=\[|$)/i);
  if (mapMatch && mapMatch.index !== undefined) {
    const insertPos = mapMatch.index + mapMatch[0].length;
    return cleaned.slice(0, insertPos) + '\n' + previewBlockText + '\n\n' + cleaned.slice(insertPos);
  }

  return previewBlockText + '\n\n' + cleaned;
}
