/**
 * Red Alert 1 MPR Map Parser & Preview Generator
 * Ported and adapted from Iran's RAFullMapPreviewGenerator & OpenRA Format80 Engine
 * Converts Red Alert 1 map files (*.mpr, *.ini) into PNG images with tactical terrain,
 * overlays, player spawn waypoints, structures, and boundaries.
 */

import { PALETTES } from './palettes';
import { PaletteId } from '../types';

export interface MprCell {
  template: number;
  tile: number;
  overlay: string | null;
  terrain: string | null;
  isOutOfBounds: boolean;
}

export interface MprWaypoint {
  id: number;
  x: number;
  y: number;
  isSpawn: boolean;
}

export interface MprStructure {
  name: string;
  side: string;
  hp: number;
  x: number;
  y: number;
  angle: number;
}

export interface MprUnit {
  name: string;
  side: string;
  x: number;
  y: number;
  angle: number;
}

export interface MprMapData {
  title: string;
  theater: 'temperate' | 'snow' | 'winter' | 'desert' | 'interior';
  mapX: number;
  mapY: number;
  mapWidth: number;
  mapHeight: number;
  cells: MprCell[]; // 128 x 128 = 16384 cells
  waypoints: MprWaypoint[];
  structures: MprStructure[];
  units: MprUnit[];
  hasMapPack: boolean;
  hasOverlayPack: boolean;
  hasEmbeddedPreview: boolean;
  embeddedPreview?: {
    width: number;
    height: number;
    previewPackText: string;
  };
  goldCellCount: number;
  gemCellCount: number;
  wallCellCount: number;
  playerSpawnCount: number;
}

export interface MprRenderOptions {
  cellSize: number; // e.g. 2, 4, 8, 12, 16 pixels per cell
  onlyDrawVisible: boolean; // Crop to Map bounds (X, Y, Width, Height) like Iran's --drawvisibleonly
  showWaypoints: boolean; // Draw numbered spawn badges (1 to 8)
  showOre: boolean; // Draw shimmering gold ore & ruby gems
  showStructures: boolean; // Draw team-colored structure markers
  showWalls?: boolean; // Draw concrete walls, sandbags, fences (BRIK, SBAG, CYCL, BARB, WOOD, FENC)
  showGrid: boolean; // Draw faint tactical grid
  theaterOverride?: 'temperate' | 'snow' | 'winter' | 'desert' | 'interior';
}

/**
 * OpenRA / Westwood Format80 Decompression Engine
 * Direct port of Format80.cs from Iran's RAFullMapPreviewGenerator
 */
export function decodeFormat80(src: Uint8Array, dest: Uint8Array): number {
  let srcPos = 0;
  let destIndex = 0;
  const srcLen = src.length;

  const readByte = (): number => {
    return srcPos < srcLen ? src[srcPos++] : 0;
  };

  const readWord = (): number => {
    const lo = readByte();
    const hi = readByte();
    return lo | (hi << 8);
  };

  while (srcPos < srcLen && destIndex < dest.length) {
    const i = readByte();

    if ((i & 0x80) === 0) {
      // Case 2: Relative copy
      const secondByte = readByte();
      const count = ((i & 0x70) >> 4) + 3;
      const rpos = ((i & 0x0f) << 8) + secondByte;
      const srcIndex = destIndex - rpos;
      if (srcIndex < 0) {
        // Guard against negative relative index
        destIndex += count;
        continue;
      }
      for (let c = 0; c < count && destIndex + c < dest.length; c++) {
        dest[destIndex + c] = dest[srcIndex + c];
      }
      destIndex += count;
    } else if ((i & 0x40) === 0) {
      // Case 1: Short literal copy
      const count = i & 0x3f;
      if (count === 0) {
        return destIndex; // Westwood Format80 0-length run terminator
      }
      for (let c = 0; c < count && destIndex < dest.length; c++) {
        dest[destIndex++] = readByte();
      }
    } else {
      const count3 = i & 0x3f;
      if (count3 === 0x3e) {
        // Case 4: Repeated color fill
        const count = readWord();
        const color = readByte();
        for (let c = 0; c < count && destIndex < dest.length; c++) {
          dest[destIndex++] = color;
        }
      } else if (count3 === 0x3f) {
        // Case 5: Long absolute copy
        const count = readWord();
        let srcIndex = readWord();
        for (let c = 0; c < count && destIndex < dest.length; c++) {
          dest[destIndex++] = dest[srcIndex++];
        }
      } else {
        // Case 3: Medium absolute copy
        const count = count3 + 3;
        let srcIndex = readWord();
        for (let c = 0; c < count && destIndex < dest.length; c++) {
          dest[destIndex++] = dest[srcIndex++];
        }
      }
    }
  }

  return destIndex;
}

