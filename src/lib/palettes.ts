import { PaletteId } from '../types';

export type RGB = [number, number, number];

// Generate authentic C&C / Red Alert 1 256-color palette ramps
function generatePalette(type: PaletteId): RGB[] {
  const pal: RGB[] = new Array(256);

  // Default black for index 0
  pal[0] = [0, 0, 0];

  // 1-15: Grayscale ramp (black to pure white)
  for (let i = 1; i < 16; i++) {
    const val = Math.round((i / 15) * 255);
    pal[i] = [val, val, val];
  }

  // 16-31: Allied Blue ramp (Dark navy to electric cyan)
  for (let i = 0; i < 16; i++) {
    const t = i / 15;
    pal[16 + i] = [
      Math.round(10 * (1 - t) + 80 * t),
      Math.round(20 * (1 - t) + 180 * t),
      Math.round(80 * (1 - t) + 255 * t),
    ];
  }

  // 32-47: Soviet Red ramp (Dark burgundy to intense fire red)
  for (let i = 0; i < 16; i++) {
    const t = i / 15;
    pal[32 + i] = [
      Math.round(60 * (1 - t) + 245 * t),
      Math.round(5 * (1 - t) + 40 * t),
      Math.round(5 * (1 - t) + 40 * t),
    ];
  }

  // 48-63: Ore / Gold ramp (Dark amber to shimmering gold)
  for (let i = 0; i < 16; i++) {
    const t = i / 15;
    pal[48 + i] = [
      Math.round(80 * (1 - t) + 255 * t),
      Math.round(50 * (1 - t) + 220 * t),
      Math.round(10 * (1 - t) + 60 * t),
    ];
  }

  // 64-95: Terrain Green / Grass ramp (Temperate) vs Ice (Snow)
  if (type === 'snow') {
    // Snow & Ice tones
    for (let i = 0; i < 32; i++) {
      const t = i / 31;
      pal[64 + i] = [
        Math.round(160 * (1 - t) + 245 * t),
        Math.round(180 * (1 - t) + 250 * t),
        Math.round(200 * (1 - t) + 255 * t),
      ];
    }
  } else if (type === 'interior') {
    // Steel / Concrete / Facility gray-blues
    for (let i = 0; i < 32; i++) {
      const t = i / 31;
      pal[64 + i] = [
        Math.round(40 * (1 - t) + 160 * t),
        Math.round(45 * (1 - t) + 170 * t),
        Math.round(55 * (1 - t) + 185 * t),
      ];
    }
  } else {
    // Temperate lush green grass & pine forest
    for (let i = 0; i < 32; i++) {
      const t = i / 31;
      pal[64 + i] = [
        Math.round(12 * (1 - t) + 95 * t),
        Math.round(35 * (1 - t) + 180 * t),
        Math.round(10 * (1 - t) + 60 * t),
      ];
    }
  }

  // 96-127: Earth, Dirt, Cliffs, Mud
  for (let i = 0; i < 32; i++) {
    const t = i / 31;
    pal[96 + i] = [
      Math.round(45 * (1 - t) + 175 * t),
      Math.round(30 * (1 - t) + 130 * t),
      Math.round(15 * (1 - t) + 85 * t),
    ];
  }

  // 128-159: Water ramp (Deep trench navy to shallow river aqua)
  for (let i = 0; i < 32; i++) {
    const t = i / 31;
    pal[128 + i] = [
      Math.round(5 * (1 - t) + 40 * t),
      Math.round(25 * (1 - t) + 130 * t),
      Math.round(65 * (1 - t) + 190 * t),
    ];
  }

  // 160-191: Sand / Road / Concrete / Rock slates
  for (let i = 0; i < 32; i++) {
    const t = i / 31;
    pal[160 + i] = [
      Math.round(110 * (1 - t) + 215 * t),
      Math.round(105 * (1 - t) + 205 * t),
      Math.round(85 * (1 - t) + 175 * t),
    ];
  }

  // 192-223: Tiberium Green / Radioactive / Hazard Orange
  for (let i = 0; i < 16; i++) {
    const t = i / 15;
    pal[192 + i] = [
      Math.round(20 * (1 - t) + 50 * t),
      Math.round(90 * (1 - t) + 245 * t),
      Math.round(15 * (1 - t) + 60 * t),
    ];
  }
  for (let i = 0; i < 16; i++) {
    const t = i / 15;
    pal[208 + i] = [
      Math.round(180 * (1 - t) + 255 * t),
      Math.round(70 * (1 - t) + 140 * t),
      Math.round(10 * (1 - t) + 30 * t),
    ];
  }

  // 224-255: Vibrant UI, Radar markers, Team colors, White radar blips
  const specialColors: RGB[] = [
    [255, 255, 0], // Yellow player
    [0, 255, 255], // Cyan player
    [255, 0, 255], // Magenta
    [255, 128, 0], // Orange player
    [0, 255, 0],   // Green player
    [128, 0, 255], // Purple
    [255, 255, 255], // White radar
    [64, 64, 64],
  ];

  for (let i = 224; i < 256; i++) {
    const spec = specialColors[(i - 224) % specialColors.length];
    const shade = 1 - Math.floor((i - 224) / specialColors.length) * 0.2;
    pal[i] = [
      Math.round(spec[0] * shade),
      Math.round(spec[1] * shade),
      Math.round(spec[2] * shade),
    ];
  }

  return pal;
}

