/**
 * Pure TypeScript QR Code Generator (Zero Dependencies)
 * Conforms to ISO/IEC 18004 specification for QR Codes.
 * Supports Byte (8-bit) encoding with Reed-Solomon error correction.
 * Generates PNG data URLs and renders directly to Canvas/SVG.
 */

// GF(256) Math tables with primitive polynomial x^8 + x^4 + x^3 + x^2 + 1 (285)
const EXP_TABLE = new Uint8Array(512);
const LOG_TABLE = new Uint8Array(256);

(() => {
  let x = 1;
  for (let i = 0; i < 255; i++) {
    EXP_TABLE[i] = x;
    EXP_TABLE[i + 255] = x;
    LOG_TABLE[x] = i;
    x <<= 1;
    if (x >= 256) x ^= 0x11d;
  }
})();

function gfMul(a: number, b: number): number {
  if (a === 0 || b === 0) return 0;
  return EXP_TABLE[LOG_TABLE[a] + LOG_TABLE[b]];
}

function rsGeneratorPoly(numEc: number): Uint8Array {
  let poly = new Uint8Array([1]);
  for (let i = 0; i < numEc; i++) {
    const next = new Uint8Array(poly.length + 1);
    const factor = EXP_TABLE[i];
    for (let j = 0; j < poly.length; j++) {
      next[j] ^= gfMul(poly[j], factor);
      next[j + 1] ^= poly[j];
    }
    poly = next;
  }
  return poly;
}

function rsCompute(data: Uint8Array, numEc: number): Uint8Array {
  const gen = rsGeneratorPoly(numEc);
  const remainder = new Uint8Array(numEc);
  for (let i = 0; i < data.length; i++) {
    const factor = data[i] ^ remainder[0];
    remainder.copyWithin(0, 1);
    remainder[numEc - 1] = 0;
    if (factor !== 0) {
      for (let j = 0; j < numEc; j++) {
        remainder[j] ^= gfMul(gen[j], factor);
      }
    }
  }
  return remainder;
}

// Version table configurations (Versions 1 - 8, Level M ECC)
interface VersionConfig {
  version: number;
  size: number;
  totalCodewords: number;
  dataCodewords: number;
  ecCodewordsPerBlock: number;
  numBlocks: number;
  alignments: number[];
}

const VERSIONS: VersionConfig[] = [
  { version: 1, size: 21, totalCodewords: 26, dataCodewords: 16, ecCodewordsPerBlock: 10, numBlocks: 1, alignments: [] },
  { version: 2, size: 25, totalCodewords: 44, dataCodewords: 28, ecCodewordsPerBlock: 16, numBlocks: 1, alignments: [6, 18] },
  { version: 3, size: 29, totalCodewords: 70, dataCodewords: 44, ecCodewordsPerBlock: 26, numBlocks: 1, alignments: [6, 22] },
  { version: 4, size: 33, totalCodewords: 100, dataCodewords: 64, ecCodewordsPerBlock: 18, numBlocks: 2, alignments: [6, 26] },
  { version: 5, size: 37, totalCodewords: 134, dataCodewords: 86, ecCodewordsPerBlock: 24, numBlocks: 2, alignments: [6, 30] },
  { version: 6, size: 41, totalCodewords: 172, dataCodewords: 108, ecCodewordsPerBlock: 16, numBlocks: 4, alignments: [6, 34] },
  { version: 7, size: 45, totalCodewords: 196, dataCodewords: 124, ecCodewordsPerBlock: 18, numBlocks: 4, alignments: [6, 22, 38] },
  { version: 8, size: 49, totalCodewords: 242, dataCodewords: 154, ecCodewordsPerBlock: 22, numBlocks: 4, alignments: [6, 24, 42] }
];

// Format Information bit patterns for Mask 0 (EC Level M)
// Pre-computed with BCH(15,5) code XORed with 0x5412 mask
const FORMAT_INFO_M_MASK0 = 0b101010000010010;

export class QRCodeEncoder {
  private config: VersionConfig;
  private matrix: (boolean | null)[][];
  private size: number;