/**
 * Unpacks a Westwood chunked base64 packed section (MapPack or OverlayPack)
 * Each chunk starts with a 32-bit uint length (masked with 0xdfffffff) followed
 * by Format80 encoded data that expands into 8192 bytes.
 */
export function unpackPackedSection(iniText: string, sectionName: string): Uint8Array | null {
  const regex = new RegExp(`\\[${sectionName}\\]([\\s\\S]*?)(?=\\n\\[|$)`, 'i');
  const match = iniText.match(regex);
  if (!match) return null;

  const lines = match[1]
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.includes('='))
    .map((l) => {
      const eqIdx = l.indexOf('=');
      return l.substring(eqIdx + 1).trim();
    })
    .join('');

  if (!lines) return null;

  try {
    const rawBinary = atob(lines);
    const buf = new Uint8Array(rawBinary.length);
    for (let i = 0; i < rawBinary.length; i++) {
      buf[i] = rawBinary.charCodeAt(i);
    }

    let offset = 0;
    const chunks: Uint8Array[] = [];

    while (offset + 4 <= buf.length) {
      const length =
        (buf[offset] |
          (buf[offset + 1] << 8) |
          (buf[offset + 2] << 16) |
          (buf[offset + 3] << 24)) &
        0xdfffffff;

      offset += 4;
      if (length <= 0 || offset + length > buf.length) break;

      const src = buf.subarray(offset, offset + length);
      offset += length;

      const dest = new Uint8Array(8192);
      decodeFormat80(src, dest);
      chunks.push(dest);
    }

    if (chunks.length === 0) return null;

    const total = new Uint8Array(chunks.length * 8192);
    chunks.forEach((chunk, index) => {
      total.set(chunk, index * 8192);
    });

    return total;
  } catch (err) {
    console.warn(`Failed to unpack section [${sectionName}]:`, err);
    return null;
  }
}

/**
 * Overlay byte to overlay type string mapping from Iran's RAFullMapPreviewGenerator
 */
export function nameFromOverlayByte(b: number): string | null {
  switch (b) {
    case 0x00: return 'SBAG';
    case 0x01: return 'CYCL';
    case 0x02: return 'BRIK';
    case 0x03: return 'BARB';
    case 0x04: return 'WOOD';
    case 0x05: return 'GOLD01';
    case 0x06: return 'GOLD02';
    case 0x07: return 'GOLD03';
    case 0x08: return 'GOLD04';
    case 0x09: return 'GEM01';
    case 0x0a: return 'GEM02';
    case 0x0b: return 'GEM03';
    case 0x0c: return 'GEM04';
    case 0x0d: return 'V12';
    case 0x0e: return 'V13';
    case 0x0f: return 'V14';
    case 0x10: return 'V15';
    case 0x11: return 'V16';
    case 0x12: return 'V17';
    case 0x13: return 'V18';
    case 0x14: return 'FPLS';
    case 0x15: return 'WCRATE';
    case 0x16: return 'SCRATE';
    case 0x17: return 'FENC';
    case 0x18: return 'WWCRATE';
    case 0xff:
    default:
      return null;
  }
}

export function isWallName(ov: string | null | undefined): boolean {
  if (!ov) return false;
  const u = ov.trim().toUpperCase();
  return (
    ['SBAG', 'CYCL', 'BRIK', 'BARB', 'WOOD', 'FENC'].includes(u) ||
    u.startsWith('XTRA') ||
    u.startsWith('WALL') ||
    u.startsWith('LWAL')
  );
}

/**
 * Template classifier based on Tilesets.ini in Iran's RAFullMapPreviewGenerator
 */
export type TerrainCategory =
  | 'clear'
  | 'water'
  | 'shore'
  | 'cliff'
  | 'water_cliff'
  | 'river'
  | 'river_cliff'
  | 'bridge'
  | 'ford'
  | 'road'
  | 'interior_floor'
  | 'interior_wall';

