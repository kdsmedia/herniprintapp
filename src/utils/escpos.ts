/**
 * ESC/POS command builder for thermal printers.
 * Handles image rasterization with dithering, and direct text receipt printing.
 */

import { PAPER, PaperWidth } from '../constants/theme';

// ─── ESC/POS Command Constants ───────────────────────────────────────

const ESC = 0x1b;
const GS = 0x1d;

const CMD = {
  INIT: [ESC, 0x40],                           // ESC @ — Initialize
  LF: [0x0a],                                   // Line feed
  CUT_PARTIAL: [GS, 0x56, 0x41, 0x03],         // GS V A 3 — Partial cut
  CUT_FULL: [GS, 0x56, 0x00],                  // GS V 0 — Full cut
  ALIGN_LEFT: [ESC, 0x61, 0x00],               // ESC a 0
  ALIGN_CENTER: [ESC, 0x61, 0x01],             // ESC a 1
  ALIGN_RIGHT: [ESC, 0x61, 0x02],              // ESC a 2
  BOLD_ON: [ESC, 0x45, 0x01],                  // ESC E 1
  BOLD_OFF: [ESC, 0x45, 0x00],                 // ESC E 0
  UNDERLINE_ON: [ESC, 0x2d, 0x01],             // ESC - 1
  UNDERLINE_OFF: [ESC, 0x2d, 0x00],            // ESC - 0
  DOUBLE_HEIGHT: [ESC, 0x21, 0x10],            // ESC ! 16
  DOUBLE_WIDTH: [ESC, 0x21, 0x20],             // ESC ! 32
  DOUBLE_BOTH: [ESC, 0x21, 0x30],              // ESC ! 48
  NORMAL_SIZE: [ESC, 0x21, 0x00],              // ESC ! 0
  FEED_N: (n: number) => [ESC, 0x64, n],       // ESC d n — Feed n lines
};

export type Alignment = 'left' | 'center' | 'right';
export type TextSize = 'small' | 'normal' | 'large';

// ─── ESC/POS Text Encoder (CP437/Latin) ──────────────────────────────

/**
 * Encode a string to printer bytes. Thermal printers typically use
 * Code Page 437 or Windows-1252. We map common Indonesian characters.
 */
function encodeText(text: string): number[] {
  const bytes: number[] = [];
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    if (code < 128) {
      bytes.push(code); // ASCII
    } else {
      // Map common non-ASCII chars to nearest ASCII equivalent
      const mapped: Record<number, number> = {
        0xe9: 0x65, // é → e
        0xe8: 0x65, // è → e
        0xf1: 0x6e, // ñ → n
        0xfc: 0x75, // ü → u
        0xe4: 0x61, // ä → a
        0xf6: 0x6f, // ö → o
      };
      bytes.push(mapped[code] || 0x3f); // Unknown → ?
    }
  }
  return bytes;
}

// ─── Receipt Text Builder (native ESC/POS text commands) ─────────────

export interface ReceiptLine {
  text: string;
  align?: Alignment;
  bold?: boolean;
  size?: TextSize;
  underline?: boolean;
}

/**
 * Build a complete receipt from lines using native ESC/POS text commands.
 * This produces MUCH sharper text than bitmap rendering.
 */
export function buildReceiptCommands(lines: ReceiptLine[]): Uint8Array {
  const parts: number[] = [];

  // Initialize
  parts.push(...CMD.INIT);

  for (const line of lines) {
    // Alignment
    if (line.align === 'center') parts.push(...CMD.ALIGN_CENTER);
    else if (line.align === 'right') parts.push(...CMD.ALIGN_RIGHT);
    else parts.push(...CMD.ALIGN_LEFT);

    // Size
    if (line.size === 'large') parts.push(...CMD.DOUBLE_BOTH);
    else if (line.size === 'small') parts.push(...CMD.NORMAL_SIZE);
    else parts.push(...CMD.NORMAL_SIZE);

    // Bold
    if (line.bold) parts.push(...CMD.BOLD_ON);

    // Underline
    if (line.underline) parts.push(...CMD.UNDERLINE_ON);

    // Text content
    parts.push(...encodeText(line.text));
    parts.push(...CMD.LF);

    // Reset styling
    if (line.bold) parts.push(...CMD.BOLD_OFF);
    if (line.underline) parts.push(...CMD.UNDERLINE_OFF);
    if (line.size === 'large') parts.push(...CMD.NORMAL_SIZE);
  }

  // Feed + cut
  parts.push(...CMD.FEED_N(4));
  parts.push(...CMD.CUT_PARTIAL);

  return new Uint8Array(parts);
}

/**
 * Build separator line (======= or -------).
 */