  constructor(text: string) {
    const rawBytes = new TextEncoder().encode(text);
    // Find smallest version that fits rawBytes + 4-bit mode + 8/16-bit count
    let selected: VersionConfig | null = null;
    for (const v of VERSIONS) {
      // Byte mode header: 4 bits mode + 8 bits length (for V1-V9) = 12 bits = 1.5 bytes
      const overhead = 2; // ceil(12 / 8) + 1 margin
      if (rawBytes.length + overhead <= v.dataCodewords) {
        selected = v;
        break;
      }
    }
    if (!selected) {
      selected = VERSIONS[VERSIONS.length - 1];
    }
    this.config = selected;
    this.size = selected.size;
    this.matrix = Array.from({ length: this.size }, () => Array(this.size).fill(null));

    this.encode(rawBytes);
  }

  private encode(data: Uint8Array) {
    // 1. Bitstream packaging (8-bit Byte mode)
    const bits: number[] = [];
    const pushBits = (val: number, len: number) => {
      for (let i = len - 1; i >= 0; i--) {
        bits.push((val >> i) & 1);
      }
    };

    // Mode indicator: 0100 for Byte mode
    pushBits(0b0100, 4);
    // Character count indicator (8 bits for versions 1-9)
    pushBits(data.length, 8);
    // Data bytes
    for (let i = 0; i < data.length; i++) {
      pushBits(data[i], 8);
    }

    // Terminator (up to 4 zeroes)
    const totalDataBits = this.config.dataCodewords * 8;
    const termCount = Math.min(4, totalDataBits - bits.length);
    pushBits(0, termCount);

    // Byte align with zeroes
    while (bits.length % 8 !== 0) {
      bits.push(0);
    }

    // Convert bits to codewords
    const codewords = new Uint8Array(this.config.dataCodewords);
    for (let i = 0; i < bits.length / 8 && i < codewords.length; i++) {
      let b = 0;
      for (let j = 0; j < 8; j++) {
        b = (b << 1) | bits[i * 8 + j];
      }
      codewords[i] = b;
    }

    // Pad codewords (0xEC, 0x11 alternately)
    let padIdx = bits.length / 8;
    let padByte = 0xec;
    while (padIdx < this.config.dataCodewords) {
      codewords[padIdx++] = padByte;
      padByte = padByte === 0xec ? 0x11 : 0xec;
    }

    // 2. Block partitioning and Reed-Solomon generation
    const blocks: { data: Uint8Array; ec: Uint8Array }[] = [];
    const numBlocks = this.config.numBlocks;
    const baseBlockLen = Math.floor(this.config.dataCodewords / numBlocks);
    let offset = 0;

    for (let i = 0; i < numBlocks; i++) {
      const bLen = baseBlockLen + (i >= numBlocks - (this.config.dataCodewords % numBlocks) ? 1 : 0);
      const bData = codewords.slice(offset, offset + bLen);
      offset += bLen;
      const bEc = rsCompute(bData, this.config.ecCodewordsPerBlock);
      blocks.push({ data: bData, ec: bEc });
    }

    // Interleave data and EC codewords
    const finalCodewords: number[] = [];
    const maxDataLen = Math.max(...blocks.map(b => b.data.length));
    for (let i = 0; i < maxDataLen; i++) {
      for (const b of blocks) {
        if (i < b.data.length) finalCodewords.push(b.data[i]);
      }
    }
    for (let i = 0; i < this.config.ecCodewordsPerBlock; i++) {
      for (const b of blocks) {
        if (i < b.ec.length) finalCodewords.push(b.ec[i]);
      }
    }

    // 3. Matrix construction
    this.placeFunctionPatterns();
    this.placeData(finalCodewords);
    this.applyMaskAndFormat();
  }

  private placeFinder(startX: number, startY: number) {
    for (let y = -1; y <= 7; y++) {
      for (let x = -1; x <= 7; x++) {
        const py = startY + y;
        const px = startX + x;
        if (px < 0 || px >= this.size || py < 0 || py >= this.size) continue;
        const isBorder = (y === 0 || y === 6 || x === 0 || x === 6);
        const isCenter = (y >= 2 && y <= 4 && x >= 2 && x <= 4);
        if ((x >= 0 && x <= 6 && y >= 0 && y <= 6) && (isBorder || isCenter)) {
          this.matrix[py][px] = true;
        } else {
          this.matrix[py][px] = false;
        }
      }
    }
  }

