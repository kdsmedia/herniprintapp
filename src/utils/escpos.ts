/**
 * ESC/POS Command Builder for Thermal Printers
 * Supports: raster image printing, text commands, QR codes, barcodes
 *
 * IMPORTANT for images:
 * - Height is NEVER limited — the full image is printed
 * - Line spacing is set to 0 before raster to prevent vertical gaps
 * - ESC @ (init) is called only ONCE, not per band
 * - Aspect ratio is 1:1 — circles print as circles
 */

import { PaperWidth, PAPER } from '../constants/theme';

const ESC = 0x1b;
const GS = 0x1d;
const LF = 0x0a;

export const CMD = {
  INIT: [ESC, 0x40],                               // Initialize printer
  LF: [LF],                                        // Line feed
  CUT: [GS, 0x56, 0x41, 0x00],                    // Cut paper
  ALIGN_LEFT: [ESC, 0x61, 0x00],
  ALIGN_CENTER: [ESC, 0x61, 0x01],
  ALIGN_RIGHT: [ESC, 0x61, 0x02],
  BOLD_ON: [ESC, 0x45, 0x01],
  BOLD_OFF: [ESC, 0x45, 0x00],
  DOUBLE_WIDTH: [ESC, 0x21, 0x20],
  DOUBLE_HEIGHT: [ESC, 0x21, 0x10],
  DOUBLE_BOTH: [ESC, 0x21, 0x30],
  NORMAL_SIZE: [ESC, 0x21, 0x00],
  FEED_3: [LF, LF, LF],
  // Line spacing commands
  LINE_SPACING_DEFAULT: [ESC, 0x32],               // Reset to default line spacing
  LINE_SPACING_ZERO: [ESC, 0x33, 0x00],            // Set line spacing to 0 (crucial for images!)
};

export type Alignment = 'left' | 'center' | 'right';
export type TextSize = 'small' | 'normal' | 'large';

export interface ReceiptLine {
  text: string;
  align?: Alignment;
  bold?: boolean;
  size?: TextSize;
}

// ─── Text Encoding ────────────────────────────────────────
function encodeText(text: string): number[] {
  const bytes: number[] = [];
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    if (code <= 127) {
      bytes.push(code);
    } else {
      const cp437Map: Record<number, number> = {
        0xE9: 0x82, 0xE8: 0x8A, 0xEA: 0x88, 0xEB: 0x89,
        0xE0: 0x85, 0xE1: 0xA0, 0xE2: 0x83, 0xE4: 0x84,
        0xF6: 0x94, 0xFC: 0x81, 0xF1: 0xA4, 0xE7: 0x87,
        0xB0: 0xF8, 0xA9: 0x63, 0xAE: 0x52,
      };
      bytes.push(cp437Map[code] || 0x3f);
    }
  }
  return bytes;
}

// ─── Build Receipt from Text Lines ────────────────────────
export function buildReceiptCommands(lines: ReceiptLine[]): Uint8Array {
  const data: number[] = [...CMD.INIT];
  data.push(GS, 0x4c, 0x00, 0x00); // Left margin = 0

  for (const line of lines) {
    if (line.align === 'center') data.push(...CMD.ALIGN_CENTER);
    else if (line.align === 'right') data.push(...CMD.ALIGN_RIGHT);
    else data.push(...CMD.ALIGN_LEFT);

    if (line.bold) data.push(...CMD.BOLD_ON);

    if (line.size === 'large') data.push(...CMD.DOUBLE_BOTH);
    else data.push(...CMD.NORMAL_SIZE);

    data.push(...encodeText(line.text));
    data.push(LF);

    if (line.bold) data.push(...CMD.BOLD_OFF);
    if (line.size === 'large') data.push(...CMD.NORMAL_SIZE);
  }

  data.push(...CMD.FEED_3);
  data.push(...CMD.CUT);
  return new Uint8Array(data);
}

// ─── Two-Column Line ──────────────────────────────────────
export function buildTwoColumn(
  left: string,
  right: string,
  paperWidth: PaperWidth
): ReceiptLine {
  const maxChars = paperWidth === 58 ? 32 : 48;
  const gap = maxChars - left.length - right.length;
  if (gap < 1) {
    return { text: left.substring(0, maxChars - right.length - 1) + ' ' + right };
  }
  return { text: left + ' '.repeat(gap) + right };
}

// ─── Separator Line ───────────────────────────────────────
export function buildSeparator(paperWidth: PaperWidth, char: '=' | '-' = '='): ReceiptLine {
  const maxChars = paperWidth === 58 ? 32 : 48;
  return { text: char.repeat(maxChars), align: 'center' };
}