export function classifyTemplate(templateId: number): TerrainCategory {
  if (templateId === 0 || templateId === 255 || templateId === 65535) return 'clear';

  // Water: w1=1, w2=2, falls=125..128
  if (templateId === 1 || templateId === 2 || (templateId >= 125 && templateId <= 128)) {
    return 'water';
  }

  // Shore: sh01..sh56 (3..58)
  if (templateId >= 3 && templateId <= 58) {
    return 'shore';
  }

  // Water Cliffs: wc01..wc38 (59..96)
  if (templateId >= 59 && templateId <= 96) {
    return 'water_cliff';
  }

  // Slopes & Cliffs: s01..s38 (135..172), hill01=400, b1..b3=97..99
  if ((templateId >= 135 && templateId <= 172) || templateId === 400 || (templateId >= 97 && templateId <= 99)) {
    return 'cliff';
  }

  // Rivers: rv01..rv15 (112..124, 229, 230)
  if ((templateId >= 112 && templateId <= 124) || templateId === 229 || templateId === 230) {
    return 'river';
  }

  // River cliffs: rc01..rc04 (231..234)
  if (templateId >= 231 && templateId <= 234) {
    return 'river_cliff';
  }

  // Bridges & Fords: br1a..br3f (235..246), bridge1/2 (131..134, 378..383), fords (129, 130, 216..226, 247..252)
  if (
    (templateId >= 235 && templateId <= 246) ||
    (templateId >= 131 && templateId <= 134) ||
    (templateId >= 378 && templateId <= 383)
  ) {
    return 'bridge';
  }
  if (
    (templateId >= 216 && templateId <= 226) ||
    (templateId >= 247 && templateId <= 252) ||
    templateId === 129 ||
    templateId === 130
  ) {
    return 'ford';
  }

  // Roads / Dirt: d01..d45 (173..215, 227, 228), p01..p14 (103..110), arro (253..267)
  if (
    (templateId >= 173 && templateId <= 215) ||
    templateId === 227 ||
    templateId === 228 ||
    (templateId >= 103 && templateId <= 110) ||
    (templateId >= 253 && templateId <= 267)
  ) {
    return 'road';
  }

  // Interior: flor (268..274), gflr (275..279), strp (318..328), gstr (280..290)
  if (
    (templateId >= 268 && templateId <= 274) ||
    (templateId >= 275 && templateId <= 279) ||
    (templateId >= 318 && templateId <= 328) ||
    (templateId >= 280 && templateId <= 290)
  ) {
    return 'interior_floor';
  }

  // Interior Walls: wall (329..377), LWAL (291..317), xtra (384..399)
  if (
    (templateId >= 329 && templateId <= 377) ||
    (templateId >= 291 && templateId <= 317) ||
    (templateId >= 384 && templateId <= 399)
  ) {
    return 'interior_wall';
  }

  return 'clear';
}

/**
 * Parses full Red Alert .MPR or .INI file
 */
