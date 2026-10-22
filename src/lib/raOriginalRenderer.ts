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
 * Team remap colors for palette indices 80..95
 */
const TEAM_REMAPS: Record<string, [number, number, number][]> = {
  // USSR / BadGuy (Red)
  ussr: [
    [240, 48, 48], [224, 32, 32], [208, 16, 16], [192, 0, 0],
    [176, 0, 0], [160, 0, 0], [144, 0, 0], [128, 0, 0],
    [112, 0, 0], [96, 0, 0], [80, 0, 0], [64, 0, 0],
    [48, 0, 0], [32, 0, 0], [16, 0, 0], [8, 0, 0],
  ],
  // Allies / Greece (Blue)
  allies: [
    [80, 140, 240], [64, 120, 224], [48, 100, 208], [32, 80, 192],
    [16, 64, 176], [0, 48, 160], [0, 36, 144], [0, 28, 128],
    [0, 20, 112], [0, 14, 96], [0, 10, 80], [0, 6, 64],
    [0, 4, 48], [0, 2, 32], [0, 0, 20], [0, 0, 10],
  ],
  // Yellow (Turkey / Spain)
  yellow: [
    [255, 235, 70], [245, 220, 50], [230, 200, 35], [215, 180, 20],
    [195, 160, 10], [175, 140, 5], [155, 120, 0], [135, 105, 0],
    [115, 90, 0], [95, 75, 0], [80, 60, 0], [65, 48, 0],
    [50, 36, 0], [38, 26, 0], [26, 16, 0], [15, 8, 0],
  ],
  // Green
  green: [
    [70, 230, 70], [50, 210, 50], [35, 190, 35], [20, 170, 20],
    [10, 150, 10], [5, 130, 5], [0, 115, 0], [0, 100, 0],
    [0, 85, 0], [0, 70, 0], [0, 55, 0], [0, 42, 0],
    [0, 30, 0], [0, 20, 0], [0, 12, 0], [0, 6, 0],
  ],
  // Orange (Ukraine / Germany)
  orange: [
    [255, 140, 40], [240, 120, 25], [225, 105, 15], [210, 90, 5],
    [190, 78, 0], [170, 65, 0], [150, 54, 0], [132, 44, 0],
    [114, 35, 0], [96, 28, 0], [80, 20, 0], [64, 15, 0],
    [48, 10, 0], [35, 6, 0], [24, 3, 0], [14, 1, 0],
  ],
  // Cyan (France)
  cyan: [
    [80, 230, 240], [60, 210, 220], [45, 190, 200], [30, 170, 180],
    [18, 150, 160], [10, 130, 140], [4, 112, 122], [0, 96, 104],
    [0, 80, 88], [0, 66, 72], [0, 52, 58], [0, 40, 44],
    [0, 30, 32], [0, 20, 22], [0, 12, 14], [0, 6, 8],
  ],
};

