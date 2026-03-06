/**
 * Image Processing for Thermal Printing
 * Converts images to grayscale pixel data suitable for ESC/POS raster printing
 */

import * as ImageManipulator from 'expo-image-manipulator';
import * as FileSystem from 'expo-file-system';
import { Buffer } from 'buffer';

/**
 * Process an image URI for thermal printing
 * 1. Resize to fit paper width
 * 2. Extract pixel data as RGBA Uint8Array
 */
export async function processImageForPrint(
  imageUri: string,
  targetWidth: number,
  options?: { landscape?: boolean; sharpness?: number },
): Promise<{ pixels: Uint8Array; width: number; height: number }> {
  // Build manipulation actions
  const actions: ImageManipulator.Action[] = [];

  // Rotate 90° for landscape orientation
  if (options?.landscape) {
    actions.push({ rotate: 90 });
  }

  // Resize to target width
  actions.push({ resize: { width: targetWidth } });

  // Step 1: Resize (and optionally rotate) image
  const resized = await ImageManipulator.manipulateAsync(
    imageUri,
    actions,
    { format: ImageManipulator.SaveFormat.PNG, compress: 1 }
  );

  // Step 2: Read the PNG file as base64
  const base64 = await FileSystem.readAsStringAsync(resized.uri, {
    encoding: FileSystem.EncodingType.Base64,
  });

  // Step 3: Decode PNG to get pixel data
  const pngBuffer = Buffer.from(base64, 'base64');
  const result = decodePNG(pngBuffer);

  if (result) {
    return result;
  }

  // Fallback: create a simple white image
  console.warn('PNG decode failed, creating white fallback');
  const width = targetWidth;
  const height = Math.round(targetWidth * (resized.height / resized.width));
  const pixels = new Uint8Array(width * height * 4);
  for (let i = 0; i < pixels.length; i += 4) {
    pixels[i] = 255;     // R
    pixels[i + 1] = 255; // G
    pixels[i + 2] = 255; // B
    pixels[i + 3] = 255; // A
  }
  return { pixels, width, height };
}

// ─── PNG Decoder ──────────────────────────────────────────

interface PNGResult {
  pixels: Uint8Array;
  width: number;
  height: number;
}