export const PALETTES: Record<PaletteId, { name: string; description: string; colors: RGB[] }> = {
  temperat: {
    name: 'Temperate (TEMPERAT.PAL)',
    description: 'Classic green grass, rivers, cliffs, ore, and standard Red Alert terrain.',
    colors: generatePalette('temperat'),
  },
  snow: {
    name: 'Snow (SNOW.PAL)',
    description: 'Frozen tundra, ice sheets, snow banks, rock outcroppings, and cold water.',
    colors: generatePalette('snow'),
  },
  interior: {
    name: 'Interior (INTERIOR.PAL)',
    description: 'Underground labs, steel plating, concrete corridors, hazard caution lines.',
    colors: generatePalette('interior'),
  },
  universal: {
    name: 'Universal 6-6-6 Color Cube',
    description: 'Evenly distributed 216 RGB gamut for non-standard artwork and logos.',
    colors: (() => {
      const colors: RGB[] = [];
      for (let r = 0; r < 6; r++) {
        for (let g = 0; g < 6; g++) {
          for (let b = 0; b < 6; b++) {
            colors.push([Math.round((r / 5) * 255), Math.round((g / 5) * 255), Math.round((b / 5) * 255)]);
          }
        }
      }
      // Pad to 256
      while (colors.length < 256) {
        colors.push([0, 0, 0]);
      }
      return colors;
    })(),
  },
};

/**
 * Finds the closest color in the palette using human perception weights
 */
export function findClosestPaletteIndex(r: number, g: number, b: number, palette: RGB[]): number {
  let closestIndex = 0;
  let minDistance = Infinity;

  for (let i = 0; i < 256; i++) {
    const pr = palette[i][0];
    const pg = palette[i][1];
    const pb = palette[i][2];

    const dr = r - pr;
    const dg = g - pg;
    const db = b - pb;

    // Weighted Euclidean perception distance
    const dist = 0.3 * dr * dr + 0.59 * dg * dg + 0.11 * db * db;
    if (dist < minDistance) {
      minDistance = dist;
      closestIndex = i;
    }
  }

  return closestIndex;
}

/**
 * Converts standard RGBA pixel buffer into 8-bit paletted indices with optional Floyd-Steinberg dithering
 */
