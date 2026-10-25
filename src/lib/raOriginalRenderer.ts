/**
 * Red Alert 1 Original Asset Engine & Renderer
 * Ported from Iran's RAFullMapPreviewGenerator (C# 2.0 / OpenRA)
 * Reads and renders authentic Westwood .tem (Template) files, .shp (Sprite) files,
 * and .pal (Palette) files directly from the game's original assets.
 */

import { MprMapData, decodeFormat80, nameFromOverlayByte } from './mprParser';
import { unzipSync } from 'fflate';

export interface RgbaColor {
  r: number;
  g: number;
  b: number;
  a: number;
}

export type Palette = RgbaColor[];

/**
 * Parses raw 768-byte VGA 6-bit palette file (temperat.pal, snow.pal, etc.)
 */
export function parsePalette(buf: Uint8Array): Palette {
  const pal: Palette = new Array(256);
  for (let i = 0; i < 256; i++) {
    const r = (buf[i * 3] << 2) & 0xff;
    const g = (buf[i * 3 + 1] << 2) & 0xff;
    const b = (buf[i * 3 + 2] << 2) & 0xff;
    // Index 0 is transparent in Westwood engines
    const a = i === 0 ? 0 : 255;
    pal[i] = { r, g, b, a };
  }
  // Shadow remap indices 3 & 4 (55% opacity black shadow)
  pal[3] = { r: 0, g: 0, b: 0, a: 140 };
  pal[4] = { r: 0, g: 0, b: 0, a: 140 };
  return pal;
}

/**
 * Canonical team remap colors for palette indices 80..95 from Iran's RAFullMapPreviewGenerator
 */
export const COLOR_REMAPS: Record<string, [number, number, number][]> = {
  Blue: [
    [226, 230, 246], [206, 210, 234], [182, 190, 222], [161, 170, 202],
    [141, 149, 186], [125, 133, 174], [105, 117, 161], [89, 105, 149],
    [68, 85, 137], [56, 72, 125], [48, 64, 117], [40, 56, 109],
    [32, 44, 97], [24, 44, 85], [12, 32, 68], [8, 20, 52],
  ],
  Red: [
    [255, 93, 0], [255, 0, 0], [238, 0, 0], [218, 0, 0],
    [206, 0, 0], [190, 0, 0], [178, 0, 0], [170, 0, 0],
    [149, 0, 0], [133, 0, 0], [117, 0, 0], [101, 0, 0],
    [93, 8, 0], [76, 0, 0], [56, 0, 0], [56, 0, 0],
  ],
  Green: [
    [255, 230, 149], [255, 230, 149], [198, 230, 133], [178, 210, 125],
    [157, 190, 117], [137, 174, 109], [121, 153, 101], [104, 137, 93],
    [89, 117, 76], [76, 101, 60], [60, 85, 48], [48, 68, 36],
    [36, 52, 24], [36, 52, 24], [24, 36, 16], [20, 20, 20],
  ],
  Orange: [
    [255, 230, 149], [255, 214, 125], [246, 198, 113], [238, 174, 85],
    [234, 161, 64], [230, 145, 40], [214, 121, 16], [198, 97, 0],
    [182, 72, 0], [165, 56, 0], [153, 40, 0], [133, 32, 0],
    [109, 16, 0], [93, 8, 0], [76, 0, 0], [56, 0, 0],
  ],
  Gray: [
    [238, 238, 238], [238, 226, 218], [222, 206, 198], [206, 186, 178],
    [186, 165, 153], [165, 145, 133], [149, 125, 113], [133, 113, 101],
    [113, 89, 80], [93, 72, 64], [80, 60, 52], [80, 60, 52],
    [60, 44, 40], [60, 44, 40], [44, 28, 24], [44, 28, 24],
  ],
  Teal: [
    [93, 194, 165], [93, 194, 165], [85, 178, 153], [85, 178, 153],
    [76, 161, 137], [68, 145, 125], [64, 133, 117], [56, 117, 109],
    [28, 109, 97], [24, 89, 76], [24, 89, 76], [28, 64, 64],
    [12, 52, 52], [12, 52, 52], [0, 32, 32], [0, 32, 32],
  ],
  Brown: [
    [210, 153, 125], [210, 153, 125], [194, 137, 105], [182, 113, 85],
    [174, 93, 68], [174, 93, 68], [153, 76, 56], [133, 64, 48],
    [113, 44, 36], [113, 44, 36], [97, 36, 28], [93, 8, 0],
    [76, 0, 0], [76, 0, 0], [56, 0, 0], [56, 0, 0],
  ],
  White: [
    [255, 255, 255], [225, 225, 225], [238, 238, 238], [238, 238, 238],
    [238, 238, 238], [174, 174, 174], [174, 174, 174], [161, 161, 161],
    [125, 125, 125], [113, 113, 113], [101, 101, 101], [101, 101, 101],
    [93, 93, 93], [93, 93, 93], [36, 36, 36], [20, 20, 20],
  ],
  Black: [
    [101, 101, 101], [93, 93, 93], [76, 76, 76], [76, 76, 76],
    [56, 56, 56], [56, 56, 56], [36, 36, 36], [36, 36, 36],
    [20, 20, 20], [20, 20, 20], [32, 28, 28], [20, 20, 24],
    [12, 16, 20], [12, 16, 20], [0, 0, 0], [0, 0, 0],
  ],
  FlamingBlue: [
    [226, 230, 246], [206, 210, 234], [182, 218, 255], [125, 190, 242],
    [68, 149, 230], [40, 121, 218], [36, 85, 206], [24, 68, 192],
    [20, 60, 157], [20, 60, 157], [16, 48, 137], [16, 48, 137],
    [24, 44, 85], [12, 32, 58], [8, 20, 52], [8, 20, 52],
  ],
};

export const DEFAULT_HOUSE_COLORS: Record<string, { primaryColor: string; secondaryColor: string }> = {
  spain: { primaryColor: 'Yellow', secondaryColor: 'Yellow' },
  greece: { primaryColor: 'Blue', secondaryColor: 'Blue' },
  ussr: { primaryColor: 'Red', secondaryColor: 'Red' },
  england: { primaryColor: 'Green', secondaryColor: 'Green' },
  ukraine: { primaryColor: 'Orange', secondaryColor: 'Orange' },
  germany: { primaryColor: 'Gray', secondaryColor: 'Gray' },
  france: { primaryColor: 'Teal', secondaryColor: 'Teal' },
  turkey: { primaryColor: 'Brown', secondaryColor: 'Brown' },
  special: { primaryColor: 'Yellow', secondaryColor: 'Yellow' },
  neutral: { primaryColor: 'Yellow', secondaryColor: 'Yellow' },
  goodguy: { primaryColor: 'Blue', secondaryColor: 'Blue' },
  badguy: { primaryColor: 'Red', secondaryColor: 'Red' },
  multi1: { primaryColor: 'Yellow', secondaryColor: 'Yellow' },
  multi2: { primaryColor: 'Blue', secondaryColor: 'Blue' },
  multi3: { primaryColor: 'Red', secondaryColor: 'Red' },
  multi4: { primaryColor: 'Green', secondaryColor: 'Green' },
  multi5: { primaryColor: 'Orange', secondaryColor: 'Orange' },
  multi6: { primaryColor: 'Gray', secondaryColor: 'Gray' },
  multi7: { primaryColor: 'Teal', secondaryColor: 'Teal' },
  multi8: { primaryColor: 'Brown', secondaryColor: 'Brown' },
};

export function remapForHouse(
  houseName: string,
  scheme: 'Primary' | 'Secondary',
  basePal: Palette,
  customHouseColors?: Record<string, { primaryColor: string; secondaryColor: string }>
): Palette {
  const hKey = (houseName || 'neutral').toLowerCase();
  const info = customHouseColors?.[hKey] || DEFAULT_HOUSE_COLORS[hKey] || { primaryColor: 'Red', secondaryColor: 'Red' };
  const colorName = scheme === 'Primary' ? info.primaryColor : info.secondaryColor;
  if (!colorName || colorName === 'Yellow' || colorName === 'None') {
    return basePal;
  }
  const remapTable = COLOR_REMAPS[colorName];
  if (!remapTable) return basePal;

  const newPal: Palette = basePal.map((c) => ({ ...c }));
  for (let i = 0; i < 16; i++) {
    const rgb = remapTable[i];
    if (rgb) {
      newPal[80 + i] = { r: rgb[0], g: rgb[1], b: rgb[2], a: 255 };
    }
  }
  return newPal;
}