  private placeAlignment(cx: number, cy: number) {
    if (this.matrix[cy][cx] !== null) return;
    for (let dy = -2; dy <= 2; dy++) {
      for (let dx = -2; dx <= 2; dx++) {
        const isBorder = Math.abs(dx) === 2 || Math.abs(dy) === 2;
        const isCenter = dx === 0 && dy === 0;
        this.matrix[cy + dy][cx + dx] = isBorder || isCenter;
      }
    }
  }

  private placeFunctionPatterns() {
    // Top-left, top-right, bottom-left finders
    this.placeFinder(0, 0);
    this.placeFinder(this.size - 7, 0);
    this.placeFinder(0, this.size - 7);

    // Timing patterns
    for (let i = 8; i < this.size - 8; i++) {
      if (this.matrix[6][i] === null) this.matrix[6][i] = i % 2 === 0;
      if (this.matrix[i][6] === null) this.matrix[i][6] = i % 2 === 0;
    }

    // Dark module (always dark)
    this.matrix[4 * this.config.version + 9][8] = true;

    // Alignment patterns
    const aligns = this.config.alignments;
    for (let r = 0; r < aligns.length; r++) {
      for (let c = 0; c < aligns.length; c++) {
        const ax = aligns[c];
        const ay = aligns[r];
        // Skip finders corner locations
        if (
          (ax <= 8 && ay <= 8) ||
          (ax >= this.size - 8 && ay <= 8) ||
          (ax <= 8 && ay >= this.size - 8)
        ) {
          continue;
        }
        this.placeAlignment(ax, ay);
      }
    }

    // Reserve format bits
    for (let i = 0; i < 9; i++) {
      if (this.matrix[8][i] === null) this.matrix[8][i] = false;
      if (this.matrix[i][8] === null) this.matrix[i][8] = false;
    }
    for (let i = 0; i < 8; i++) {
      if (this.matrix[8][this.size - 1 - i] === null) this.matrix[8][this.size - 1 - i] = false;
      if (this.matrix[this.size - 1 - i][8] === null) this.matrix[this.size - 1 - i][8] = false;
    }
  }

  private placeData(codewords: number[]) {
    let bitIdx = 0;
    const totalBits = codewords.length * 8;
    const getBit = (idx: number) => {
      if (idx >= totalBits) return 0;
      const byteIdx = Math.floor(idx / 8);
      const bPos = 7 - (idx % 8);
      return (codewords[byteIdx] >> bPos) & 1;
    };

    let dirUp = true;
    for (let rightCol = this.size - 1; rightCol > 0; rightCol -= 2) {
      if (rightCol === 6) rightCol--; // Skip vertical timing column
      const leftCol = rightCol - 1;

      for (let step = 0; step < this.size; step++) {
        const row = dirUp ? this.size - 1 - step : step;
        for (const col of [rightCol, leftCol]) {
          if (this.matrix[row][col] === null) {
            this.matrix[row][col] = getBit(bitIdx++) === 1;
          }
        }
      }
      dirUp = !dirUp;
    }
  }