function decodePNG(data: Buffer): PNGResult | null {
  try {
    // Use pako for zlib decompression
    const pako = require('pako');

    // Verify PNG signature
    if (data[0] !== 0x89 || data[1] !== 0x50 || data[2] !== 0x4e || data[3] !== 0x47) {
      return null;
    }

    let width = 0, height = 0, bitDepth = 0, colorType = 0;
    const idatChunks: Buffer[] = [];
    let palette: Uint8Array | null = null;
    let transparency: Uint8Array | null = null;

    let offset = 8; // Skip signature

    while (offset < data.length) {
      const length = data.readUInt32BE(offset);
      const type = data.slice(offset + 4, offset + 8).toString('ascii');
      const chunkData = data.slice(offset + 8, offset + 8 + length);

      if (type === 'IHDR') {
        width = chunkData.readUInt32BE(0);
        height = chunkData.readUInt32BE(4);
        bitDepth = chunkData[8];
        colorType = chunkData[9];
      } else if (type === 'PLTE') {
        palette = new Uint8Array(chunkData);
      } else if (type === 'tRNS') {
        transparency = new Uint8Array(chunkData);
      } else if (type === 'IDAT') {
        idatChunks.push(chunkData);
      } else if (type === 'IEND') {
        break;
      }

      offset += 12 + length; // 4(len) + 4(type) + length + 4(crc)
    }

    if (width === 0 || height === 0 || idatChunks.length === 0) return null;

    // Concatenate IDAT chunks and decompress
    const compressed = Buffer.concat(idatChunks);
    const inflated = pako.inflate(new Uint8Array(compressed));

    // Calculate bytes per pixel and scanline
    let channels = 1;
    if (colorType === 2) channels = 3;       // RGB
    else if (colorType === 4) channels = 2;  // Grayscale+Alpha
    else if (colorType === 6) channels = 4;  // RGBA
    else if (colorType === 3) channels = 1;  // Palette

    const bpp = (channels * bitDepth) / 8;
    const scanlineBytes = Math.ceil(width * bpp);

    // Unfilter scanlines
    const raw = new Uint8Array(height * scanlineBytes);
    let srcIdx = 0;

    for (let y = 0; y < height; y++) {
      const filterType = inflated[srcIdx++];
      const rowStart = y * scanlineBytes;
      const prevRow = (y - 1) * scanlineBytes;
      const bppInt = Math.max(1, Math.ceil(bpp));

      for (let x = 0; x < scanlineBytes; x++) {
        const val = inflated[srcIdx++];
        const a = x >= bppInt ? raw[rowStart + x - bppInt] : 0;
        const b = y > 0 ? raw[prevRow + x] : 0;
        const c = (x >= bppInt && y > 0) ? raw[prevRow + x - bppInt] : 0;

        let result = val;
        switch (filterType) {
          case 0: result = val; break;                    // None
          case 1: result = (val + a) & 0xff; break;      // Sub
          case 2: result = (val + b) & 0xff; break;      // Up
          case 3: result = (val + ((a + b) >> 1)) & 0xff; break; // Average
          case 4: result = (val + paethPredictor(a, b, c)) & 0xff; break; // Paeth
        }
        raw[rowStart + x] = result;
      }
    }

    // Convert to RGBA
    const pixels = new Uint8Array(width * height * 4);

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const dstIdx = (y * width + x) * 4;
        const srcBase = y * scanlineBytes;

        if (colorType === 0) {
          // Grayscale
          const g = bitDepth === 16 ? raw[srcBase + x * 2] : raw[srcBase + x];
          pixels[dstIdx] = g;
          pixels[dstIdx + 1] = g;
          pixels[dstIdx + 2] = g;
          pixels[dstIdx + 3] = 255;
        } else if (colorType === 2) {
          // RGB
          const base = srcBase + x * (bitDepth === 16 ? 6 : 3);
          const step = bitDepth === 16 ? 2 : 1;
          pixels[dstIdx] = raw[base];
          pixels[dstIdx + 1] = raw[base + step];
          pixels[dstIdx + 2] = raw[base + step * 2];
          pixels[dstIdx + 3] = 255;
        } else if (colorType === 3) {
          // Palette
          const palIdx = raw[srcBase + x];
          if (palette && palIdx * 3 + 2 < palette.length) {
            pixels[dstIdx] = palette[palIdx * 3];
            pixels[dstIdx + 1] = palette[palIdx * 3 + 1];
            pixels[dstIdx + 2] = palette[palIdx * 3 + 2];
            pixels[dstIdx + 3] = transparency && palIdx < transparency.length ? transparency[palIdx] : 255;
          }
        } else if (colorType === 4) {
          // Grayscale + Alpha
          const base = srcBase + x * (bitDepth === 16 ? 4 : 2);
          const step = bitDepth === 16 ? 2 : 1;
          const g = raw[base];
          pixels[dstIdx] = g;
          pixels[dstIdx + 1] = g;
          pixels[dstIdx + 2] = g;
          pixels[dstIdx + 3] = raw[base + step];
        } else if (colorType === 6) {
          // RGBA
          const base = srcBase + x * (bitDepth === 16 ? 8 : 4);
          const step = bitDepth === 16 ? 2 : 1;
          pixels[dstIdx] = raw[base];
          pixels[dstIdx + 1] = raw[base + step];
          pixels[dstIdx + 2] = raw[base + step * 2];
          pixels[dstIdx + 3] = raw[base + step * 3];
        }
      }
    }

    return { pixels, width, height };
  } catch (e) {
    console.error('PNG decode error:', e);
    return null;
  }
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
