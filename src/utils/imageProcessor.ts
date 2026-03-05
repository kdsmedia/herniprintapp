/**
 * Image processor for thermal printing.
 * Resizes images to printer width, decodes PNG to raw pixels via pako,
 * then generates ESC/POS raster commands with Floyd-Steinberg dithering.
 */

import * as ImageManipulator from 'expo-image-manipulator';
import * as FileSystem from 'expo-file-system';
import { PAPER, PaperWidth } from '../constants/theme';
import { pixelsToEscPos } from './escpos';
import pako from 'pako';

// ─── Public API ──────────────────────────────────────────────────────

/**
 * Process an image URI for thermal printing.
 */
export async function processImageForPrint(
  imageUri: string,
  paperWidth: PaperWidth = 58,
  contrast: number = 1.2
): Promise<Uint8Array> {
  const targetWidth = PAPER[paperWidth].widthPx;

  // Step 1: Resize to printer width, output PNG
  const resized = await ImageManipulator.manipulateAsync(
    imageUri,
    [{ resize: { width: targetWidth } }],
    { compress: 1, format: ImageManipulator.SaveFormat.PNG }
  );

  // Step 2: Read PNG as binary
  const base64 = await FileSystem.readAsStringAsync(resized.uri, {
    encoding: FileSystem.EncodingType.Base64,
  });
  const pngBytes = base64ToBytes(base64);

  // Step 3: Decode PNG → RGBA pixels
  const decoded = decodePNG(pngBytes);
  if (!decoded) {
    throw new Error('Gagal decode gambar. Coba format lain (JPG/PNG).');
  }

  // Step 4: Convert to ESC/POS raster
  return pixelsToEscPos(decoded.data, decoded.width, decoded.height, contrast);
}

// ─── PNG Decoder (with pako for zlib inflate) ────────────────────────