// Backward-compatibility alias
export function getRemappedPalette(basePal: Palette, side: string): Palette {
  return remapForHouse(side, 'Primary', basePal);
}

/**
 * Decodes Format40 compression (used in .shp frames with XOR delta)
 */
export function decodeFormat40(src: Uint8Array, dest: Uint8Array): void {
  let srcPos = 0;
  let destIndex = 0;
  const srcLen = src.length;
  const destLen = dest.length;

  const readByte = (): number => (srcPos < srcLen ? src[srcPos++] : 0);
  const readWord = (): number => {
    const lo = readByte();
    const hi = readByte();
    return lo | (hi << 8);
  };

  while (srcPos < srcLen && destIndex < destLen) {
    const i = readByte();
    if ((i & 0x80) === 0) {
      const count = i & 0x7f;
      if (count === 0) {
        // case 6
        const c = readByte();
        const value = readByte();
        for (let end = destIndex + c; destIndex < end && destIndex < destLen; destIndex++) {
          dest[destIndex] ^= value;
        }
      } else {
        // case 5
        for (let end = destIndex + count; destIndex < end && destIndex < destLen; destIndex++) {
          dest[destIndex] ^= readByte();
        }
      }
    } else {
      const count = i & 0x7f;
      if (count === 0) {
        const c = readWord();
        if (c === 0) return;
        if ((c & 0x8000) === 0) {
          // case 2: skip
          destIndex += c & 0x7fff;
        } else if ((c & 0x4000) === 0) {
          // case 3
          for (let end = destIndex + (c & 0x3fff); destIndex < end && destIndex < destLen; destIndex++) {
            dest[destIndex] ^= readByte();
          }
        } else {
          // case 4
          const value = readByte();
          for (let end = destIndex + (c & 0x3fff); destIndex < end && destIndex < destLen; destIndex++) {
            dest[destIndex] ^= value;
          }
        }
      } else {
        // case 1: skip
        destIndex += count;
      }
    }
  }
}

/**
 * Decoded Westwood Template (.tem / .sno)
 * Contains 24x24 tiles indexed from 0 to N
 */
export interface RaTemplate {
  width: number;
  height: number;
  tiles: (Uint8Array | null)[];
}

export function parseTemplate(buf: Uint8Array): RaTemplate {
  const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  const w = view.getUint16(0, true) || 24;
  const h = view.getUint16(2, true) || 24;

  const imgStart = view.getUint32(16, true);
  const indexEnd = view.getInt32(28, true);
  const indexStart = view.getInt32(36, true);

  const tiles: (Uint8Array | null)[] = [];
  const tileSize = 24 * 24; // 576 bytes

  if (indexStart > 0 && indexEnd > indexStart && indexEnd <= buf.byteLength) {
    for (let pos = indexStart; pos < indexEnd; pos++) {
      const b = buf[pos];
      if (b !== 255) {
        const tileOffset = imgStart + b * tileSize;
        if (tileOffset + tileSize <= buf.byteLength) {
          tiles.push(buf.subarray(tileOffset, tileOffset + tileSize));
        } else {
          tiles.push(null);
        }
      } else {
        tiles.push(null);
      }
    }
  }

  return { width: w, height: h, tiles };
}

/**
 * Decoded Westwood SHP Sprite
 */
export interface RaShpFrame {
  width: number;
  height: number;
  data: Uint8Array;
}

export interface RaShp {
  imageCount: number;
  width: number;
  height: number;
  frames: RaShpFrame[];
}

export function parseShp(buf: Uint8Array): RaShp {
  const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  const imageCount = view.getUint16(0, true);
  const width = view.getUint16(6, true);
  const height = view.getUint16(8, true);

  interface HeaderInfo {
    offset: number;
    format: number;
    refOffset: number;
    refFormat: number;
    refImage: HeaderInfo | null;
    image: Uint8Array | null;
  }

  const headers: HeaderInfo[] = [];
  let headerOffset = 14;
  for (let i = 0; i < imageCount; i++) {
    const data = view.getUint32(headerOffset, true);
    const offset = data & 0xffffff;
    const format = data >>> 24;
    const refOffset = view.getUint16(headerOffset + 4, true);
    const refFormat = view.getUint16(headerOffset + 6, true);
    headerOffset += 8;
    headers.push({ offset, format, refOffset, refFormat, refImage: null, image: null });
  }

  const offsets = new Map<number, HeaderInfo>();
  for (const h of headers) {
    offsets.set(h.offset, h);
  }

  for (let i = 0; i < imageCount; i++) {
    const h = headers[i];
    if (h.format === 0x20) {
      h.refImage = headers[i - 1] || null;
    } else if (h.format === 0x40) {
      h.refImage = offsets.get(h.refOffset) || null;
    }
  }

  const framePixelCount = width * height;
  let recurseDepth = 0;

  function decompress(h: HeaderInfo): Uint8Array {
    if (h.image) return h.image;
    if (recurseDepth > imageCount) {
      const fallback = new Uint8Array(framePixelCount);
      h.image = fallback;
      return fallback;
    }

    if (h.format === 0x80) {
      const dest = new Uint8Array(framePixelCount);
      decodeFormat80(buf.subarray(h.offset), dest);
      h.image = dest;
      return dest;
    } else if (h.format === 0x20 || h.format === 0x40) {
      let base: Uint8Array;
      if (h.refImage) {
        if (h.refImage.image) {
          base = h.refImage.image;
        } else {
          recurseDepth++;
          base = decompress(h.refImage);
          recurseDepth--;
        }
      } else {
        base = new Uint8Array(framePixelCount);
      }
      const dest = new Uint8Array(framePixelCount);
      dest.set(base);
      decodeFormat40(buf.subarray(h.offset), dest);
      h.image = dest;
      return dest;
    } else {
      const dest = new Uint8Array(framePixelCount);
      h.image = dest;
      return dest;
    }
  }

  for (const h of headers) {
    decompress(h);
  }

  return {
    imageCount,
    width,
    height,
    frames: headers.map((h) => ({ width, height, data: h.image || new Uint8Array(framePixelCount) })),
  };
}

/**
 * Ore frame mapping from Iran's RAFullMapPreviewGenerator
 */
export const ORE_FRAMES: Record<string, number> = {
  gold01: 11,
  gold02: 11,
  gold03: 11,
  gold04: 11,
  gem01: 2,
  gem02: 2,
  gem03: 2,
  gem04: 2,
};

/**
 * Normalizes template names across Westwood naming conventions.
 * E.g.:
 *  'xtra001', 'XTRA01', 'XTRA1' -> 'xtra0001'
 *  'wall001', 'WALL01', 'wall1' -> 'wall0001'
 *  'lwal1' -> 'lwal0001'
 *  'flor1' -> 'flor0001'
 */
export function normalizeTemplateName(name: string): string {
  let s = name.trim().toLowerCase();
  s = s.replace(/\.(tem|int|sno|des|shp)$/, '');
  const m = s.match(/^([a-z]+)(\d+)$/);
  if (m) {
    const prefix = m[1];
    const num = parseInt(m[2], 10);
    if (['xtra', 'wall', 'lwal', 'flor', 'gflr', 'strp', 'gstr', 'arro'].includes(prefix)) {
      return `${prefix}${num.toString().padStart(4, '0')}`;
    }
  }
  return s;
}

export const WALL_OVERLAYS = new Set(['brik', 'sbag', 'cycl', 'barb', 'wood', 'fenc']);
export const isWallOverlay = (name: string | null | undefined): boolean => {
  if (!name) return false;
  const n = normalizeTemplateName(name);
  return (
    WALL_OVERLAYS.has(n) ||
    n.startsWith('xtra') ||
    n.startsWith('wall') ||
    n.startsWith('lwal')
  );
};

