import { LZO } from 'lzo-ts';

/**
 * LZO1X Block Compressor & Decompressor for CnCNet (xna-cncnet-client & XCC Mixer standard)
 * 
 * CnCNet PreviewPack Specification:
 * - Uncompressed pixel data is raw 24-bit RGB (width * height * 3 bytes)
 * - Data is partitioned into chunks of up to 8192 bytes (0x2000)
 * - Each chunk header:
 *     uint16 Little-Endian: sizeCompressed
 *     uint16 Little-Endian: sizeUncompressed
 * - Followed by sizeCompressed bytes of LZO1X compressed stream
 */

const LZO_BLOCK_SIZE = 8192;

/**
 * Compresses raw 24-bit RGB image data into CnCNet / XCC Mixer LZO1X block format
 */
export function compressCncNetLzo24Bit(rgb24: Uint8Array): Uint8Array {
  const blocks: Uint8Array[] = [];
  let pos = 0;
  const totalLen = rgb24.length;

  while (pos < totalLen) {
    const uncompressedSize = Math.min(LZO_BLOCK_SIZE, totalLen - pos);
    const uncompressedBlock = rgb24.subarray(pos, pos + uncompressedSize);
    pos += uncompressedSize;

    const compressed = LZO.compress(uncompressedBlock);

    // 4-byte header: uint16 sizeCompressed, uint16 sizeUncompressed (little-endian)
    const block = new Uint8Array(4 + compressed.length);
    block[0] = compressed.length & 0xff;
    block[1] = (compressed.length >> 8) & 0xff;
    block[2] = uncompressedSize & 0xff;
    block[3] = (uncompressedSize >> 8) & 0xff;

    block.set(compressed, 4);
    blocks.push(block);
  }

  // Concatenate all blocks
  const outputSize = blocks.reduce((acc, b) => acc + b.length, 0);
  const result = new Uint8Array(outputSize);
  let offset = 0;
  for (const b of blocks) {
    result.set(b, offset);
    offset += b.length;
  }

  return result;
}

/**
 * Decompresses CnCNet / XCC Mixer LZO1X block format into 24-bit RGB
 */
export function decompressCncNetLzo24Bit(
  dataSource: Uint8Array,
  expectedWidth: number,
  expectedHeight: number
): ImageData {
  const totalPixels = expectedWidth * expectedHeight;
  const expectedBytes = totalPixels * 3;
  const rawRgb = new Uint8Array(expectedBytes);

  let readBytes = 0;
  let writtenBytes = 0;

  while (readBytes + 4 <= dataSource.length) {
    const sizeCompressed = dataSource[readBytes] | (dataSource[readBytes + 1] << 8);
    readBytes += 2;
    const sizeUncompressed = dataSource[readBytes] | (dataSource[readBytes + 1] << 8);
    readBytes += 2;

    if (sizeCompressed === 0 || sizeUncompressed === 0) break;
    if (readBytes + sizeCompressed > dataSource.length) break;

    const slice = dataSource.subarray(readBytes, readBytes + sizeCompressed);
    readBytes += sizeCompressed;

    const decomp = LZO.decompress(slice);
    const copyLen = Math.min(decomp.length, rawRgb.length - writtenBytes);
    rawRgb.set(decomp.subarray(0, copyLen), writtenBytes);
    writtenBytes += sizeUncompressed;
  }

  const clamped = new Uint8ClampedArray(totalPixels * 4);
  for (let i = 0; i < totalPixels; i++) {
    const rIdx = i * 3;
    clamped[i * 4] = rawRgb[rIdx] || 0;
    clamped[i * 4 + 1] = rawRgb[rIdx + 1] || 0;
    clamped[i * 4 + 2] = rawRgb[rIdx + 2] || 0;
    clamped[i * 4 + 3] = 255;
  }

  if (typeof ImageData !== 'undefined') {
    return new ImageData(clamped, expectedWidth, expectedHeight);
  }
  return {
    width: expectedWidth,
    height: expectedHeight,
    data: clamped,
    colorSpace: 'srgb',
  } as unknown as ImageData;
}
