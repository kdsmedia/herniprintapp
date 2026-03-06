/**
 * ESC/POS Command Builder for Thermal Printers
 * Supports: raster image printing, text commands, QR codes, barcodes
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
  // Encode text using CP437-compatible mapping for thermal printers
  // Common Indonesian characters (é, è, ê, ü, etc.) are mapped where possible
  const bytes: number[] = [];
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    if (code <= 127) {
      bytes.push(code);
    } else {
      // Map common extended characters to CP437 equivalents
      const cp437Map: Record<number, number> = {
        0xE9: 0x82, // é
        0xE8: 0x8A, // è
        0xEA: 0x88, // ê
        0xEB: 0x89, // ë
        0xE0: 0x85, // à
        0xE1: 0xA0, // á
        0xE2: 0x83, // â
        0xE4: 0x84, // ä
        0xF6: 0x94, // ö
        0xFC: 0x81, // ü
        0xF1: 0xA4, // ñ
        0xE7: 0x87, // ç
        0xB0: 0xF8, // °
        0xA9: 0x63, // © → c
        0xAE: 0x52, // ® → R
      };
      bytes.push(cp437Map[code] || 0x3f); // Fallback to '?' for unmapped
    }
  }
  return bytes;
}

// ─── Build Receipt from Text Lines ────────────────────────
export function buildReceiptCommands(lines: ReceiptLine[]): Uint8Array {
  const data: number[] = [...CMD.INIT];
  // Set left margin to 0 for consistent centering
  data.push(GS, 0x4c, 0x00, 0x00);

  for (const line of lines) {
    // Alignment
    if (line.align === 'center') data.push(...CMD.ALIGN_CENTER);
    else if (line.align === 'right') data.push(...CMD.ALIGN_RIGHT);
    else data.push(...CMD.ALIGN_LEFT);

    // Bold
    if (line.bold) data.push(...CMD.BOLD_ON);

    // Size
    if (line.size === 'large') data.push(...CMD.DOUBLE_BOTH);
    else if (line.size === 'small') data.push(...CMD.NORMAL_SIZE);
    else data.push(...CMD.NORMAL_SIZE);

    // Text
    data.push(...encodeText(line.text));
    data.push(LF);

    // Reset
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
// Floyd-Steinberg dithering + band slicing for compatibility
// Image is centered on paper: padded with white if narrower than paper width
export function pixelsToEscPos(
  pixels: Uint8Array, // RGBA pixel data
  width: number,
  height: number,
  contrast: number = 1.0,
  paperDots?: number, // Optional: paper width in dots (384 or 576) for centering
  align: 'left' | 'center' | 'right' = 'center',
): Uint8Array {
  // Determine output width — use paper width for alignment, or image width
  const outputWidth = paperDots || width;
  // Ensure output width is multiple of 8 (required by ESC/POS raster)
  const alignedWidth = Math.ceil(outputWidth / 8) * 8;
  const widthBytes = alignedWidth / 8;

  // Calculate left padding based on alignment
  let padLeft = 0;
  if (paperDots && width < alignedWidth) {
    if (align === 'center') padLeft = Math.floor((alignedWidth - width) / 2);
    else if (align === 'right') padLeft = alignedWidth - width;
    // 'left' → padLeft = 0
  }

  // Convert to grayscale with ITU-R BT.601 (white background for transparency)
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

  // Build ESC/POS raster data
  // Set center alignment before image
  const data: number[] = [...CMD.INIT, ...CMD.ALIGN_CENTER];

  // Set left margin to 0 to let raster centering work via padding
  // GS L — Set left margin to 0
  data.push(GS, 0x4c, 0x00, 0x00);

  const maxBandHeight = 255;

  for (let bandStart = 0; bandStart < height; bandStart += maxBandHeight) {
    const bandHeight = Math.min(maxBandHeight, height - bandStart);

    // GS v 0 — raster bit image (mode 0 = normal)
    data.push(GS, 0x76, 0x30, 0x00);
    data.push(widthBytes & 0xff, (widthBytes >> 8) & 0xff);
    data.push(bandHeight & 0xff, (bandHeight >> 8) & 0xff);

    for (let y = bandStart; y < bandStart + bandHeight; y++) {
      for (let xByte = 0; xByte < widthBytes; xByte++) {
        let byte = 0;
        for (let bit = 0; bit < 8; bit++) {
          const pixelX = xByte * 8 + bit - padLeft; // Offset by padding
          if (pixelX >= 0 && pixelX < width && gray[y * width + pixelX] < 128) {
            byte |= (0x80 >> bit);
          }
          // Pixels outside image area stay 0 (white)
        }
        data.push(byte);
      }
    }
  }

  data.push(...CMD.FEED_3);
  data.push(...CMD.CUT);
  return new Uint8Array(data);
}

// ─── QR Code (Native ESC/POS GS(k)) ──────────────────────
export function generateEscPosQR(text: string, paperDots: number): Uint8Array {
  const data: number[] = [...CMD.INIT, ...CMD.ALIGN_CENTER];
  const textBytes = encodeText(text);
  const store_len = textBytes.length + 3;

  // GS ( k — QR Code
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
  // Using CODE128 with auto-selection of character set (m=73, 0x49)
  // n = length of data (including start code if explicitly sent)
  // For CODE128, the data usually includes the start code. {B is for Code Set B.
  // The length parameter 'n' should be the length of the data that follows, including the start code.
  const barcodeData = encodeText("{B" + text); // Add start code for Code Set B
  data.push(GS, 0x6b, 0x49, barcodeData.length); // m=0x49 (CODE128), n=length of data
  data.push(...barcodeData);

  data.push(...CMD.FEED_3);
  data.push(...CMD.CUT);
  return new Uint8Array(data);
}

export { CMD as ESC_POS_CMD };