export function parseMprMap(fileContent: string): MprMapData {
  // 1. Helper to extract section key-values
  const getSectionLines = (secName: string): string[] => {
    const reg = new RegExp(`\\[${secName}\\]([\\s\\S]*?)(?=\\n\\[|$)`, 'i');
    const m = fileContent.match(reg);
    if (!m) return [];
    return m[1]
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l.length > 0 && !l.startsWith(';'));
  };

  const getSectionMap = (secName: string): Record<string, string> => {
    const res: Record<string, string> = {};
    for (const line of getSectionLines(secName)) {
      const idx = line.indexOf('=');
      if (idx !== -1) {
        const k = line.substring(0, idx).trim();
        const v = line.substring(idx + 1).trim();
        res[k.toLowerCase()] = v;
      }
    }
    return res;
  };

  // 2. Parse [Basic] & [Map]
  const basicMap = getSectionMap('Basic');
  const mapSec = getSectionMap('Map');

  const title = basicMap['name'] || 'Unnamed Map';
  let theaterStr = (mapSec['theater'] || 'temperate').toLowerCase();
  if (
    theaterStr !== 'temperate' &&
    theaterStr !== 'snow' &&
    theaterStr !== 'winter' &&
    theaterStr !== 'desert' &&
    theaterStr !== 'interior'
  ) {
    theaterStr = 'temperate';
  }
  const theater = theaterStr as MprMapData['theater'];

  const mapX = parseInt(mapSec['x'] || '0', 10);
  const mapY = parseInt(mapSec['y'] || '0', 10);
  const mapWidth = parseInt(mapSec['width'] || '128', 10);
  const mapHeight = parseInt(mapSec['height'] || '128', 10);

  // 3. Initialize 16384 cells
  const cells: MprCell[] = new Array(16384);
  for (let i = 0; i < 16384; i++) {
    const x = i % 128;
    const y = Math.floor(i / 128);
    const isOutOfBounds =
      x < mapX || x >= mapX + mapWidth || y < mapY || y >= mapY + mapHeight;
    cells[i] = {
      template: 0,
      tile: 0,
      overlay: null,
      terrain: null,
      isOutOfBounds,
    };
  }

  let goldCellCount = 0;
  let gemCellCount = 0;
  let wallCellCount = 0;

  // 4. Unpack MapPack
  const mapPackBytes = unpackPackedSection(fileContent, 'MapPack');
  const hasMapPack = mapPackBytes !== null && mapPackBytes.length >= 49152;
  if (hasMapPack && mapPackBytes) {
    // First 16384 words (32768 bytes) = Template IDs
    for (let i = 0; i < 16384; i++) {
      const lo = mapPackBytes[i * 2];
      const hi = mapPackBytes[i * 2 + 1];
      const tmplId = lo | (hi << 8);
      cells[i].template = tmplId;
      if (
        (tmplId >= 329 && tmplId <= 377) ||
        (tmplId >= 291 && tmplId <= 317) ||
        (tmplId >= 384 && tmplId <= 399)
      ) {
        wallCellCount++;
      }
    }
    // Next 16384 bytes = Tile indices
    const tileOffset = 32768;
    for (let i = 0; i < 16384; i++) {
      cells[i].tile = mapPackBytes[tileOffset + i];
    }
  }

  // 5. Unpack OverlayPack & [Overlay]
  const overlayPackBytes = unpackPackedSection(fileContent, 'OverlayPack');

  if (overlayPackBytes && overlayPackBytes.length >= 16384) {
    for (let i = 0; i < 16384; i++) {
      const b = overlayPackBytes[i];
      const ov = nameFromOverlayByte(b);
      if (ov) {
        cells[i].overlay = ov;
        if (ov.startsWith('GOLD')) goldCellCount++;
        else if (ov.startsWith('GEM')) gemCellCount++;
        else if (isWallName(ov)) wallCellCount++;
      }
    }
  }

  // Also parse text-based [Overlay] section if present in map
  for (const line of getSectionLines('Overlay')) {
    const idx = line.indexOf('=');
    if (idx !== -1) {
      const cellIdx = parseInt(line.substring(0, idx).trim(), 10);
      const ov = line.substring(idx + 1).trim().toUpperCase();
      if (cellIdx >= 0 && cellIdx < 16384 && ov) {
        cells[cellIdx].overlay = ov;
        if (ov.startsWith('GOLD')) goldCellCount++;
        else if (ov.startsWith('GEM')) gemCellCount++;
        else if (isWallName(ov)) wallCellCount++;
      }
    }
  }

  const hasOverlayPack = (overlayPackBytes !== null && overlayPackBytes.length >= 16384) || (goldCellCount > 0 || gemCellCount > 0 || wallCellCount > 0);

  // 6. Parse [TERRAIN]
  for (const line of getSectionLines('Terrain')) {
    const idx = line.indexOf('=');
    if (idx !== -1) {
      const cellIdx = parseInt(line.substring(0, idx).trim(), 10);
      const terr = line.substring(idx + 1).trim();
      if (cellIdx >= 0 && cellIdx < 16384) {
        cells[cellIdx].terrain = terr;
        if (isWallName(terr)) {
          wallCellCount++;
        }
      }
    }
  }

  // 7. Parse [Waypoints]
  const waypoints: MprWaypoint[] = [];
  let playerSpawnCount = 0;
  for (const line of getSectionLines('Waypoints')) {
    const idx = line.indexOf('=');
    if (idx !== -1) {
      const wpId = parseInt(line.substring(0, idx).trim(), 10);
      const cellIdx = parseInt(line.substring(idx + 1).trim(), 10);
      if (cellIdx >= 0 && cellIdx < 16384) {
        const isSpawn = wpId >= 0 && wpId <= 7;
        if (isSpawn) playerSpawnCount++;
        waypoints.push({
          id: wpId,
          x: cellIdx % 128,
          y: Math.floor(cellIdx / 128),
          isSpawn,
        });
      }
    }
  }
  // Sort waypoints with spawn points 0..7 first
  waypoints.sort((a, b) => a.id - b.id);

  // 8. Parse [STRUCTURES]
  const structures: MprStructure[] = [];
  for (const line of getSectionLines('Structures')) {
    const idx = line.indexOf('=');
    if (idx !== -1) {
      const data = line.substring(idx + 1).split(',');
      if (data.length >= 4) {
        // Format: side, name, hp, cellIndex, angle, ...
        const side = data[0].trim();
        const name = data[1].trim().toLowerCase();
        const hp = parseInt(data[2].trim(), 10) || 256;
        const cellIdx = parseInt(data[3].trim(), 10);
        const angle = parseInt(data[4]?.trim() || '0', 10) || 0;
        if (cellIdx >= 0 && cellIdx < 16384) {
          structures.push({
            side,
            name,
            hp,
            x: cellIdx % 128,
            y: Math.floor(cellIdx / 128),
            angle,
          });
        }
      }
    }
  }

  // 9. Parse [UNITS]
  const units: MprUnit[] = [];
  for (const line of getSectionLines('Units')) {
    const idx = line.indexOf('=');
    if (idx !== -1) {
      const data = line.substring(idx + 1).split(',');
      if (data.length >= 4) {
        const side = data[0].trim();
        const name = data[1].trim().toLowerCase();
        const cellIdx = parseInt(data[3].trim(), 10);
        const angle = parseInt(data[4]?.trim() || '0', 10) || 0;
        if (cellIdx >= 0 && cellIdx < 16384) {
          units.push({
            side,
            name,
            x: cellIdx % 128,
            y: Math.floor(cellIdx / 128),
            angle,
          });
        }
      }
    }
  }

  // 10. Check for embedded [Preview] & [PreviewPack]
  const previewLines = getSectionLines('Preview');
  const previewPackLines = getSectionLines('PreviewPack');
  const hasEmbeddedPreview = previewPackLines.length > 0;
  let embeddedPreview: MprMapData['embeddedPreview'] = undefined;

  if (hasEmbeddedPreview) {
    let pW = 128;
    let pH = 128;
    for (const pl of previewLines) {
      if (pl.toLowerCase().startsWith('size=')) {
        const parts = pl.substring(5).split(',').map((p) => parseInt(p.trim(), 10));
        if (parts.length >= 4) {
          pW = parts[2] || 128;
          pH = parts[3] || 128;
        }
      }
    }
    const packText =
      '[Preview]\nSize=0,0,' +
      pW +
      ',' +
      pH +
      '\n\n[PreviewPack]\n' +
      previewPackLines.join('\n');
    embeddedPreview = {
      width: pW,
      height: pH,
      previewPackText: packText,
    };
  }

  return {
    title,
    theater,
    mapX,
    mapY,
    mapWidth,
    mapHeight,
    cells,
    waypoints,
    structures,
    units,
    hasMapPack,
    hasOverlayPack,
    hasEmbeddedPreview,
    embeddedPreview,
    goldCellCount,
    gemCellCount,
    wallCellCount,
    playerSpawnCount,
  };
}