// ─── Image to ESC/POS Raster (GS v 0) ────────────────────
//
// IMPORTANT DESIGN DECISIONS:
// 1. Height is UNLIMITED — the entire image is printed, no cropping
// 2. ESC 3 0 sets line spacing to 0 BEFORE raster → no vertical gaps between bands
// 3. ESC @ (INIT) is called only ONCE at the start, NOT per band
// 4. After image, line spacing is restored to default for subsequent text
// 5. Floyd-Steinberg dithering for best quality B/W conversion
//
export function pixelsToEscPos(
  pixels: Uint8Array,   // RGBA pixel data
  width: number,        // Image width in pixels
  height: number,       // Image height in pixels (NO LIMIT)
  contrast: number = 1.0,
  paperDots?: number,   // Paper width in dots (384 or 576) for alignment
  align: 'left' | 'center' | 'right' = 'center',
): Uint8Array {
  // Determine output width
  const outputWidth = paperDots || width;
  const alignedWidth = Math.ceil(outputWidth / 8) * 8;
  const widthBytes = alignedWidth / 8;

  // Calculate left padding for alignment
  let padLeft = 0;
  if (paperDots && width < alignedWidth) {
    if (align === 'center') padLeft = Math.floor((alignedWidth - width) / 2);
    else if (align === 'right') padLeft = alignedWidth - width;
  }

  // Convert to grayscale — ITU-R BT.601, white background for transparency
  const gray = new Float32Array(width * height);
  for (let i = 0; i < width * height; i++) {
    const idx = i * 4;
    const a = pixels[idx + 3] / 255;
    const r = pixels[idx] * a + 255 * (1 - a);
    const g = pixels[idx + 1] * a + 255 * (1 - a);
    const b = pixels[idx + 2] * a + 255 * (1 - a);
    let lum = 0.299 * r + 0.587 * g + 0.114 * b;
    lum = ((lum - 128) * contrast) + 128;
    gray[i] = Math.max(0, Math.min(255, lum));
  }

  // Floyd-Steinberg dithering
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      const old = gray[idx];
      const val = old < 128 ? 0 : 255;
      gray[idx] = val;
      const err = old - val;

      if (x + 1 < width) gray[idx + 1] += err * 7 / 16;
      if (y + 1 < height) {
        if (x > 0) gray[(y + 1) * width + (x - 1)] += err * 3 / 16;
        gray[(y + 1) * width + x] += err * 5 / 16;
        if (x + 1 < width) gray[(y + 1) * width + (x + 1)] += err * 1 / 16;
      }
    }
  }

  // ═══ Build ESC/POS raster data ═══
  const data: number[] = [];

  // 1. Initialize printer ONCE
  data.push(...CMD.INIT);

  // 2. Set alignment
  data.push(...CMD.ALIGN_CENTER);

  // 3. Set left margin to 0
  data.push(GS, 0x4c, 0x00, 0x00);

  // 4. ★ CRUCIAL: Set line spacing to 0 before image
  //    This prevents vertical gaps between raster bands
  //    Without this, some printers add default line spacing (~3.75mm)
  //    between each GS v 0 band, causing the image to stretch vertically
  //    or appear with horizontal white lines
  data.push(...CMD.LINE_SPACING_ZERO);

  // 5. Send image in bands (max 255 rows per GS v 0 command)
  //    Height is NOT limited — all rows are sent
  const maxBandHeight = 255;

  for (let bandStart = 0; bandStart < height; bandStart += maxBandHeight) {
    const bandHeight = Math.min(maxBandHeight, height - bandStart);

    // GS v 0 — raster bit image (mode 0 = normal, no scaling)
    data.push(GS, 0x76, 0x30, 0x00);
    data.push(widthBytes & 0xff, (widthBytes >> 8) & 0xff);
    data.push(bandHeight & 0xff, (bandHeight >> 8) & 0xff);

    // Pack pixel rows into bytes
    for (let y = bandStart; y < bandStart + bandHeight; y++) {
      for (let xByte = 0; xByte < widthBytes; xByte++) {
        let byte = 0;
        for (let bit = 0; bit < 8; bit++) {
          const pixelX = xByte * 8 + bit - padLeft;
          if (pixelX >= 0 && pixelX < width && gray[y * width + pixelX] < 128) {
            byte |= (0x80 >> bit);
          }
        }
        data.push(byte);
      }
    }
  }

  // 6. Restore default line spacing (for any text printed after image)
  data.push(...CMD.LINE_SPACING_DEFAULT);

  // 7. Feed and cut
  data.push(...CMD.FEED_3);
  data.push(...CMD.CUT);

  return new Uint8Array(data);
}

// ─── QR Code (Native ESC/POS GS(k)) ──────────────────────
export function generateEscPosQR(text: string, paperDots: number): Uint8Array {
  const data: number[] = [...CMD.INIT, ...CMD.ALIGN_CENTER];
  const textBytes = encodeText(text);
  const store_len = textBytes.length + 3;

  // Function 165: Select model (Model 2)
  data.push(GS, 0x28, 0x6b, 4, 0, 0x31, 0x41, 0x32, 0x00);
  // Function 167: Set module size (6 dots)
  data.push(GS, 0x28, 0x6b, 3, 0, 0x31, 0x43, 0x06);
  // Function 169: Set error correction (Level M = 49)
  data.push(GS, 0x28, 0x6b, 3, 0, 0x31, 0x45, 0x31);
  // Function 180: Store data
  data.push(GS, 0x28, 0x6b, store_len & 0xff, (store_len >> 8) & 0xff, 0x31, 0x50, 0x30);
  data.push(...textBytes);
  // Function 181: Print
  data.push(GS, 0x28, 0x6b, 3, 0, 0x31, 0x51, 0x30);

  data.push(...CMD.FEED_3);
  data.push(...CMD.CUT);
  return new Uint8Array(data);
}

// ─── Barcode (Native ESC/POS GS k) ───────────────────────
export function generateEscPosBarcode(text: string, paperDots: number): Uint8Array {
  const data: number[] = [...CMD.INIT, ...CMD.ALIGN_CENTER];

  // GS h — Set barcode height (80 dots)
  data.push(GS, 0x68, 0x50);
  // GS w — Set barcode width (2)
  data.push(GS, 0x77, 0x02);
  // GS H — Print HRI below barcode
  data.push(GS, 0x48, 0x02);
  // GS k — Print CODE128
  const barcodeData = encodeText("{B" + text);
  data.push(GS, 0x6b, 0x49, barcodeData.length);
  data.push(...barcodeData);

  data.push(...CMD.FEED_3);
  data.push(...CMD.CUT);
  return new Uint8Array(data);
}

export { CMD as ESC_POS_CMD };