export function quantizeImageTo8Bit(
  imageData: ImageData,
  palette: RGB[],
  useDithering: boolean = true
): { indices: Uint8Array; quantizedImageData: ImageData } {
  const { width, height } = imageData;
  const totalPixels = width * height;
  const indices = new Uint8Array(totalPixels);

  // Copy working buffer as floats for error diffusion dithering
  const rBuf = new Float32Array(totalPixels);
  const gBuf = new Float32Array(totalPixels);
  const bBuf = new Float32Array(totalPixels);

  for (let i = 0; i < totalPixels; i++) {
    rBuf[i] = imageData.data[i * 4];
    gBuf[i] = imageData.data[i * 4 + 1];
    bBuf[i] = imageData.data[i * 4 + 2];
  }

  const outputImageData = new ImageData(width, height);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      const alpha = imageData.data[idx * 4 + 3];

      // If nearly transparent, map to index 0 (black / transparent)
      if (alpha < 64) {
        indices[idx] = 0;
        outputImageData.data[idx * 4] = 0;
        outputImageData.data[idx * 4 + 1] = 0;
        outputImageData.data[idx * 4 + 2] = 0;
        outputImageData.data[idx * 4 + 3] = 0;
        continue;
      }

      const curR = Math.min(255, Math.max(0, rBuf[idx]));
      const curG = Math.min(255, Math.max(0, gBuf[idx]));
      const curB = Math.min(255, Math.max(0, bBuf[idx]));

      const palIndex = findClosestPaletteIndex(curR, curG, curB, palette);
      indices[idx] = palIndex;

      const palColor = palette[palIndex];
      outputImageData.data[idx * 4] = palColor[0];
      outputImageData.data[idx * 4 + 1] = palColor[1];
      outputImageData.data[idx * 4 + 2] = palColor[2];
      outputImageData.data[idx * 4 + 3] = 255;

      if (useDithering) {
        const errR = curR - palColor[0];
        const errG = curG - palColor[1];
        const errB = curB - palColor[2];

        // Floyd-Steinberg error distribution:
        // Right: 7/16, Down-Left: 3/16, Down: 5/16, Down-Right: 1/16
        if (x + 1 < width) {
          const neighbor = idx + 1;
          rBuf[neighbor] += (errR * 7) / 16;
          gBuf[neighbor] += (errG * 7) / 16;
          bBuf[neighbor] += (errB * 7) / 16;
        }
        if (y + 1 < height) {
          if (x - 1 >= 0) {
            const neighbor = (y + 1) * width + (x - 1);
            rBuf[neighbor] += (errR * 3) / 16;
            gBuf[neighbor] += (errG * 3) / 16;
            bBuf[neighbor] += (errB * 3) / 16;
          }
          const downNeighbor = (y + 1) * width + x;
          rBuf[downNeighbor] += (errR * 5) / 16;
          gBuf[downNeighbor] += (errG * 5) / 16;
          bBuf[downNeighbor] += (errB * 5) / 16;

          if (x + 1 < width) {
            const neighbor = (y + 1) * width + (x + 1);
            rBuf[neighbor] += (errR * 1) / 16;
            gBuf[neighbor] += (errG * 1) / 16;
            bBuf[neighbor] += (errB * 1) / 16;
          }
        }
      }
    }
  }

  return { indices, quantizedImageData: outputImageData };
}

/**
 * Converts RGBA pixels into 16-bit RGB 565 buffer (Little-Endian)
 */
export function convertToRGB565(imageData: ImageData): { buffer: Uint8Array; previewImageData: ImageData } {
  const { width, height } = imageData;
  const totalPixels = width * height;
  const buffer = new Uint8Array(totalPixels * 2);
  const previewImageData = new ImageData(width, height);

  for (let i = 0; i < totalPixels; i++) {
    const r = imageData.data[i * 4];
    const g = imageData.data[i * 4 + 1];
    const b = imageData.data[i * 4 + 2];
    const a = imageData.data[i * 4 + 3];

    // Quantize to 5-6-5 bits
    const r5 = (r >> 3) & 0x1f;
    const g6 = (g >> 2) & 0x3f;
    const b5 = (b >> 3) & 0x1f;

    const rgb16 = a < 64 ? 0 : (r5 << 11) | (g6 << 5) | b5;

    // Little-endian
    buffer[i * 2] = rgb16 & 0xff;
    buffer[i * 2 + 1] = (rgb16 >> 8) & 0xff;

    // Reconstructed preview
    previewImageData.data[i * 4] = (r5 * 255) / 31;
    previewImageData.data[i * 4 + 1] = (g6 * 255) / 63;
    previewImageData.data[i * 4 + 2] = (b5 * 255) / 31;
    previewImageData.data[i * 4 + 3] = a < 64 ? 0 : 255;
  }

  return { buffer, previewImageData };
}