/**
 * Global Cache for Original Assets loaded from single .pack / .zip archive
 */
class AssetLoader {
  private isLoaded = false;
  private loadPromise: Promise<boolean> | null = null;
  private files: Map<string, Uint8Array> = new Map();

  private tilesetMap: Map<number, string> | null = null;
  private templateCache: Map<string, RaTemplate | null> = new Map();
  private shpCache: Map<string, RaShp | null> = new Map();
  private paletteCache: Map<string, Palette | null> = new Map();

  private lastError: string | null = null;

  public hasPack(): boolean {
    return this.isLoaded && this.files.size > 0;
  }

  public getLastError(): string | null {
    return this.lastError;
  }

  public reset(): void {
    this.isLoaded = false;
    this.loadPromise = null;
    this.lastError = null;
    this.files.clear();
    this.tilesetMap = null;
    this.templateCache.clear();
    this.shpCache.clear();
    this.paletteCache.clear();
  }

  /**
   * Manually load archive from ArrayBuffer (e.g. user dragged/selected ra_data.pack)
   */
  public loadPackFromArrayBuffer(arrayBuffer: ArrayBuffer): boolean {
    try {
      const unzipped = unzipSync(new Uint8Array(arrayBuffer));
      let count = 0;
      for (const [key, data] of Object.entries(unzipped)) {
        const cleanKey = key.toLowerCase().replace(/\\/g, '/');
        this.files.set(cleanKey, data);
        count++;
      }
      if (count === 0) {
        throw new Error('Archive contains 0 files');
      }
      this.isLoaded = true;
      this.lastError = null;
      this.tilesetMap = null;
      this.templateCache.clear();
      this.shpCache.clear();
      this.paletteCache.clear();
      return true;
    } catch (err: any) {
      this.lastError = `Failed to unpack archive: ${err?.message || err}`;
      return false;
    }
  }

  /**
   * Loads and extracts the single ra_data.pack archive into memory.
   * Resolves URLs with respect to GitHub Pages subpath (Vite base) and relative paths.
   */
  public async ensurePackLoaded(
    onProgress?: (loadedBytes: number, totalBytes: number) => void
  ): Promise<boolean> {
    if (this.isLoaded && this.files.size > 0) return true;
    if (this.loadPromise) return this.loadPromise;

    this.loadPromise = (async () => {
      try {
        // Collect candidate URLs for GitHub Pages repository subpaths, root hosts, and dev
        const candidateUrls: string[] = [];
        const rawBase = (import.meta as any).env?.BASE_URL || './';
        const base = rawBase.endsWith('/') ? rawBase : `${rawBase}/`;

        candidateUrls.push(`${base}ra_data.pack`);
        candidateUrls.push(`${base}ra_data.zip`);
        candidateUrls.push('./ra_data.pack');
        candidateUrls.push('./ra_data.zip');
        candidateUrls.push('ra_data.pack');
        candidateUrls.push('ra_data.zip');

        if (typeof window !== 'undefined' && window.location) {
          try {
            const cleanHref = window.location.href.split('#')[0].split('?')[0];
            const dirHref = cleanHref.endsWith('/') ? cleanHref : cleanHref.substring(0, cleanHref.lastIndexOf('/') + 1);
            candidateUrls.push(`${dirHref}ra_data.pack`);
            candidateUrls.push(`${dirHref}ra_data.zip`);
          } catch {
            // ignore
          }
        }

        candidateUrls.push('/ra_data.pack');
        candidateUrls.push('/ra_data.zip');

        // Deduplicate
        const uniqueUrls = Array.from(new Set(candidateUrls));
        let res: Response | null = null;
        let lastErrorMsg = '';

        for (const url of uniqueUrls) {
          try {
            const r = await fetch(url);
            if (r.ok && r.status === 200) {
              res = r;
              break;
            } else {
              lastErrorMsg = `HTTP ${r.status} (${url})`;
            }
          } catch (e: any) {
            lastErrorMsg = `${e?.message || 'Network error'} (${url})`;
          }
        }

        if (!res || !res.ok) {
          throw new Error(`Could not find ra_data.pack or ra_data.zip. Last tried: ${lastErrorMsg}`);
        }

        const contentLength = parseInt(res.headers.get('content-length') || '0', 10);
        let arrayBuffer: ArrayBuffer;

        if (res.body && contentLength > 0) {
          const reader = res.body.getReader();
          const chunks: Uint8Array[] = [];
          let received = 0;

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            if (value) {
              chunks.push(value);
              received += value.length;
              onProgress?.(received, contentLength);
            }
          }

          const combined = new Uint8Array(received);
          let offset = 0;
          for (const c of chunks) {
            combined.set(c, offset);
            offset += c.length;
          }
          arrayBuffer = combined.buffer;
        } else {
          arrayBuffer = await res.arrayBuffer();
          onProgress?.(arrayBuffer.byteLength, arrayBuffer.byteLength);
        }

        const unzipped = unzipSync(new Uint8Array(arrayBuffer));
        for (const [key, data] of Object.entries(unzipped)) {
          const cleanKey = key.toLowerCase().replace(/\\/g, '/');
          this.files.set(cleanKey, data);
        }

        this.isLoaded = true;
        this.lastError = null;
        return true;
      } catch (err: any) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error('Failed to load ra_data.pack:', msg);
        this.lastError = msg;
        return false;
      } finally {
        this.loadPromise = null;
      }
    })();

    return this.loadPromise;
  }

  // Load Tilesets.ini from pack
  public async getTilesetMap(): Promise<Map<number, string>> {
    if (this.tilesetMap) return this.tilesetMap;
    await this.ensurePackLoaded();

    const data = this.files.get('tilesets.ini');
    if (!data) {
      this.tilesetMap = new Map();
      return this.tilesetMap;
    }

    const text = new TextDecoder('utf-8').decode(data);
    const map = new Map<number, string>();
    for (const line of text.split(/\r?\n/)) {
      const parts = line.split('=');
      if (parts.length === 2) {
        const id = parseInt(parts[0].trim(), 10);
        if (!isNaN(id)) {
          map.set(id, parts[1].trim().toLowerCase());
        }
      }
    }
    this.tilesetMap = map;
    return map;
  }

  // Load Palette from pack
  public async getPalette(theater: string): Promise<Palette | null> {
    const key = theater.toLowerCase();
    if (this.paletteCache.has(key)) return this.paletteCache.get(key) || null;
    await this.ensurePackLoaded();

    let palFile = 'temperate/temperat.pal';
    if (key === 'snow') palFile = 'snow/snow.pal';
    else if (key === 'winter') palFile = 'winter/winter.pal';
    else if (key === 'desert') palFile = 'desert/desert.pal';
    else if (key === 'interior') palFile = 'interior/interior.pal';

    const buf = this.files.get(palFile);
    if (!buf) {
      this.paletteCache.set(key, null);
      return null;
    }

    const pal = parsePalette(buf);
    this.paletteCache.set(key, pal);
    return pal;
  }

  // Load Template from pack (.tem, .sno, .int, etc.)
  public async getTemplate(theater: string, templateName: string): Promise<RaTemplate | null> {
    const norm = normalizeTemplateName(templateName);
    const t = theater.toLowerCase();
    const key = `${t}/${norm}`;
    if (this.templateCache.has(key)) return this.templateCache.get(key) || null;
    await this.ensurePackLoaded();

    let ext = '.tem';
    if (t === 'snow') ext = '.sno';
    else if (t === 'desert') ext = '.des';
    else if (t === 'interior') ext = '.int';

    // 1. Try theater specific path
    let buf = this.files.get(`${t}/${norm}${ext}`);

    // 2. Interior check for interior templates or interior theater
    if (
      !buf &&
      (t === 'interior' ||
        norm.startsWith('xtra') ||
        norm.startsWith('wall') ||
        norm.startsWith('lwal') ||
        norm.startsWith('flor') ||
        norm.startsWith('gflr') ||
        norm.startsWith('strp') ||
        norm.startsWith('gstr') ||
        norm.startsWith('arro'))
    ) {
      buf = this.files.get(`interior/${norm}.int`);
    }

    // 3. Fallback to temperate if theater doesn't have it
    if (!buf) {
      buf = this.files.get(`temperate/${norm}.tem`);
    }

    // 4. Fallback to any matching file across all theaters
    if (!buf) {
      buf =
        this.files.get(`interior/${norm}.int`) ||
        this.files.get(`snow/${norm}.sno`) ||
        this.files.get(`desert/${norm}.des`);
    }

    if (!buf) {
      this.templateCache.set(key, null);
      return null;
    }

    const parsed = parseTemplate(buf);
    this.templateCache.set(key, parsed);
    return parsed;
  }

  // Load SHP from pack (general sprites, units, structures, bibs, terrain)
  public async getShp(theater: string, shpName: string): Promise<RaShp | null> {
    const name = normalizeTemplateName(shpName);
    const t = theater.toLowerCase();
    const key = `${t}/${name}`;
    if (this.shpCache.has(key)) return this.shpCache.get(key) || null;
    await this.ensurePackLoaded();

    let ext = '.tem';
    if (t === 'snow') ext = '.sno';
    else if (t === 'winter') ext = '.tem';
    else if (t === 'desert') ext = '.des';
    else if (t === 'interior') ext = '.int';

    // 1. Check general directory
    let buf = this.files.get(`general/${name}.shp`);
    // 2. Check theater directory (.shp)
    if (!buf) buf = this.files.get(`${t}/${name}.shp`);
    // 3. Check theater-specific extension (e.g. bib1.tem, bib2.sno, bib3.des)
    if (!buf) buf = this.files.get(`${t}/${name}${ext}`);
    // 4. Temperate fallback
    if (!buf) buf = this.files.get(`temperate/${name}.tem`);
    if (!buf) buf = this.files.get(`temperate/${name}.shp`);
    // 5. Any theater fallback
    if (!buf) {
      buf =
        this.files.get(`snow/${name}.sno`) ||
        this.files.get(`winter/${name}.tem`) ||
        this.files.get(`desert/${name}.des`) ||
        this.files.get(`interior/${name}.int`);
    }

    if (!buf) {
      this.shpCache.set(key, null);
      return null;
    }

    const parsed = parseShp(buf);
    this.shpCache.set(key, parsed);
    return parsed;
  }

  // Load Overlay SHP from pack (gold ore, gems, sandbags, crates, fences)
  public async getOverlay(theater: string, overlayName: string): Promise<RaShp | null> {
    const name = overlayName.toLowerCase();
    const t = theater.toLowerCase();
    const key = `overlay:${t}/${name}`;
    if (this.shpCache.has(key)) return this.shpCache.get(key) || null;
    await this.ensurePackLoaded();

    let ext = '.tem';
    if (t === 'snow') ext = '.sno';
    else if (t === 'winter') ext = '.tem';
    else if (t === 'desert') ext = '.des';
    else if (t === 'interior') ext = '.int';

    // 1. Check theater-specific overlay file (e.g. temperate/gold01.tem, snow/gold01.sno, desert/gold01.des)
    let buf = this.files.get(`${t}/${name}${ext}`);
    // 2. Temperate fallback
    if (!buf) {
      buf = this.files.get(`temperate/${name}.tem`);
    }
    // 3. General SHP (e.g. general/sbag.shp, general/brik.shp, general/wcrate.shp)
    if (!buf) {
      buf = this.files.get(`general/${name}.shp`);
    }
    // 4. Theater SHP fallback
    if (!buf) {
      buf = this.files.get(`${t}/${name}.shp`);
    }

    if (!buf) {
      this.shpCache.set(key, null);
      return null;
    }

    try {
      const parsed = parseShp(buf);
      this.shpCache.set(key, parsed);
      return parsed;
    } catch (e) {
      console.warn(`Failed to parse overlay ${overlayName} as SHP:`, e);
      this.shpCache.set(key, null);
      return null;
    }
  }
}