/**
 * Palette styling colors per Red Alert 1 theater
 */
interface TheaterColors {
  clearGround: string[];
  water: string;
  deepWater: string;
  shore: string;
  cliff: string;
  cliffTop: string;
  river: string;
  bridge: string;
  road: string;
  interiorFloor: string;
  interiorWall: string;
  treeColor: string;
}

const THEATER_PALETTES: Record<string, TheaterColors> = {
  temperate: {
    clearGround: ['#235c27', '#2a692e', '#1e5222', '#2f7534'],
    water: '#144672',
    deepWater: '#0c2e4c',
    shore: '#9a8753',
    cliff: '#544637',
    cliffTop: '#6b5c49',
    river: '#1e5588',
    bridge: '#524335',
    road: '#664c31',
    interiorFloor: '#262930',
    interiorWall: '#475569',
    treeColor: '#144820',
  },
  snow: {
    clearGround: ['#dce6ed', '#d3dee6', '#e5eff5', '#c8d4dc'],
    water: '#3d5c70',
    deepWater: '#263d4d',
    shore: '#b5c5cf',
    cliff: '#4b5563',
    cliffTop: '#6b7280',
    river: '#4d718a',
    bridge: '#4a443e',
    road: '#7c8894',
    interiorFloor: '#262930',
    interiorWall: '#475569',
    treeColor: '#162e22',
  },
  winter: {
    clearGround: ['#4e543e', '#575d45', '#454a37', '#5f654b'],
    water: '#1a3d59',
    deepWater: '#10273a',
    shore: '#6b6452',
    cliff: '#423c34',
    cliffTop: '#574f45',
    river: '#234a6c',
    bridge: '#473d33',
    road: '#594b3c',
    interiorFloor: '#262930',
    interiorWall: '#475569',
    treeColor: '#283827',
  },
  desert: {
    clearGround: ['#c49d59', '#cca55f', '#ba934f', '#d4ad67'],
    water: '#205c87',
    deepWater: '#153f5d',
    shore: '#dfbe7d',
    cliff: '#7d5236',
    cliffTop: '#946344',
    river: '#286f9f',
    bridge: '#5e4b3c',
    road: '#876949',
    interiorFloor: '#262930',
    interiorWall: '#475569',
    treeColor: '#4f5c35',
  },
  interior: {
    clearGround: ['#22262d', '#282d36', '#1d2127', '#2e3440'],
    water: '#0a192f',
    deepWater: '#050d1a',
    shore: '#334155',
    cliff: '#475569',
    cliffTop: '#64748b',
    river: '#0f2747',
    bridge: '#64748b',
    road: '#374151',
    interiorFloor: '#2b303c',
    interiorWall: '#64748b',
    treeColor: '#1e293b',
  },
};

