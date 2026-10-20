/**
 * Westwood LCW (Format80) Compression & Decompression Engine
 * Used for Command & Conquer: Red Alert 1, Tiberian Dawn, and Tiberian Sun
 * [PreviewPack] and [MapPack] sections.
 */

export class LCW {
  /**
   * Decompresses an LCW (Format80) compressed byte stream
   */
  public static decompress(src: Uint8Array, expectedSize?: number): Uint8Array {
    const dest: number[] = [];
    let srcPos = 0;
    const srcLen = src.length;

    while (srcPos < srcLen) {
      const opcode = src[srcPos++];

      // 0x80 marks End of Stream in Westwood LCW
      if (opcode === 0x80) {
        break;
      }

      // Command 1: Short copy of raw literal bytes (opcode & 0x80 == 0)
      if ((opcode & 0x80) === 0) {
        const count = opcode;
        for (let i = 0; i < count && srcPos < srcLen; i++) {
          dest.push(src[srcPos++]);
        }
      }
      // Command 4: Repeat value (0xFE)
      else if (opcode === 0xfe) {
        if (srcPos + 2 >= srcLen) break;
        const count = src[srcPos] | (src[srcPos + 1] << 8);
        srcPos += 2;
        const val = src[srcPos++];
        for (let i = 0; i < count; i++) {
          dest.push(val);
        }
      }
      // Command 5: Existing block long copy (0xFF)
      else if (opcode === 0xff) {
        if (srcPos + 3 >= srcLen) break;
        const count = src[srcPos] | (src[srcPos + 1] << 8);
        srcPos += 2;
        const pos = src[srcPos] | (src[srcPos + 1] << 8);
        srcPos += 2;
        for (let i = 0; i < count; i++) {
          dest.push(dest[pos + i] || 0);
        }
      }
      // Command 2: Existing block relative copy (opcode & 0xC0 === 0x80)
      else if ((opcode & 0xc0) === 0x80) {
        if (srcPos >= srcLen) break;
        const count = ((opcode >> 4) & 0x03) + 3;
        const offset = ((opcode & 0x0f) << 8) | src[srcPos++];
        const startPos = dest.length - offset;
        for (let i = 0; i < count; i++) {
          dest.push(dest[startPos + i] || 0);
        }
      }
      // Command 3: Existing block medium copy (opcode & 0xC0 === 0xC0)
      else if ((opcode & 0xc0) === 0xc0) {
        if (srcPos + 1 >= srcLen) break;
        const count = (opcode & 0x3f) + 3;
        const pos = src[srcPos] | (src[srcPos + 1] << 8);
        srcPos += 2;
        for (let i = 0; i < count; i++) {
          dest.push(dest[pos + i] || 0);
        }
      }

      if (expectedSize && dest.length >= expectedSize) {
        break;
      }
    }

    return new Uint8Array(dest);
  }