function base64ToBytes(base64: string): Uint8Array {
  const bin = atob(base64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

function decodePNG(
  data: Uint8Array
): { data: number[]; width: number; height: number } | null {
  // Verify PNG signature
  const sig = [137, 80, 78, 71, 13, 10, 26, 10];
  for (let i = 0; i < 8; i++) {
    if (data[i] !== sig[i]) return null;
  }

  let pos = 8;
  let width = 0, height = 0, bitDepth = 0, colorType = 0;
  const idatChunks: Uint8Array[] = [];
  let palette: Uint8Array | null = null;
  let transparency: Uint8Array | null = null;

  // Parse chunks
  while (pos + 8 <= data.length) {
    const len = readU32(data, pos); pos += 4;
    const type = String.fromCharCode(data[pos], data[pos + 1], data[pos + 2], data[pos + 3]);
    pos += 4;

    if (pos + len > data.length) break;

    if (type === 'IHDR') {
      width = readU32(data, pos);
      height = readU32(data, pos + 4);
      bitDepth = data[pos + 8];
      colorType = data[pos + 9];
    } else if (type === 'PLTE') {
      palette = data.slice(pos, pos + len);
    } else if (type === 'tRNS') {
      transparency = data.slice(pos, pos + len);
    } else if (type === 'IDAT') {
      idatChunks.push(data.slice(pos, pos + len));
    } else if (type === 'IEND') {
      break;
    }

    pos += len + 4; // skip data + CRC
  }

  if (width === 0 || height === 0 || idatChunks.length === 0) return null;

  // Concatenate IDAT chunks
  const totalLen = idatChunks.reduce((s, c) => s + c.length, 0);
  const compressed = new Uint8Array(totalLen);
  let offset = 0;
  for (const chunk of idatChunks) {
    compressed.set(chunk, offset);
    offset += chunk.length;
  }

  // Decompress with pako
  let inflated: Uint8Array;
  try {
    inflated = pako.inflate(compressed);
  } catch (e) {
    console.warn('PNG inflate failed:', e);
    return null;
  }

  // Bytes per pixel for raw scanline
  let bpp: number;
  switch (colorType) {
    case 0: bpp = 1; break; // Grayscale
    case 2: bpp = 3; break; // RGB
    case 3: bpp = 1; break; // Palette
    case 4: bpp = 2; break; // Grayscale + Alpha
    case 6: bpp = 4; break; // RGBA
    default: return null;
  }
  if (bitDepth === 16) bpp *= 2;

  const stride = width * bpp; // bytes per scanline (without filter byte)

  // Unfilter scanlines
  const raw = new Uint8Array(height * stride);
  let srcPos = 0;

  for (let y = 0; y < height; y++) {
    const filterType = inflated[srcPos++];
    const rowStart = y * stride;
    const prevRowStart = (y - 1) * stride;

    for (let x = 0; x < stride; x++) {
      const cur = inflated[srcPos++];
      const a = x >= bpp ? raw[rowStart + x - bpp] : 0;           // left
      const b = y > 0 ? raw[prevRowStart + x] : 0;                // above
      const c = (x >= bpp && y > 0) ? raw[prevRowStart + x - bpp] : 0; // upper-left

      let val: number;
      switch (filterType) {
        case 0: val = cur; break;                                   // None
        case 1: val = (cur + a) & 0xff; break;                     // Sub
        case 2: val = (cur + b) & 0xff; break;                     // Up
        case 3: val = (cur + ((a + b) >> 1)) & 0xff; break;        // Average
        case 4: val = (cur + paethPredictor(a, b, c)) & 0xff; break; // Paeth
        default: val = cur;
      }
      raw[rowStart + x] = val;
    }
  }

  // Convert to RGBA pixels
  const pixels: number[] = new Array(width * height * 4);
  let pi = 0;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * stride + x * bpp;
      let r: number, g: number, b_: number, a: number;

      if (bitDepth === 16) {
        // 16-bit: take high byte only
        switch (colorType) {
          case 0: r = g = b_ = raw[idx]; a = 255; break;
          case 2: r = raw[idx]; g = raw[idx + 2]; b_ = raw[idx + 4]; a = 255; break;
          case 4: r = g = b_ = raw[idx]; a = raw[idx + 2]; break;
          case 6: r = raw[idx]; g = raw[idx + 2]; b_ = raw[idx + 4]; a = raw[idx + 6]; break;
          default: r = g = b_ = 0; a = 255;
        }
      } else {
        switch (colorType) {
          case 0: // Grayscale
            r = g = b_ = raw[idx]; a = 255;
            break;
          case 2: // RGB
            r = raw[idx]; g = raw[idx + 1]; b_ = raw[idx + 2]; a = 255;
            break;
          case 3: // Palette
            const pi3 = raw[idx] * 3;
            r = palette ? palette[pi3] : 0;
            g = palette ? palette[pi3 + 1] : 0;
            b_ = palette ? palette[pi3 + 2] : 0;
            a = transparency && raw[idx] < transparency.length ? transparency[raw[idx]] : 255;
            break;
          case 4: // Grayscale + Alpha
            r = g = b_ = raw[idx]; a = raw[idx + 1];
            break;
          case 6: // RGBA
            r = raw[idx]; g = raw[idx + 1]; b_ = raw[idx + 2]; a = raw[idx + 3];
            break;
          default:
            r = g = b_ = 0; a = 255;
        }
      }

      pixels[pi++] = r;
      pixels[pi++] = g;
      pixels[pi++] = b_;
      pixels[pi++] = a;
    }
  }

  return { data: pixels, width, height };
}

function readU32(d: Uint8Array, i: number): number {
  return ((d[i] << 24) | (d[i + 1] << 16) | (d[i + 2] << 8) | d[i + 3]) >>> 0;
}

function paethPredictor(a: number, b: number, c: number): number {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  if (pb <= pc) return b;
  return c;
}