/**
 * Player spawn colors (Waypoints 0..7)
 */
export const PLAYER_SPAWN_COLORS = [
  { id: 0, label: 'Player 1 (USSR Red)', color: '#ef4444', border: '#b91c1c' },
  { id: 1, label: 'Player 2 (Allies Blue)', color: '#3b82f6', border: '#1d4ed8' },
  { id: 2, label: 'Player 3 (Green)', color: '#22c55e', border: '#15803d' },
  { id: 3, label: 'Player 4 (Orange)', color: '#f97316', border: '#c2410c' },
  { id: 4, label: 'Player 5 (Cyan)', color: '#06b6d4', border: '#0e7490' },
  { id: 5, label: 'Player 6 (Purple)', color: '#a855f7', border: '#7e22ce' },
  { id: 6, label: 'Player 7 (Pink)', color: '#ec4899', border: '#be185d' },
  { id: 7, label: 'Player 8 (Yellow)', color: '#eab308', border: '#a16207' },
];

/**
 * Structure display colors by house/side
 */
function getHouseColor(side: string): string {
  const s = side.toLowerCase();
  if (s === 'badguy' || s === 'ussr' || s === 'soviet') return '#ef4444';
  if (s === 'goodguy' || s === 'allies' || s === 'greece' || s === 'england') return '#3b82f6';
  if (s === 'spain' || s === 'turkey') return '#eab308';
  if (s === 'ukraine' || s === 'germany') return '#f97316';
  if (s === 'france') return '#06b6d4';
  if (s === 'neutral' || s === 'civilian') return '#94a3b8';
  return '#f59e0b';
}

/**
 * Renders an MPR map onto a Canvas
 */