  private applyMaskAndFormat() {
    // Mask 0: (row + col) % 2 === 0
    for (let r = 0; r < this.size; r++) {
      for (let c = 0; c < this.size; c++) {
        // Skip function pattern areas
        const inFinderTL = r <= 8 && c <= 8;
        const inFinderTR = r <= 8 && c >= this.size - 8;
        const inFinderBL = r >= this.size - 8 && c <= 8;
        const inTiming = r === 6 || c === 6;
        if (inFinderTL || inFinderTR || inFinderBL || inTiming) continue;

        // Check alignment areas
        let isAlign = false;
        for (const ay of this.config.alignments) {
          for (const ax of this.config.alignments) {
            if (Math.abs(r - ay) <= 2 && Math.abs(c - ax) <= 2) {
              isAlign = true;
              break;
            }
          }
          if (isAlign) break;
        }
        if (isAlign) continue;

        // Apply Mask 0
        if ((r + c) % 2 === 0) {
          this.matrix[r][c] = !this.matrix[r][c];
        }
      }
    }

    // Place pre-computed Format Information (Mask 0, Level M)
    const formatBits = FORMAT_INFO_M_MASK0;
    // Format along top-left finder:
    // Bits 0-5 -> (8, 0..5), bit 6 -> (8, 7), bit 7 -> (8, 8), bit 8 -> (7, 8), bits 9-14 -> (5..0, 8)
    const tlCoords: [number, number][] = [
      [8, 0], [8, 1], [8, 2], [8, 3], [8, 4], [8, 5],
      [8, 7], [8, 8], [7, 8],
      [5, 8], [4, 8], [3, 8], [2, 8], [1, 8], [0, 8]
    ];
    for (let i = 0; i < 15; i++) {
      const bit = ((formatBits >> i) & 1) === 1;
      const [r, c] = tlCoords[i];
      this.matrix[r][c] = bit;
    }

    // Format split across TR and BL finders:
    // Bits 0-7 -> (row, col) at bottom-left: (size - 1 .. size - 8, 8)
    for (let i = 0; i < 7; i++) {
      const bit = ((formatBits >> i) & 1) === 1;
      this.matrix[this.size - 1 - i][8] = bit;
    }
    // Bits 8-14 -> (8, size - 8 .. size - 1)
    for (let i = 0; i < 8; i++) {
      const bit = ((formatBits >> (7 + i)) & 1) === 1;
      this.matrix[8][this.size - 8 + i] = bit;
    }
  }

  public getMatrix(): boolean[][] {
    return this.matrix.map(row => row.map(cell => Boolean(cell)));
  }

  public toDataURL(options?: { width?: number; margin?: number; dark?: string; light?: string }): string {
    const width = options?.width || 256;
    const margin = options?.margin !== undefined ? options.margin : 2;
    const dark = options?.dark || '#000000';
    const light = options?.light || '#FFFFFF';

    const matrix = this.getMatrix();
    const moduleCount = this.size + margin * 2;
    const scale = Math.max(1, Math.floor(width / moduleCount));
    const canvasSize = moduleCount * scale;

    // Use browser canvas
    if (typeof document !== 'undefined') {
      const canvas = document.createElement('canvas');
      canvas.width = canvasSize;
      canvas.height = canvasSize;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = light;
        ctx.fillRect(0, 0, canvasSize, canvasSize);

        ctx.fillStyle = dark;
        for (let r = 0; r < this.size; r++) {
          for (let c = 0; c < this.size; c++) {
            if (matrix[r][c]) {
              ctx.fillRect(
                (c + margin) * scale,
                (r + margin) * scale,
                scale,
                scale
              );
            }
          }
        }
        return canvas.toDataURL('image/png');
      }
    }

    // Fallback inline SVG Data URL if canvas is unavailable
    let rects = '';
    for (let r = 0; r < this.size; r++) {
      for (let c = 0; c < this.size; c++) {
        if (matrix[r][c]) {
          rects += `<rect x="${c + margin}" y="${r + margin}" width="1" height="1" fill="${dark}" />`;
        }
      }
    }
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${moduleCount} ${moduleCount}" width="${width}" height="${width}"><rect width="100%" height="100%" fill="${light}"/>${rects}</svg>`;
    return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
  }
}

/**
 * Convenience drop-in replacement for QRCode.toDataURL
 */
export async function generateQRCodeDataUrl(
  text: string,
  options?: { width?: number; margin?: number; color?: { dark?: string; light?: string } }
): Promise<string> {
  const encoder = new QRCodeEncoder(text);
  return encoder.toDataURL({
    width: options?.width || 256,
    margin: options?.margin !== undefined ? options.margin : 2,
    dark: options?.color?.dark || '#000000',
    light: options?.color?.light || '#FFFFFF'
  });
}