  /**
   * Compresses an uncompressed byte buffer into Westwood LCW (Format80) format
   */
  public static compress(src: Uint8Array, optimization: 'balanced' | 'fast' | 'max' = 'balanced'): Uint8Array {
    const out: number[] = [];
    const srcLen = src.length;
    let pos = 0;

    // Buffer for accumulating raw literal bytes (Command 1)
    const literals: number[] = [];

    const flushLiterals = () => {
      while (literals.length > 0) {
        const chunkLen = Math.min(literals.length, 127);
        out.push(chunkLen); // Command 1 opcode
        for (let i = 0; i < chunkLen; i++) {
          out.push(literals[i]);
        }
        literals.splice(0, chunkLen);
      }
    };

    if (optimization === 'fast') {
      // Fast mode: only runs of repeated bytes (Command 4) + literals (Command 1)
      while (pos < srcLen) {
        const byte = src[pos];
        let runLen = 1;
        while (pos + runLen < srcLen && src[pos + runLen] === byte && runLen < 65535) {
          runLen++;
        }

        if (runLen >= 5) {
          flushLiterals();
          out.push(0xfe); // Command 4 opcode
          out.push(runLen & 0xff);
          out.push((runLen >> 8) & 0xff);
          out.push(byte);
          pos += runLen;
        } else {
          literals.push(byte);
          pos++;
          if (literals.length >= 127) {
            flushLiterals();
          }
        }
      }
      flushLiterals();
      out.push(0x80); // End of stream marker
      return new Uint8Array(out);
    }

    // Full sliding window LZ match search (Balanced / Max)
    const maxWindow = optimization === 'max' ? 4095 : 2048;

    while (pos < srcLen) {
      // 1. Check for repeated byte run
      const byte = src[pos];
      let runLen = 1;
      while (pos + runLen < srcLen && src[pos + runLen] === byte && runLen < 65535) {
        runLen++;
      }

      if (runLen >= 6) {
        flushLiterals();
        out.push(0xfe); // Command 4 opcode
        out.push(runLen & 0xff);
        out.push((runLen >> 8) & 0xff);
        out.push(byte);
        pos += runLen;
        continue;
      }

      // 2. Search sliding window for matching block
      let bestMatchLen = 0;
      let bestMatchOffset = 0;
      const windowStart = Math.max(0, pos - maxWindow);

      // Search previous history buffer
      for (let w = pos - 1; w >= windowStart; w--) {
        if (src[w] === src[pos]) {
          let matchLen = 1;
          while (
            pos + matchLen < srcLen &&
            matchLen < 65535 &&
            src[w + (matchLen % (pos - w))] === src[pos + matchLen]
          ) {
            matchLen++;
          }

          if (matchLen > bestMatchLen) {
            bestMatchLen = matchLen;
            bestMatchOffset = pos - w;
            if (bestMatchLen >= (optimization === 'max' ? 64 : 16)) break;
          }
        }
      }

      // Check if match is beneficial
      if (bestMatchLen >= 3 && bestMatchOffset <= 4095) {
        if (bestMatchLen >= 3 && bestMatchLen <= 6) {
          // Command 2: 2-byte relative copy
          flushLiterals();
          const cmdByte = 0x80 | (((bestMatchLen - 3) & 0x03) << 4) | ((bestMatchOffset >> 8) & 0x0f);
          out.push(cmdByte);
          out.push(bestMatchOffset & 0xff);
          pos += bestMatchLen;
          continue;
        } else if (bestMatchLen >= 7) {
          // Command 5: Long copy
          flushLiterals();
          out.push(0xff);
          out.push(bestMatchLen & 0xff);
          out.push((bestMatchLen >> 8) & 0xff);
          const absolutePos = pos - bestMatchOffset;
          out.push(absolutePos & 0xff);
          out.push((absolutePos >> 8) & 0xff);
          pos += bestMatchLen;
          continue;
        }
      }

      // Otherwise, add literal byte
      literals.push(byte);
      pos++;
      if (literals.length >= 127) {
        flushLiterals();
      }
    }

    flushLiterals();
    out.push(0x80); // End of stream marker

    const compressed = new Uint8Array(out);

    // Verify round-trip decompression integrity
    try {
      const verified = this.decompress(compressed, srcLen);
      if (verified.length === srcLen) {
        let isIdentical = true;
        for (let i = 0; i < srcLen; i++) {
          if (verified[i] !== src[i]) {
            isIdentical = false;
            break;
          }
        }
        if (isIdentical) {
          return compressed;
        }
      }
    } catch {
      // If verification failed, fallback to safe literal mode
    }

    // Fallback: Safe Literal Mode (guaranteed 100% roundtrip)
    return this.compressLiteralSafe(src);
  }

  /**
   * Safe literal mode: encodes in 127-byte blocks + 0x80 terminator
   */
  public static compressLiteralSafe(src: Uint8Array): Uint8Array {
    const out: number[] = [];
    let pos = 0;
    const len = src.length;

    while (pos < len) {
      const chunk = Math.min(127, len - pos);
      out.push(chunk);
      for (let i = 0; i < chunk; i++) {
        out.push(src[pos + i]);
      }
      pos += chunk;
    }
    out.push(0x80);
    return new Uint8Array(out);
  }
}