export function renderMprToCanvas(
  map: MprMapData,
  options: MprRenderOptions,
  targetCanvas: HTMLCanvasElement
): void {
  const theater = options.theaterOverride || map.theater;
  const pal = THEATER_PALETTES[theater] || THEATER_PALETTES.temperate;
  const cSize = options.cellSize;

  // Determine drawing bounds
  const startX = options.onlyDrawVisible ? Math.max(0, map.mapX) : 0;
  const startY = options.onlyDrawVisible ? Math.max(0, map.mapY) : 0;
  const widthCells = options.onlyDrawVisible ? Math.min(128 - startX, map.mapWidth) : 128;
  const heightCells = options.onlyDrawVisible ? Math.min(128 - startY, map.mapHeight) : 128;

  targetCanvas.width = widthCells * cSize;
  targetCanvas.height = heightCells * cSize;

  const ctx = targetCanvas.getContext('2d');
  if (!ctx) return;

  ctx.imageSmoothingEnabled = false;

  // 1. Draw base cells (Terrain)
  for (let y = 0; y < heightCells; y++) {
    for (let x = 0; x < widthCells; x++) {
      const gridX = startX + x;
      const gridY = startY + y;
      const cellIdx = gridY * 128 + gridX;
      const cell = map.cells[cellIdx];
      const px = x * cSize;
      const py = y * cSize;

      if (!options.onlyDrawVisible && cell?.isOutOfBounds) {
        ctx.fillStyle = '#0a0a0c';
        ctx.fillRect(px, py, cSize, cSize);
        continue;
      }

      const cat = classifyTemplate(cell?.template || 0);

      switch (cat) {
        case 'water':
          ctx.fillStyle = pal.water;
          break;
        case 'shore':
          ctx.fillStyle = pal.shore;
          break;
        case 'cliff':
        case 'water_cliff':
          ctx.fillStyle = pal.cliff;
          break;
        case 'river':
        case 'river_cliff':
          ctx.fillStyle = pal.river;
          break;
        case 'bridge':
        case 'ford':
          ctx.fillStyle = pal.bridge;
          break;
        case 'road':
          ctx.fillStyle = pal.road;
          break;
        case 'interior_floor':
          ctx.fillStyle = pal.interiorFloor;
          break;
        case 'interior_wall':
          ctx.fillStyle = pal.interiorWall;
          break;
        case 'clear':
        default: {
          // Micro-texture variation for ground tiles based on tile index
          const varIdx = (gridX * 7 + gridY * 13 + (cell?.tile || 0)) % pal.clearGround.length;
          ctx.fillStyle = pal.clearGround[varIdx];
          break;
        }
      }

      ctx.fillRect(px, py, cSize, cSize);

      // Subtle relief for cliffs, shores, and interior walls
      if (cat === 'cliff' || cat === 'water_cliff') {
        ctx.fillStyle = pal.cliffTop;
        ctx.fillRect(px, py, cSize, Math.max(1, Math.floor(cSize * 0.3)));
      } else if (cat === 'shore') {
        ctx.fillStyle = pal.water;
        ctx.fillRect(px + Math.floor(cSize * 0.6), py + Math.floor(cSize * 0.6), Math.ceil(cSize * 0.4), Math.ceil(cSize * 0.4));
      } else if (cat === 'interior_wall') {
        ctx.fillStyle = '#94a3b8';
        ctx.fillRect(px, py, cSize, Math.max(1, Math.floor(cSize * 0.22)));
        ctx.fillStyle = '#1e293b';
        ctx.fillRect(px, py + cSize - Math.max(1, Math.floor(cSize * 0.22)), cSize, Math.max(1, Math.floor(cSize * 0.22)));
        ctx.fillStyle = '#cbd5e1';
        ctx.fillRect(px + 1, py + 1, Math.max(1, Math.floor(cSize * 0.15)), Math.max(1, Math.floor(cSize * 0.15)));
      }
    }
  }

  // 2. Draw Overlays (Gold Ore, Gems & Walls)
  if (map.hasOverlayPack) {
    for (let y = 0; y < heightCells; y++) {
      for (let x = 0; x < widthCells; x++) {
        const gridX = startX + x;
        const gridY = startY + y;
        const cellIdx = gridY * 128 + gridX;
        const cell = map.cells[cellIdx];
        if (!cell || (!options.onlyDrawVisible && cell.isOutOfBounds)) continue;

        const ov = cell.overlay;
        if (!ov) continue;
        const px = x * cSize;
        const py = y * cSize;

        const isWall = isWallName(ov);

        if (isWall) {
          if (options.showWalls === false) continue;
          // Walls (Concrete, Sandbags, Cyclone, Fences, XTRA/WALL)
          const u = ov.toUpperCase();
          const wallColor = u === 'BRIK' ? '#94a3b8' : u === 'SBAG' ? '#d97706' : u === 'WOOD' ? '#854d0e' : '#64748b';
          ctx.fillStyle = wallColor;
          ctx.fillRect(px + Math.floor(cSize * 0.15), py + Math.floor(cSize * 0.15), Math.max(1, cSize * 0.7), Math.max(1, cSize * 0.7));
          ctx.strokeStyle = '#e2e8f0';
          ctx.lineWidth = 1;
          ctx.strokeRect(px + Math.floor(cSize * 0.15), py + Math.floor(cSize * 0.15), Math.max(1, cSize * 0.7), Math.max(1, cSize * 0.7));
        } else if (ov.startsWith('GOLD') && options.showOre) {
          // Shimmering Gold Ore crystals
          const intensity = parseInt(ov.substring(4), 10) || 1;
          ctx.fillStyle = intensity > 2 ? '#facc15' : '#eab308';
          ctx.fillRect(px + 1, py + 1, cSize - 2, cSize - 2);
          ctx.fillStyle = '#fef08a';
          ctx.fillRect(px + 2, py + 2, Math.max(1, cSize / 3), Math.max(1, cSize / 3));
        } else if (ov.startsWith('GEM') && options.showOre) {
          // Glowing Ruby Gem crystals
          ctx.fillStyle = '#dc2626';
          ctx.fillRect(px + 1, py + 1, cSize - 2, cSize - 2);
          ctx.fillStyle = '#fca5a5';
          ctx.fillRect(px + 2, py + 2, Math.max(1, cSize / 3), Math.max(1, cSize / 3));
        } else if (ov.includes('CRATE') && (options.showOre || options.showStructures)) {
          ctx.fillStyle = '#f59e0b';
          ctx.fillRect(px + 1, py + 1, cSize - 2, cSize - 2);
        }
      }
    }
  }

  // 3. Draw Terrain (Trees & Rocks)
  for (let y = 0; y < heightCells; y++) {
    for (let x = 0; x < widthCells; x++) {
      const gridX = startX + x;
      const gridY = startY + y;
      const cellIdx = gridY * 128 + gridX;
      const cell = map.cells[cellIdx];
      if (!cell?.terrain || (!options.onlyDrawVisible && cell.isOutOfBounds)) continue;

      const px = x * cSize;
      const py = y * cSize;
      const t = cell.terrain.toUpperCase();

      if (t.startsWith('T') || t.startsWith('TREE')) {
        // Tree foliage
        ctx.fillStyle = pal.treeColor;
        ctx.beginPath();
        ctx.arc(px + cSize / 2, py + cSize / 2, Math.max(1.5, cSize * 0.42), 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#22c55e';
        ctx.fillRect(px + Math.floor(cSize * 0.35), py + Math.floor(cSize * 0.35), Math.max(1, cSize * 0.2), Math.max(1, cSize * 0.2));
      } else if (t.startsWith('ROCK') || t.startsWith('MINE')) {
        // Rocks
        ctx.fillStyle = '#4b5563';
        ctx.fillRect(px + 1, py + 1, cSize - 2, cSize - 2);
        ctx.fillStyle = '#9ca3af';
        ctx.fillRect(px + 2, py + 2, Math.max(1, cSize / 3), Math.max(1, cSize / 3));
      } else if (t.startsWith('XTRA') || t.startsWith('WALL') || t.startsWith('LWAL')) {
        // Interior wall / extra prop (e.g. XTRA001, WALL0001)
        if (options.showWalls !== false) {
          ctx.fillStyle = '#475569';
          ctx.fillRect(px, py, cSize, cSize);
          ctx.fillStyle = '#94a3b8';
          ctx.fillRect(px, py, cSize, Math.max(1, Math.floor(cSize * 0.22)));
          ctx.fillStyle = '#1e293b';
          ctx.fillRect(px, py + cSize - Math.max(1, Math.floor(cSize * 0.22)), cSize, Math.max(1, Math.floor(cSize * 0.22)));
        }
      }
    }
  }

  // 4. Draw Structures & Units
  if (options.showStructures && map.structures.length > 0) {
    for (const struct of map.structures) {
      const x = struct.x - startX;
      const y = struct.y - startY;
      if (x < 0 || x >= widthCells || y < 0 || y >= heightCells) continue;

      const px = x * cSize;
      const py = y * cSize;
      const color = getHouseColor(struct.side);

      // Structure footprint (usually 2x2 or 3x3 for large base buildings)
      const isLarge = ['fact', 'weap', 'proc', 'dome', 'syrf', 'atek'].includes(struct.name);
      const span = isLarge ? Math.max(cSize * 1.8, cSize + 2) : Math.max(cSize * 1.2, cSize);

      ctx.fillStyle = color;
      ctx.fillRect(px, py, span, span);

      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = Math.max(1, Math.floor(cSize * 0.15));
      ctx.strokeRect(px, py, span, span);
    }
  }

  // 5. Draw Player Spawn Waypoints (Waypoints 0..7)
  if (options.showWaypoints && map.waypoints.length > 0) {
    for (const wp of map.waypoints) {
      if (!wp.isSpawn) continue;
      const x = wp.x - startX;
      const y = wp.y - startY;
      if (x < 0 || x >= widthCells || y < 0 || y >= heightCells) continue;

      const cx = (x + 0.5) * cSize;
      const cy = (y + 0.5) * cSize;
      const spawnMeta = PLAYER_SPAWN_COLORS[wp.id] || {
        color: '#ffffff',
        border: '#000000',
      };
      const radius = Math.max(5, cSize * 0.9);

      // Outer drop shadow
      ctx.beginPath();
      ctx.arc(cx, cy, radius + 2, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
      ctx.fill();

      // Main circle
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.fillStyle = spawnMeta.color;
      ctx.fill();

      // Border
      ctx.lineWidth = Math.max(1.5, radius * 0.25);
      ctx.strokeStyle = '#ffffff';
      ctx.stroke();

      // Number label (1-indexed for players: 0 -> 1, 1 -> 2, etc.)
      const fontSize = Math.max(8, Math.floor(radius * 1.2));
      ctx.font = `bold ${fontSize}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#ffffff';
      ctx.shadowColor = 'black';
      ctx.shadowBlur = 2;
      ctx.fillText(`${wp.id + 1}`, cx, cy);
      ctx.shadowBlur = 0;
    }
  }

  // 6. Draw Optional Tactical Grid
  if (options.showGrid && cSize >= 8) {
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.lineWidth = 1;
    for (let x = 0; x <= widthCells; x++) {
      ctx.beginPath();
      ctx.moveTo(x * cSize, 0);
      ctx.lineTo(x * cSize, heightCells * cSize);
      ctx.stroke();
    }
    for (let y = 0; y <= heightCells; y++) {
      ctx.beginPath();
      ctx.moveTo(0, y * cSize);
      ctx.lineTo(widthCells * cSize, y * cSize);
      ctx.stroke();
    }
  }
}