export const assetLoader = new AssetLoader();

/**
 * Preloads the ra_data.pack file and all required map assets
 */
export async function preloadMapAssets(
  map: MprMapData,
  onProgress?: (loaded: number, total: number) => void
): Promise<void> {
  const ok = await assetLoader.ensurePackLoaded(onProgress);
  if (!ok) {
    const err = assetLoader.getLastError() || 'Failed to load ra_data.pack or ra_data.zip';
    throw new Error(err);
  }
  await assetLoader.getTilesetMap();
  await assetLoader.getPalette(map.theater);

  // Pre-load common overlays (gold01..04, gem01..04, walls)
  const commonOverlays = [
    'gold01', 'gold02', 'gold03', 'gold04',
    'gem01', 'gem02', 'gem03', 'gem04',
    'brik', 'sbag', 'cycl', 'barb', 'wood', 'fenc'
  ];
  for (const ov of commonOverlays) {
    await assetLoader.getOverlay(map.theater, ov);
  }
}

export function isOriginalAssetsLoaded(): boolean {
  return assetLoader.hasPack();
}

export function getOriginalAssetsError(): string | null {
  return assetLoader.getLastError();
}

export function loadOriginalAssetsManually(buffer: ArrayBuffer): boolean {
  return assetLoader.loadPackFromArrayBuffer(buffer);
}

export async function retryOriginalAssetsLoad(
  onProgress?: (loaded: number, total: number) => void
): Promise<boolean> {
  assetLoader.reset();
  return assetLoader.ensurePackLoaded(onProgress);
}

export const BUILDING_DAMAGE_FRAMES: Record<string, number> = {
  hbox: 2, mslo: 8, iron: 11, fcom: 1, atek: 1, pdox: 29, syrd: 1, pbox: 1,
  tsla: 10, agun: 64, ftur: 1, gap: 32, powr: 1, apwr: 1, stek: 1, barr: 10,
  tent: 10, kenn: 1, afld: 8, bio: 1, fact: 26, fix: 7, gun: 64, hosp: 4,
  hpad: 7, miss: 1, proc: 1, sam: 34, silo: 5, weap: 1, weap2: 4,
  v01: 1, v02: 1, v03: 1, v04: 2, v05: 2, v06: 1, v07: 2, v08: 1, v09: 1,
  v10: 1, v11: 1, v12: 1, v13: 1, v14: 1, v15: 1, v16: 1, v17: 1, v18: 1,
  v19: 14, v20: 3, v21: 3, v22: 3, v23: 3, v24: 1, v25: 1, v26: 1, v27: 1,
  v28: 1, v29: 1, v30: 1, v31: 1, v32: 1, v33: 1, v34: 1, v35: 1, v36: 1, v37: 1,
};

export const BUILDING_BIBS: Record<string, { bib: string; yOffset: number }> = {
  bio: { bib: 'bib3', yOffset: 1 },
  atek: { bib: 'bib3', yOffset: 1 },
  fcom: { bib: 'bib3', yOffset: 1 },
  stek: { bib: 'bib2', yOffset: 1 },
  dome: { bib: 'bib3', yOffset: 1 },
  barr: { bib: 'bib3', yOffset: 1 },
  tent: { bib: 'bib3', yOffset: 1 },
  fact: { bib: 'bib2', yOffset: 2 },
  hosp: { bib: 'bib3', yOffset: 1 },
  hpad: { bib: 'bib3', yOffset: 1 },
  miss: { bib: 'bib2', yOffset: 1 },
  powr: { bib: 'bib3', yOffset: 1 },
  apwr: { bib: 'bib2', yOffset: 2 },
  proc: { bib: 'bib2', yOffset: 2 },
  weap: { bib: 'bib2', yOffset: 1 },
};