export function buildSeparator(paperWidth: PaperWidth, char: '=' | '-' = '='): ReceiptLine {
  // Font A is typically 12x24 on 58mm → 32 chars, on 80mm → 48 chars
  const maxChars = paperWidth === 58 ? 32 : 48;
  return { text: char.repeat(maxChars), align: 'left' };
}

/**
 * Build a two-column line (left-aligned label, right-aligned value).
 * Used for item lines like "2 x Rp 10.000     Rp 20.000"
 */
export function buildTwoColumn(
  left: string,
  right: string,
  paperWidth: PaperWidth
): ReceiptLine {
  const maxChars = paperWidth === 58 ? 32 : 48;
  const gap = maxChars - left.length - right.length;
  const spaces = gap > 0 ? ' '.repeat(gap) : ' ';
  return { text: left + spaces + right };
}

// ─── Image Rasterization (ESC/POS GS v 0) ───────────────────────────

/**
 * Convert RGBA pixel data to ESC/POS raster image commands.
 * Uses Floyd-Steinberg dithering for quality thermal printing.
 */
export function pixelsToEscPos(
  pixels: number[],  // RGBA flat array
  width: number,
  height: number,
  contrast: number = 1.2
): Uint8Array {
  // Step 1: Convert to grayscale with contrast adjustment
  const gray = new Float32Array(width * height);
  for (let i = 0; i < width * height; i++) {
    const r = pixels[i * 4];
    const g = pixels[i * 4 + 1];
    const b = pixels[i * 4 + 2];
    const a = pixels[i * 4 + 3];

    if (a < 128) {
      gray[i] = 255; // Transparent → white
    } else {
      // ITU-R BT.601 luminance
      let lum = r * 0.299 + g * 0.587 + b * 0.114;
      lum = ((lum - 128) * contrast) + 128;
      gray[i] = Math.max(0, Math.min(255, lum));
    }
  }

  // Step 2: Floyd-Steinberg dithering
  const bw = new Uint8Array(width * height); // 0=black, 1=white
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      const oldVal = gray[idx];
      const newVal = oldVal < 128 ? 0 : 255;
      bw[idx] = newVal === 0 ? 0 : 1;
      const error = oldVal - newVal;

      if (x + 1 < width)                        gray[idx + 1]         += error * 7 / 16;
      if (y + 1 < height && x > 0)              gray[(y+1)*width+x-1] += error * 3 / 16;
      if (y + 1 < height)                       gray[(y+1)*width+x]   += error * 5 / 16;
      if (y + 1 < height && x + 1 < width)      gray[(y+1)*width+x+1] += error * 1 / 16;
    }
  }

  // Step 3: Build ESC/POS raster commands with band slicing (max 255 rows/band)
  const widthBytes = Math.ceil(width / 8);
  const MAX_BAND = 255;
  const numBands = Math.ceil(height / MAX_BAND);

  // Calculate buffer size
  const headerSize = CMD.INIT.length;
  const bandHeaders = numBands * 8; // GS v 0 m xL xH yL yH per band
  const dataSize = widthBytes * height;
  const footerSize = 4 + CMD.CUT_PARTIAL.length; // feed + cut

  const buffer = new Uint8Array(headerSize + bandHeaders + dataSize + footerSize);
  let pos = 0;

  // ESC @ Initialize
  for (const b of CMD.INIT) buffer[pos++] = b;

  // Print in bands
  for (let bandStart = 0; bandStart < height; bandStart += MAX_BAND) {
    const bandHeight = Math.min(MAX_BAND, height - bandStart);

    // GS v 0 — Print raster bit image
    buffer[pos++] = GS;
    buffer[pos++] = 0x76;
    buffer[pos++] = 0x30;
    buffer[pos++] = 0x00; // Normal mode
    buffer[pos++] = widthBytes & 0xff;
    buffer[pos++] = (widthBytes >> 8) & 0xff;
    buffer[pos++] = bandHeight & 0xff;
    buffer[pos++] = (bandHeight >> 8) & 0xff;

    for (let y = bandStart; y < bandStart + bandHeight; y++) {
      for (let xByte = 0; xByte < widthBytes; xByte++) {
        let byte = 0;
        for (let bit = 0; bit < 8; bit++) {
          const px = xByte * 8 + bit;
          if (px < width && bw[y * width + px] === 0) {
            byte |= (0x80 >> bit); // Black pixel = 1 bit
          }
        }
        buffer[pos++] = byte;
      }
    }
  }

  // Feed 4 lines + partial cut
  buffer[pos++] = ESC; buffer[pos++] = 0x64; buffer[pos++] = 0x04;
  for (const b of CMD.CUT_PARTIAL) buffer[pos++] = b;

  return buffer.slice(0, pos);
}

export { CMD };