export function getRemappedPalette(basePal: Palette, side: string): Palette {
  const s = side.toLowerCase();
  let remapKey = 'ussr';
  if (['goodguy', 'allies', 'greece', 'england'].includes(s)) remapKey = 'allies';
  else if (['spain', 'turkey'].includes(s)) remapKey = 'yellow';
  else if (['ukraine', 'germany'].includes(s)) remapKey = 'orange';
  else if (['france'].includes(s)) remapKey = 'cyan';
  else if (['special', 'green'].includes(s)) remapKey = 'green';

  const remapColors = TEAM_REMAPS[remapKey] || TEAM_REMAPS.ussr;
  const newPal: Palette = basePal.map((c) => ({ ...c }));

  for (let i = 0; i < 16; i++) {
    const rgb = remapColors[i];
    if (rgb) {
      newPal[80 + i] = { r: rgb[0], g: rgb[1], b: rgb[2], a: 255 };
    }
  }
  return newPal;
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

  const frames: RaShpFrame[] = [];
  const headers: { offset: number; format: number; refOffset: number; refFormat: number }[] = [];

  let headerOffset = 14;
  for (let i = 0; i < imageCount; i++) {
    const data = view.getUint32(headerOffset, true);
    const offset = data & 0xffffff;
    const format = data >>> 24;
    const refOffset = view.getUint16(headerOffset + 4, true);
    const refFormat = view.getUint16(headerOffset + 6, true);
    headerOffset += 8;
    headers.push({ offset, format, refOffset, refFormat });
  }

  // Decompress frames
  const framePixelCount = width * height;

  for (let i = 0; i < imageCount; i++) {
    const h = headers[i];
    const frameData = new Uint8Array(framePixelCount);

    if (h.format === 0x80) {
      // Format80 direct compression
      const src = buf.subarray(h.offset);
      decodeFormat80(src, frameData);
    } else if (h.format === 0x20 || h.format === 0x40) {
      // Format20 / Format40 delta from previous or referenced frame
      if (i > 0 && frames[i - 1]) {
        frameData.set(frames[i - 1].data);
      }
      const src = buf.subarray(h.offset);
      decodeFormat40(src, frameData);
    }

    frames.push({ width, height, data: frameData });
  }

  return { imageCount, width, height, frames };
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

  /**
   * Loads and extracts the single ra_data.pack archive into memory
   */
  public async ensurePackLoaded(
    onProgress?: (loadedBytes: number, totalBytes: number) => void
  ): Promise<boolean> {
    if (this.isLoaded) return true;
    if (this.loadPromise) return this.loadPromise;

    this.loadPromise = (async () => {
      try {
        let res = await fetch('/ra_data.pack');
        if (!res.ok) {
          res = await fetch('/ra_data.zip');
        }
        if (!res.ok) throw new Error('Could not find ra_data.pack or ra_data.zip');

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
        return true;
      } catch (err) {
        console.error('Failed to load ra_data.pack:', err);
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

  // Load Template from pack (.tem, .sno, etc.)
  public async getTemplate(theater: string, templateName: string): Promise<RaTemplate | null> {
    const name = templateName.toLowerCase();
    const t = theater.toLowerCase();
    const key = `${t}/${name}`;
    if (this.templateCache.has(key)) return this.templateCache.get(key) || null;
    await this.ensurePackLoaded();

    let ext = '.tem';
    if (t === 'snow') ext = '.sno';
    else if (t === 'desert') ext = '.des';
    else if (t === 'interior') ext = '.int';

    let buf = this.files.get(`${t}/${name}${ext}`);
    if (!buf) {
      // Fallback to temperate if theater doesn't have it
      buf = this.files.get(`temperate/${name}.tem`);
    }

    if (!buf) {
      this.templateCache.set(key, null);
      return null;
    }

    const parsed = parseTemplate(buf);
    this.templateCache.set(key, parsed);
    return parsed;
  }

  // Load SHP from pack
  public async getShp(theater: string, shpName: string): Promise<RaShp | null> {
    const name = shpName.toLowerCase();
    const key = name;
    if (this.shpCache.has(key)) return this.shpCache.get(key) || null;
    await this.ensurePackLoaded();

    let buf = this.files.get(`general/${name}.shp`);
    if (!buf) {
      buf = this.files.get(`${theater.toLowerCase()}/${name}.shp`);
    }

    if (!buf) {
      this.shpCache.set(key, null);
      return null;
    }

    const parsed = parseShp(buf);
    this.shpCache.set(key, parsed);
    return parsed;
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
  await assetLoader.ensurePackLoaded(onProgress);
  await assetLoader.getTilesetMap();
  await assetLoader.getPalette(map.theater);
}

/**
 * Renders an MPR map onto Canvas using original Westwood assets (24x24 tiles)
 */
export async function renderMprOriginalAssets(
  map: MprMapData,
  options: {
    onlyDrawVisible: boolean;
    showWaypoints: boolean;
    showOre: boolean;
    showStructures: boolean;
    scaleMultiplier?: number; // e.g. 1.0 (24px/cell), 0.5 (12px), 0.25 (6px)
  },
  targetCanvas: HTMLCanvasElement
): Promise<void> {
  const tilesetMap = await assetLoader.getTilesetMap();
  const basePalette = await assetLoader.getPalette(map.theater);
  if (!basePalette) return;

  const tileSize = 24; // Original Westwood tile dimension
  const scale = options.scaleMultiplier || 1.0;

  const startX = options.onlyDrawVisible ? Math.max(0, map.mapX) : 0;
  const startY = options.onlyDrawVisible ? Math.max(0, map.mapY) : 0;
  const widthCells = options.onlyDrawVisible ? Math.min(128 - startX, map.mapWidth) : 128;
  const heightCells = options.onlyDrawVisible ? Math.min(128 - startY, map.mapHeight) : 128;

  const finalWidth = Math.round(widthCells * tileSize * scale);
  const finalHeight = Math.round(heightCells * tileSize * scale);

  // Render first at native 24x24 resolution on an offscreen canvas
  const nativeCanvas = document.createElement('canvas');
  nativeCanvas.width = widthCells * tileSize;
  nativeCanvas.height = heightCells * tileSize;
  const ctx = nativeCanvas.getContext('2d');
  if (!ctx) return;

  ctx.imageSmoothingEnabled = false;

  // Pre-load clear1 template (default ground)
  const clear1 = await assetLoader.getTemplate(map.theater, 'clear1');

  // Buffer for fast direct pixel drawing
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

  // 1. Draw Ground Templates (Tiles)
  for (let y = 0; y < heightCells; y++) {
    for (let x = 0; x < widthCells; x++) {
      const gridX = startX + x;
      const gridY = startY + y;
      const cellIdx = gridY * 128 + gridX;
      const cell = map.cells[cellIdx];
      const targetPx = x * tileSize;
      const targetPy = y * tileSize;

      if (!options.onlyDrawVisible && cell?.isOutOfBounds) {
        ctx.fillStyle = '#000000';
        ctx.fillRect(targetPx, targetPy, tileSize, tileSize);
        continue;
      }

      let templateName = 'clear1';
      let tileIndex = cell?.tile || 0;

      if (!cell || cell.template === 0 || cell.template === 255 || cell.template === 65535) {
        templateName = 'clear1';
        tileIndex = (gridX % 4) + (gridY % 4) * 4;
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
        // Fallback to clear ground tile
        const safeTile = (gridX % 4) + (gridY % 4) * 4;
        if (clear1.tiles[safeTile]) {
          drawIndexedTile(clear1.tiles[safeTile]!, targetPx, targetPy, basePalette);
        }
      }
    }
  }

  // 2. Draw Overlays (Gold Ore & Gems using original .tem assets)
  if (options.showOre && map.hasOverlayPack) {
    for (let y = 0; y < heightCells; y++) {
      for (let x = 0; x < widthCells; x++) {
        const gridX = startX + x;
        const gridY = startY + y;
        const cellIdx = gridY * 128 + gridX;
        const cell = map.cells[cellIdx];
        if (!cell?.overlay || (!options.onlyDrawVisible && cell.isOutOfBounds)) continue;

        const ov = cell.overlay.toLowerCase();
        const targetPx = x * tileSize;
        const targetPy = y * tileSize;

        if (ov.startsWith('gold') || ov.startsWith('gem')) {
          const tmpl = await assetLoader.getTemplate(map.theater, ov);
          const frameIdx = ORE_FRAMES[ov] || 0;
          if (tmpl && tmpl.tiles[frameIdx]) {
            drawIndexedTile(tmpl.tiles[frameIdx]!, targetPx, targetPy, basePalette);
          }
        }
      }
    }
  }

  // 3. Draw Terrain (Trees & Rocks using original .shp sprites)
  for (let y = 0; y < heightCells; y++) {
    for (let x = 0; x < widthCells; x++) {
      const gridX = startX + x;
      const gridY = startY + y;
      const cellIdx = gridY * 128 + gridX;
      const cell = map.cells[cellIdx];
      if (!cell?.terrain || (!options.onlyDrawVisible && cell.isOutOfBounds)) continue;

      const targetPx = x * tileSize;
      const targetPy = y * tileSize;
      const shp = await assetLoader.getShp(map.theater, cell.terrain);

      if (shp && shp.frames[0]) {
        const frame = shp.frames[0];
        const shpCanvas = document.createElement('canvas');
        shpCanvas.width = frame.width;
        shpCanvas.height = frame.height;
        const shpCtx = shpCanvas.getContext('2d');
        if (shpCtx) {
          const imgD = shpCtx.createImageData(frame.width, frame.height);
          for (let p = 0; p < frame.data.length; p++) {
            const cIdx = frame.data[p];
            const col = basePalette[cIdx];
            const oIdx = p * 4;
            if (col && col.a > 0) {
              imgD.data[oIdx] = col.r;
              imgD.data[oIdx + 1] = col.g;
              imgD.data[oIdx + 2] = col.b;
              imgD.data[oIdx + 3] = col.a;
            }
          }
          shpCtx.putImageData(imgD, 0, 0);
          ctx.drawImage(shpCanvas, targetPx, targetPy);
        }
      }
    }
  }

  // 4. Draw Structures (Base buildings using original .shp with team remap)
  if (options.showStructures && map.structures.length > 0) {
    for (const struct of map.structures) {
      const x = struct.x - startX;
      const y = struct.y - startY;
      if (x < 0 || x >= widthCells || y < 0 || y >= heightCells) continue;

      const targetPx = x * tileSize;
      const targetPy = y * tileSize;

      const shp = await assetLoader.getShp(map.theater, struct.name);
      if (shp && shp.frames.length > 0) {
        const teamPal = getRemappedPalette(basePalette, struct.side);
        // Default to frame 0 (or angle frame)
        const frameIdx = Math.min(shp.frames.length - 1, struct.angle ? struct.angle % shp.frames.length : 0);
        const frame = shp.frames[frameIdx] || shp.frames[0];

        const sCanvas = document.createElement('canvas');
        sCanvas.width = frame.width;
        sCanvas.height = frame.height;
        const sCtx = sCanvas.getContext('2d');
        if (sCtx) {
          const sImg = sCtx.createImageData(frame.width, frame.height);
          for (let p = 0; p < frame.data.length; p++) {
            const cIdx = frame.data[p];
            const col = teamPal[cIdx];
            const oIdx = p * 4;
            if (col && col.a > 0) {
              sImg.data[oIdx] = col.r;
              sImg.data[oIdx + 1] = col.g;
              sImg.data[oIdx + 2] = col.b;
              sImg.data[oIdx + 3] = col.a;
            }
          }
          sCtx.putImageData(sImg, 0, 0);
          ctx.drawImage(sCanvas, targetPx, targetPy);
        }
      }
    }
  }

  // 5. Draw Player Spawn Waypoints (Waypoints 0..7)
  if (options.showWaypoints && map.waypoints.length > 0) {
    const spawnColors = [
      '#ef4444', '#3b82f6', '#22c55e', '#f97316',
      '#06b6d4', '#a855f7', '#ec4899', '#eab308',
    ];
    for (const wp of map.waypoints) {
      if (!wp.isSpawn) continue;
      const x = wp.x - startX;
      const y = wp.y - startY;
      if (x < 0 || x >= widthCells || y < 0 || y >= heightCells) continue;

      const cx = (x + 0.5) * tileSize;
      const cy = (y + 0.5) * tileSize;
      const radius = 10;

      // Glow & drop shadow
      ctx.beginPath();
      ctx.arc(cx, cy, radius + 2, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
      ctx.fill();

      // Spawn Circle
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.fillStyle = spawnColors[wp.id] || '#ffffff';
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = '#ffffff';
      ctx.stroke();

      // Number
      ctx.font = 'bold 11px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#ffffff';
      ctx.shadowColor = '#000000';
      ctx.shadowBlur = 3;
      ctx.fillText(`${wp.id + 1}`, cx, cy);
      ctx.shadowBlur = 0;
    }
  }

  // 6. Scale and draw onto targetCanvas
  targetCanvas.width = finalWidth;
  targetCanvas.height = finalHeight;
  const targetCtx = targetCanvas.getContext('2d');
  if (targetCtx) {
    targetCtx.imageSmoothingEnabled = false;
    targetCtx.drawImage(
      nativeCanvas,
      0,
      0,
      nativeCanvas.width,
      nativeCanvas.height,
      0,
      0,
      finalWidth,
      finalHeight
    );
  }
}