export function frameFromUnitAngle(angle: number): number {
  if (angle === 0) return 0;
  if (angle > 248) return 0;
  if (angle > 240) return 1;
  if (angle > 232) return 2;
  if (angle > 224) return 3;
  if (angle > 216) return 4;
  if (angle > 208) return 5;
  if (angle > 200) return 6;
  if (angle > 192) return 7;
  if (angle > 184) return 8;
  if (angle > 176) return 9;
  if (angle > 168) return 10;
  if (angle > 160) return 11;
  if (angle > 152) return 12;
  if (angle > 144) return 13;
  if (angle > 136) return 14;
  if (angle > 128) return 15;
  if (angle > 120) return 16;
  if (angle > 112) return 17;
  if (angle > 104) return 18;
  if (angle > 96) return 19;
  if (angle > 88) return 20;
  if (angle > 80) return 21;
  if (angle > 72) return 22;
  if (angle > 64) return 23;
  if (angle > 56) return 24;
  if (angle > 48) return 25;
  if (angle > 40) return 26;
  if (angle > 32) return 27;
  if (angle > 24) return 28;
  if (angle > 16) return 29;
  if (angle > 8) return 30;
  if (angle > 0) return 31;
  return 0;
}

export function frameFromInfantryAngle(angle: number): number {
  if (angle === 0) return 0;
  if (angle > 224) return 0;
  if (angle > 192) return 1;
  if (angle > 160) return 2;
  if (angle > 128) return 3;
  if (angle > 96) return 4;
  if (angle > 64) return 5;
  if (angle > 32) return 6;
  if (angle > 0) return 7;
  return 0;
}

export function frameFromShipAngle(angle: number): number {
  if (angle === 0) return 0;
  if (angle > 240) return 0;
  if (angle > 224) return 1;
  if (angle > 208) return 2;
  if (angle > 192) return 3;
  if (angle > 176) return 4;
  if (angle > 160) return 5;
  if (angle > 144) return 6;
  if (angle > 128) return 7;
  if (angle > 112) return 8;
  if (angle > 96) return 9;
  if (angle > 80) return 10;
  if (angle > 64) return 11;
  if (angle > 48) return 12;
  if (angle > 32) return 13;
  if (angle > 16) return 14;
  if (angle > 0) return 15;
  return 0;
}

function hasVehicleTurret(name: string): boolean {
  switch (name) {
    case '1tnk':
    case '2tnk':
    case '3tnk':
    case '4tnk':
    case 'jeep':
    case 'ttnk':
    case 'stnk':
    case 'mgg':
    case 'mrj':
    case 'pt':
    case 'dd':
    case 'ca':
      return true;
    default:
      return false;
  }
}

function getMobileGapGeneratorTurretAdjustments(frame: number): [number, number] {
  switch (frame) {
    case 0: case 1: case 2: return [0, 3];
    case 3: case 4: case 5: return [3, 1];
    case 6: case 7: case 8: return [3, -2];
    case 9: case 10: case 11: return [4, -2];
    case 12: case 13: case 14: return [5, -6];
    case 15: case 16: case 17: return [-1, -6];
    case 18: case 19: case 20: return [-5, -5];
    case 21: case 22: case 23: return [-7, -3];
    case 24: case 25: case 26: return [-8, -1];
    case 27: case 28: case 29: return [-6, 2];
    case 30: case 31: return [-3, 3];
    default: return [0, 0];
  }
}

function getMobileRadarJammerTurretAdjustments(frame: number): [number, number] {
  switch (frame - 32) {
    case 0: return [0, -2];
    case 1: return [-2, 0];
    case 2: return [-3, 0];
    case 3: return [-5, 0];
    case 4: return [-6, 0];
    case 5: return [-8, -2];
    case 6: return [0, -2];
    case 7: return [0, -2];
    case 8: return [0, -5];
    default: return [0, 0];
  }
}

function getGunboatTurretAdjustments(frame: number): [number, number] {
  switch (frame) {
    case 0: return [-1, -6];
    case 2: return [-6, -5];
    case 4: return [-10, -4];
    case 6: return [-13, -2];
    case 8: return [-13, 1];
    case 10: return [-14, 4];
    case 12: return [-10, 6];
    case 14: return [-7, 9];
    case 16: return [-1, 8];
    case 18: return [6, 8];
    case 20: return [10, 7];
    case 22: return [12, 4];
    case 24: return [13, 1];
    case 26: return [12, -2];
    case 28: return [9, -4];
    case 30: return [5, -6];
    default: return [0, 0];
  }
}

function getDestroyerTurretAdjustments(frame: number): [number, number] {
  switch (frame) {
    case 0: return [0, 0];
    case 2: return [2, 0];
    case 4: return [4, 0];
    case 6: return [5, -3];
    case 8: return [7, -3];
    case 10: return [7, -6];
    case 12: return [5, -8];
    case 14: return [2, -6];
    case 16: return [0, -6];
    case 18: return [0, -7];
    case 20: return [-4, -8];
    case 22: return [-7, -6];
    case 24: return [-7, -4];
    case 26: return [-7, -2];
    case 28: return [-6, -1];
    case 30: return [-4, -2];
    default: return [0, 0];
  }
}

function getCruiserFirstTurretAdjustments(frame: number): [number, number] {
  switch (frame) {
    case 0: return [0, -12];
    case 2: return [-8, -12];
    case 4: return [-14, -10];
    case 6: return [-20, -8];
    case 8: return [-21, -3];
    case 10: return [-18, 1];
    case 12: return [-14, 5];
    case 14: return [-8, 8];
    case 16: return [0, 8];
    case 18: return [8, 8];
    case 20: return [13, 5];
    case 22: return [16, 2];
    case 24: return [18, -3];
    case 26: return [19, -7];
    case 28: return [15, -11];
    case 30: return [7, -12];
    default: return [0, 0];
  }
}

function getCruiserSecondTurretAdjustments(frame: number): [number, number] {
  switch (frame) {
    case 0: return [0, 7];
    case 2: return [8, 6];
    case 4: return [15, 4];
    case 6: return [21, 1];
    case 8: return [20, -3];
    case 10: return [20, -8];
    case 12: return [16, -12];
    case 14: return [8, -13];
    case 16: return [0, -16];
    case 18: return [-8, -13];
    case 20: return [-14, -12];
    case 22: return [-21, -8];
    case 24: return [-21, -3];
    case 26: return [-21, 2];
    case 28: return [-15, 5];
    case 30: return [-10, 8];
    default: return [0, 0];
  }
}

function getTurretInfo(
  unitName: string,
  angle: number
): { turretName: string; frame: number; secondTurret?: boolean } | null {
  const uAngleFrame = frameFromUnitAngle(angle);
  switch (unitName) {
    case '1tnk':
    case '2tnk':
    case '3tnk':
    case '4tnk':
    case 'jeep':
    case 'ttnk':
    case 'mrj':
      return { turretName: unitName, frame: uAngleFrame + 32 };
    case 'mgg':
      return { turretName: unitName, frame: 37 };
    case 'stnk':
      return { turretName: unitName, frame: uAngleFrame + 38 };
    case 'pt':
      return { turretName: 'mgun', frame: uAngleFrame };
    case 'dd':
      return { turretName: 'ssam', frame: uAngleFrame };
    case 'ca':
      return { turretName: 'turr', frame: uAngleFrame, secondTurret: true };
    default:
      return null;
  }
}

function getTurretAdjustment(name: string, frame: number, secondTurret = false): [number, number] {
  switch (name) {
    case 'mgg':
      return getMobileGapGeneratorTurretAdjustments(frame);
    case 'mrj':
      return getMobileRadarJammerTurretAdjustments(frame);
    case 'pt':
      return getGunboatTurretAdjustments(frame);
    case 'dd':
      return getDestroyerTurretAdjustments(frame);
    case 'ca':
      return secondTurret
        ? getCruiserSecondTurretAdjustments(frame)
        : getCruiserFirstTurretAdjustments(frame);
    default:
      return [0, 0];
  }
}

function subCellPixelOffsets(subCell: number): [number, number] {
  let x = -19;
  let y = -9;
  switch (subCell) {
    case 1: x += 0; y += 0; break;
    case 2: x += 11; y += 0; break;
    case 3: y += 11; break;
    case 4: x += 11; y += 11; break;
    case 0: x += 6; y += 6; break;
  }
  return [x, y];
}

function renderShpFrameToCanvas(
  shp: RaShp,
  frameIndex: number,
  palette: Palette
): HTMLCanvasElement | null {
  if (!shp || shp.frames.length === 0) return null;
  const idx = Math.min(shp.frames.length - 1, Math.max(0, frameIndex));
  const frame = shp.frames[idx] || shp.frames[0];
  const c = document.createElement('canvas');
  c.width = frame.width;
  c.height = frame.height;
  const ctx = c.getContext('2d');
  if (!ctx) return null;
  const imgData = ctx.createImageData(frame.width, frame.height);
  const data = imgData.data;
  const pixels = frame.data;
  for (let p = 0; p < pixels.length; p++) {
    const col = palette[pixels[p]];
    const outIdx = p * 4;
    if (col && col.a > 0) {
      data[outIdx] = col.r;
      data[outIdx + 1] = col.g;
      data[outIdx + 2] = col.b;
      data[outIdx + 3] = col.a;
    }
  }
  ctx.putImageData(imgData, 0, 0);
  return c;
}

/**
 * Renders an MPR map onto Canvas using original Westwood assets (24x24 tiles)
 * Exactly mirrors the rendering pipeline from Iran's RAFullMapPreviewGenerator
 */
export async function renderMprOriginalAssets(
  map: MprMapData,
  options: {
    onlyDrawVisible: boolean;
    showWaypoints: boolean;
    showOre: boolean;
    showStructures: boolean;
    showWalls?: boolean;
    scaleMultiplier?: number;
  },
  targetCanvas: HTMLCanvasElement
): Promise<void> {
  const tilesetMap = await assetLoader.getTilesetMap();
  const basePalette = await assetLoader.getPalette(map.theater);
  if (!basePalette) return;

  const tileSize = 24; // Original Westwood tile dimension
  const scale = options.scaleMultiplier || 1.0;

  // Render on the canonical 128x128 full grid first (3072x3072)
  const fullWidth = 128 * tileSize;
  const fullHeight = 128 * tileSize;
  const nativeCanvas = document.createElement('canvas');
  nativeCanvas.width = fullWidth;
  nativeCanvas.height = fullHeight;
  const ctx = nativeCanvas.getContext('2d');
  if (!ctx) return;

  ctx.imageSmoothingEnabled = false;

  // 1. Draw Ground Templates (Tiles)
  const clear1 = await assetLoader.getTemplate(map.theater, 'clear1');
  const tileImageData = ctx.createImageData(tileSize, tileSize);
  const tileBuf = tileImageData.data;

  const drawIndexedTile = (
    indexedPixels: Uint8Array,
    targetX: number,
    targetY: number,
    palette: Palette
  ) => {
    for (let py = 0; py < tileSize; py++) {
      for (let px = 0; px < tileSize; px++) {
        const pIdx = py * tileSize + px;
        const colorIdx = indexedPixels[pIdx];
        const color = palette[colorIdx];
        const outIdx = pIdx * 4;
        if (color && color.a > 0) {
          tileBuf[outIdx] = color.r;
          tileBuf[outIdx + 1] = color.g;
          tileBuf[outIdx + 2] = color.b;
          tileBuf[outIdx + 3] = color.a;
        } else {
          tileBuf[outIdx + 3] = 0;
        }
      }
    }
    ctx.putImageData(tileImageData, targetX, targetY);
  };

  for (let y = 0; y < 128; y++) {
    for (let x = 0; x < 128; x++) {
      const cellIdx = y * 128 + x;
      const cell = map.cells[cellIdx];
      const targetPx = x * tileSize;
      const targetPy = y * tileSize;

      if (options.onlyDrawVisible && cell?.isOutOfBounds) {
        continue;
      }

      let templateName = 'clear1';
      let tileIndex = cell?.tile || 0;

      if (!cell || cell.template === 0 || cell.template === 255 || cell.template === 65535) {
        templateName = 'clear1';
        tileIndex = (x % 4) + (y % 4) * 4;
      } else {
        templateName = tilesetMap.get(cell.template) || 'clear1';
      }

      const tmpl =
        templateName === 'clear1'
          ? clear1
          : await assetLoader.getTemplate(map.theater, templateName);

      if (tmpl && tmpl.tiles[tileIndex]) {
        drawIndexedTile(tmpl.tiles[tileIndex]!, targetPx, targetPy, basePalette);
      } else if (clear1) {
        const safeTile = (x % 4) + (y % 4) * 4;
        if (clear1.tiles[safeTile]) {
          drawIndexedTile(clear1.tiles[safeTile]!, targetPx, targetPy, basePalette);
        }
      }
    }
  }

  // 2. Draw Overlays (Gold Ore, Gems, Crates, and Autotiled Walls)
  const drawWalls = options.showWalls !== false;
  const drawOre = options.showOre;

  if (map.hasOverlayPack || map.goldCellCount > 0 || map.gemCellCount > 0 || (map.wallCellCount && map.wallCellCount > 0)) {
    const overlayCanvasCache = new Map<string, HTMLCanvasElement | null>();

    const getOverlayCanvas = async (ovName: string, frameNumber?: number): Promise<HTMLCanvasElement | null> => {
      const normName = normalizeTemplateName(ovName);
      const cacheKey = frameNumber !== undefined ? `${normName}_${frameNumber}` : normName;
      if (overlayCanvasCache.has(cacheKey)) {
        return overlayCanvasCache.get(cacheKey) || null;
      }

      const shp = await assetLoader.getOverlay(map.theater, normName);
      if (!shp || shp.frames.length === 0) {
        overlayCanvasCache.set(cacheKey, null);
        return null;
      }

      let frameIdx = 0;
      if (frameNumber !== undefined) {
        frameIdx = Math.min(shp.frames.length - 1, Math.max(0, frameNumber));
      } else if (ORE_FRAMES[normName] !== undefined) {
        frameIdx = Math.min(shp.frames.length - 1, Math.max(0, ORE_FRAMES[normName]));
      }

      const c = renderShpFrameToCanvas(shp, frameIdx, basePalette);
      overlayCanvasCache.set(cacheKey, c);
      return c;
    };

    const isConnectedWall = (gx: number, gy: number, myWallType: string): boolean => {
      if (gx < 0 || gx >= 128 || gy < 0 || gy >= 128) return false;
      const neighbor = map.cells[gy * 128 + gx];
      if (!neighbor?.overlay) return false;
      const nOv = normalizeTemplateName(neighbor.overlay);
      return nOv === myWallType || (isWallOverlay(nOv) && isWallOverlay(myWallType));
    };

    for (let y = 0; y < 128; y++) {
      for (let x = 0; x < 128; x++) {
        const cellIdx = y * 128 + x;
        const cell = map.cells[cellIdx];
        if (!cell?.overlay || (options.onlyDrawVisible && cell.isOutOfBounds)) continue;

        const ovRaw = cell.overlay.toLowerCase();
        const targetPx = x * tileSize;
        const targetPy = y * tileSize;

        if (isWallOverlay(ovRaw)) {
          if (!drawWalls) continue;
          const normWall = normalizeTemplateName(ovRaw);

          if (normWall.startsWith('xtra') || normWall.startsWith('wall') || normWall.startsWith('lwal')) {
            const wallTmpl = await assetLoader.getTemplate(map.theater, normWall);
            const wallTile = wallTmpl ? wallTmpl.tiles.find((t) => t !== null) || wallTmpl.tiles[0] : null;
            if (wallTile) {
              drawIndexedTile(wallTile, targetPx, targetPy, basePalette);
            }
          } else {
            let mask = 0;
            if (isConnectedWall(x, y - 1, normWall)) mask |= 1;
            if (isConnectedWall(x + 1, y, normWall)) mask |= 2;
            if (isConnectedWall(x, y + 1, normWall)) mask |= 4;
            if (isConnectedWall(x - 1, y, normWall)) mask |= 8;

            const wallCanvas = await getOverlayCanvas(normWall, mask);
            if (wallCanvas) {
              ctx.drawImage(wallCanvas, targetPx, targetPy);
            }
          }
        } else if (ovRaw.startsWith('gold') || ovRaw.startsWith('gem')) {
          if (!drawOre) continue;
          const ovCanvas = await getOverlayCanvas(ovRaw);
          if (ovCanvas) {
            ctx.drawImage(ovCanvas, targetPx, targetPy);
          }
        } else if (ovRaw.includes('crate') && (drawOre || options.showStructures)) {
          const crateCanvas = await getOverlayCanvas(ovRaw, 0);
          if (crateCanvas) {
            ctx.drawImage(crateCanvas, targetPx, targetPy);
          }
        }
      }
    }
  }

  // 3. Draw Building Bibs (Concrete Foundations underneath Base & Structures)
  if (options.showStructures) {
    const bibList: { bibName: string; x: number; y: number; isBase: boolean }[] = [];

    // Collect bibs from structures
    for (const s of map.structures) {
      const bibInfo = BUILDING_BIBS[s.name];
      if (bibInfo) {
        bibList.push({
          bibName: bibInfo.bib,
          x: s.x,
          y: s.y + bibInfo.yOffset,
          isBase: false,
        });
      }
    }

    // Collect bibs from base structures
    if (map.baseStructures) {
      for (const bs of map.baseStructures) {
        const bibInfo = BUILDING_BIBS[bs.name];
        if (bibInfo) {
          bibList.push({
            bibName: bibInfo.bib,
            x: bs.x,
            y: bs.y + bibInfo.yOffset,
            isBase: true,
          });
        }
      }
    }

    for (const b of bibList) {
      const bibShp = await assetLoader.getShp(map.theater, b.bibName);
      if (!bibShp || bibShp.frames.length === 0) continue;

      let maxX = 2;
      let maxY = 2;
      if (b.bibName === 'bib1') { maxX = 4; maxY = 2; }
      else if (b.bibName === 'bib2') { maxX = 3; maxY = 2; }
      else if (b.bibName === 'bib3') { maxX = 2; maxY = 2; }

      let frameIdx = 0;
      for (let by = 0; by < maxY; by++) {
        for (let bx = 0; bx < maxX; bx++) {
          const bibCanvas = renderShpFrameToCanvas(bibShp, frameIdx++, basePalette);
          if (bibCanvas) {
            const bxPx = (b.x + bx) * tileSize;
            const byPx = (b.y + by) * tileSize;
            if (b.isBase) {
              ctx.save();
              ctx.globalAlpha = 0.9;
              ctx.drawImage(bibCanvas, bxPx, byPx);
              ctx.restore();
            } else {
              ctx.drawImage(bibCanvas, bxPx, byPx);
            }
          }
        }
      }
    }
  }

  // 4. Draw Base Structures (Ghost / Planned buildings with opacity 0.9)
  if (options.showStructures && map.baseStructures && map.baseStructures.length > 0) {
    const basePal = remapForHouse(map.basePlayer || 'ussr', 'Primary', basePalette, map.houseColors);
    for (const bs of map.baseStructures) {
      const shp = await assetLoader.getShp(map.theater, bs.name);
      if (shp && shp.frames.length > 0) {
        const sCanvas = renderShpFrameToCanvas(shp, 0, basePal);
        if (sCanvas) {
          ctx.save();
          ctx.globalAlpha = 0.9;
          ctx.drawImage(sCanvas, bs.x * tileSize, bs.y * tileSize);
          if (bs.isFake) {
            ctx.font = 'bold 10px Tahoma, Arial, sans-serif';
            ctx.fillStyle = '#ffffff';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('FAKE', (bs.x * tileSize) + (sCanvas.width / 2), (bs.y * tileSize) + (sCanvas.height / 2));
          }
          ctx.restore();
        }
      }
    }
  }

  // 5. Draw Structures (Active buildings with House Primary Color remap and damage frames)
  if (options.showStructures && map.structures.length > 0) {
    for (const s of map.structures) {
      const shp = await assetLoader.getShp(map.theater, s.name);
      if (shp && shp.frames.length > 0) {
        const housePal = remapForHouse(s.side, 'Primary', basePalette, map.houseColors);

        let frameIdx = 0;
        if (s.hp <= 128) {
          frameIdx = BUILDING_DAMAGE_FRAMES[s.name] || 0;
        }
        if (s.name === 'gun' || s.name === 'agun' || s.name === 'sam') {
          frameIdx += frameFromUnitAngle(s.angle);
        }

        const sCanvas = renderShpFrameToCanvas(shp, frameIdx, housePal);
        if (sCanvas) {
          ctx.drawImage(sCanvas, s.x * tileSize, s.y * tileSize);
          if (s.isFake) {
            ctx.font = 'bold 10px Tahoma, Arial, sans-serif';
            ctx.fillStyle = '#ffffff';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('FAKE', (s.x * tileSize) + (sCanvas.width / 2), (s.y * tileSize) + (sCanvas.height / 2));
          }
        }
      }
    }
  }

  // 6. Draw Units (Vehicles & Tanks with House Secondary Color remap and turrets)
  if (options.showStructures && map.units && map.units.length > 0) {
    for (const u of map.units) {
      const uShp = await assetLoader.getShp(map.theater, u.name);
      if (!uShp || uShp.frames.length === 0) continue;

      const unitPal = remapForHouse(u.side, 'Secondary', basePalette, map.houseColors);
      const isAnt = u.name === 'ant1' || u.name === 'ant2' || u.name === 'ant3';
      const uFrame = isAnt ? frameFromInfantryAngle(u.angle) : frameFromUnitAngle(u.angle);

      const uCanvas = renderShpFrameToCanvas(uShp, uFrame, unitPal);
      if (uCanvas) {
        const centerX = (u.x * tileSize) + 12 - Math.floor(uCanvas.width / 2);
        const centerY = (u.y * tileSize) + 12 - Math.floor(uCanvas.height / 2);
        ctx.drawImage(uCanvas, centerX, centerY);

        // Draw vehicle turret if applicable
        if (hasVehicleTurret(u.name)) {
          const tInfo = getTurretInfo(u.name, u.angle);
          if (tInfo) {
            const turretShp = await assetLoader.getShp(map.theater, tInfo.turretName);
            if (turretShp) {
              const turretCanvas = renderShpFrameToCanvas(turretShp, tInfo.frame, unitPal);
              if (turretCanvas) {
                const [adjX, adjY] = getTurretAdjustment(u.name, tInfo.frame, false);
                const tX = (u.x * tileSize) + 12 - Math.floor(turretCanvas.width / 2) + adjX;
                const tY = (u.y * tileSize) + 12 - Math.floor(turretCanvas.height / 2) + adjY;
                ctx.drawImage(turretCanvas, tX, tY);
              }
            }
          }
        }
      }
    }
  }

  // 7. Draw Infantries
  if (options.showStructures && map.infantry && map.infantry.length > 0) {
    for (const inf of map.infantry) {
      let infName = inf.name;
      if (['c2', 'c6', 'c7', 'c8', 'c9', 'c10'].includes(infName)) infName = 'c1';
      else if (['c3', 'c4', 'c5'].includes(infName)) infName = 'c2';

      const infShp = await assetLoader.getShp(map.theater, infName);
      if (!infShp || infShp.frames.length === 0) continue;

      const infPal = remapForHouse(inf.side, 'Secondary', basePalette, map.houseColors);
      const infFrame = frameFromInfantryAngle(inf.angle);
      const infCanvas = renderShpFrameToCanvas(infShp, infFrame, infPal);
      if (infCanvas) {
        const [subX, subY] = subCellPixelOffsets(inf.subCell);
        ctx.drawImage(infCanvas, inf.x * tileSize + subX, inf.y * tileSize + subY);
      }
    }
  }

  // 8. Draw Ships
  if (options.showStructures && map.ships && map.ships.length > 0) {
    for (const sh of map.ships) {
      const shipShp = await assetLoader.getShp(map.theater, sh.name);
      if (!shipShp || shipShp.frames.length === 0) continue;

      const shipPal = remapForHouse(sh.side, 'Secondary', basePalette, map.houseColors);
      const shipFrame = sh.name === 'lst' || sh.name === 'carr' ? 0 : frameFromShipAngle(sh.angle);
      const shipCanvas = renderShpFrameToCanvas(shipShp, shipFrame, shipPal);
      if (shipCanvas) {
        const centerX = (sh.x * tileSize) + 12 - Math.floor(shipCanvas.width / 2);
        const centerY = (sh.y * tileSize) + 12 - Math.floor(shipCanvas.height / 2);
        ctx.drawImage(shipCanvas, centerX, centerY);

        if (hasVehicleTurret(sh.name)) {
          const tInfo = getTurretInfo(sh.name, sh.angle);
          if (tInfo) {
            const turretShp = await assetLoader.getShp(map.theater, tInfo.turretName);
            if (turretShp) {
              const turretCanvas = renderShpFrameToCanvas(turretShp, tInfo.frame, shipPal);
              if (turretCanvas) {
                const [adjX, adjY] = getTurretAdjustment(sh.name, tInfo.frame, false);
                const tX = (sh.x * tileSize) + 12 - Math.floor(turretCanvas.width / 2) + adjX;
                const tY = (sh.y * tileSize) + 12 - Math.floor(turretCanvas.height / 2) + adjY;
                ctx.drawImage(turretCanvas, tX, tY);

                if (sh.name === 'ca') {
                  const [adjX2, adjY2] = getTurretAdjustment(sh.name, tInfo.frame, true);
                  const tX2 = (sh.x * tileSize) + 12 - Math.floor(turretCanvas.width / 2) + adjX2;
                  const tY2 = (sh.y * tileSize) + 12 - Math.floor(turretCanvas.height / 2) + adjY2;
                  ctx.drawImage(turretCanvas, tX2, tY2);
                }
              }
            }
          }
        }
      }
    }
  }

  // 9. Draw Terrain (Trees & Rocks using original .shp sprites)
  const terrainCanvasCache = new Map<string, HTMLCanvasElement | null>();
  const getTerrainCanvas = async (tName: string): Promise<HTMLCanvasElement | null> => {
    const normKey = normalizeTemplateName(tName);
    if (terrainCanvasCache.has(normKey)) return terrainCanvasCache.get(normKey) || null;

    if (normKey.startsWith('xtra') || normKey.startsWith('wall') || normKey.startsWith('lwal')) {
      const tmpl = await assetLoader.getTemplate(map.theater, normKey);
      const wallTile = tmpl ? tmpl.tiles.find((t) => t !== null) || tmpl.tiles[0] : null;
      if (wallTile) {
        const c = document.createElement('canvas');
        c.width = tileSize;
        c.height = tileSize;
        const cCtx = c.getContext('2d');
        if (cCtx) {
          const imgD = cCtx.createImageData(tileSize, tileSize);
          for (let p = 0; p < wallTile.length; p++) {
            const col = basePalette[wallTile[p]];
            const oIdx = p * 4;
            if (col && col.a > 0) {
              imgD.data[oIdx] = col.r;
              imgD.data[oIdx + 1] = col.g;
              imgD.data[oIdx + 2] = col.b;
              imgD.data[oIdx + 3] = col.a;
            }
          }
          cCtx.putImageData(imgD, 0, 0);
          terrainCanvasCache.set(normKey, c);
          return c;
        }
      }
    }

    const shp = await assetLoader.getShp(map.theater, normKey);
    if (shp && shp.frames.length > 0) {
      const c = renderShpFrameToCanvas(shp, 0, basePalette);
      terrainCanvasCache.set(normKey, c);
      return c;
    }

    const fallbackTmpl = await assetLoader.getTemplate(map.theater, normKey);
    const fallbackTile = fallbackTmpl ? fallbackTmpl.tiles.find((t) => t !== null) || fallbackTmpl.tiles[0] : null;
    if (fallbackTile) {
      const c = document.createElement('canvas');
      c.width = tileSize;
      c.height = tileSize;
      const cCtx = c.getContext('2d');
      if (cCtx) {
        const imgD = cCtx.createImageData(tileSize, tileSize);
        for (let p = 0; p < fallbackTile.length; p++) {
          const col = basePalette[fallbackTile[p]];
          const oIdx = p * 4;
          if (col && col.a > 0) {
            imgD.data[oIdx] = col.r;
            imgD.data[oIdx + 1] = col.g;
            imgD.data[oIdx + 2] = col.b;
            imgD.data[oIdx + 3] = col.a;
          }
        }
        cCtx.putImageData(imgD, 0, 0);
        terrainCanvasCache.set(normKey, c);
        return c;
      }
    }

    terrainCanvasCache.set(normKey, null);
    return null;
  };

  for (let y = 0; y < 128; y++) {
    for (let x = 0; x < 128; x++) {
      const cellIdx = y * 128 + x;
      const cell = map.cells[cellIdx];
      if (!cell?.terrain || (options.onlyDrawVisible && cell.isOutOfBounds)) continue;

      const normT = normalizeTemplateName(cell.terrain);
      const isWallTerrain = normT.startsWith('xtra') || normT.startsWith('wall') || normT.startsWith('lwal');
      if (isWallTerrain && !drawWalls) continue;

      const targetPx = x * tileSize;
      const targetPy = y * tileSize;
      const shpCanvas = await getTerrainCanvas(normT);
      if (shpCanvas) {
        ctx.drawImage(shpCanvas, targetPx, targetPy);
      }
    }
  }

  // 10. Draw Waypoints (Iran C# Canonical Red Outlined Wireframe and Red Number Text)
  if (options.showWaypoints && map.waypoints.length > 0) {
    ctx.strokeStyle = '#ff0000';
    ctx.lineWidth = 1;
    ctx.fillStyle = '#ff0000';
    ctx.font = 'bold 11px Tahoma, Arial, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';

    for (const wp of map.waypoints) {
      const wx = wp.x * tileSize;
      const wy = wp.y * tileSize;

      // Draw red outline box (22x22 inside 24x24 tile with 1px border)
      ctx.strokeRect(wx + 1.5, wy + 1.5, 21, 21);

      // Draw red number text with exact C# horizontal adjustments
      const text = wp.id.toString();
      let xAdjust = 8;
      if (text.length === 2) {
        xAdjust = text[0] === '1' ? 4 : 5;
      }
      ctx.fillText(text, wx + xAdjust, wy + 5);
    }
  }

  // 11. Draw Out of Bounds Shading (if not onlyDrawVisible)
  if (!options.onlyDrawVisible) {
    ctx.fillStyle = 'rgba(0, 162, 232, 0.17647)'; // C# Color.FromArgb(45, 0, 162, 232)
    for (let y = 0; y < 128; y++) {
      for (let x = 0; x < 128; x++) {
        const cellIdx = y * 128 + x;
        if (map.cells[cellIdx]?.isOutOfBounds) {
          ctx.fillRect(x * tileSize, y * tileSize, tileSize, tileSize);
        }
      }
    }
  }

  // 12. Transfer onto targetCanvas (with visible-only cropping or full-map scaling)
  if (options.onlyDrawVisible) {
    const cropX = map.mapX * tileSize;
    const cropY = map.mapY * tileSize;
    const cropW = map.mapWidth * tileSize;
    const cropH = map.mapHeight * tileSize;

    const outW = Math.max(1, Math.round(cropW * scale));
    const outH = Math.max(1, Math.round(cropH * scale));
    targetCanvas.width = outW;
    targetCanvas.height = outH;

    const targetCtx = targetCanvas.getContext('2d');
    if (targetCtx) {
      targetCtx.imageSmoothingEnabled = false;
      targetCtx.drawImage(
        nativeCanvas,
        cropX,
        cropY,
        cropW,
        cropH,
        0,
        0,
        outW,
        outH
      );
    }
  } else {
    const outW = Math.max(1, Math.round(fullWidth * scale));
    const outH = Math.max(1, Math.round(fullHeight * scale));
    targetCanvas.width = outW;
    targetCanvas.height = outH;

    const targetCtx = targetCanvas.getContext('2d');
    if (targetCtx) {
      targetCtx.imageSmoothingEnabled = false;
      targetCtx.drawImage(
        nativeCanvas,
        0,
        0,
        fullWidth,
        fullHeight,
        0,
        0,
        outW,
        outH
      );
    }
  }
}
