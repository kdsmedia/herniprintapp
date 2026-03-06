/**
 * Standard Printer Engine
 * Handles color printing to regular printers (Epson, Canon, HP, etc.)
 * via Android Print Framework using expo-print
 */
import * as Print from 'expo-print';
import * as FileSystem from 'expo-file-system';

export type PrinterMode = 'thermal' | 'standard';
export type PaperSize = 'A4' | 'A3' | 'A5' | 'Letter' | 'Legal' | '4x6' | '5x7' | '10x15';
export type PrintQuality = 'draft' | 'standard' | 'high';
export type Orientation = 'portrait' | 'landscape';
export type PaperType = 'plain' | 'matte' | 'glossy' | 'photo' | 'cardstock';
export type BorderMode = 'bordered' | 'borderless';

export interface StandardPrintSettings {
  paperSize: PaperSize;
  quality: PrintQuality;
  orientation: Orientation;
  paperType: PaperType;
  borderMode: BorderMode;
  copies: number;
}

export const DEFAULT_PRINT_SETTINGS: StandardPrintSettings = {
  paperSize: 'A4',
  quality: 'standard',
  orientation: 'portrait',
  paperType: 'plain',
  borderMode: 'bordered',
  copies: 1,
};

// Paper dimensions in mm
const PAPER_DIMENSIONS: Record<PaperSize, { w: number; h: number; label: string }> = {
  'A4':    { w: 210, h: 297, label: 'A4 (210 × 297 mm)' },
  'A3':    { w: 297, h: 420, label: 'A3 (297 × 420 mm)' },
  'A5':    { w: 148, h: 210, label: 'A5 (148 × 210 mm)' },
  'Letter':{ w: 216, h: 279, label: 'Letter (216 × 279 mm)' },
  'Legal': { w: 216, h: 356, label: 'Legal (216 × 356 mm)' },
  '4x6':   { w: 102, h: 152, label: '4×6 inch (Foto)' },
  '5x7':   { w: 127, h: 178, label: '5×7 inch (Foto)' },
  '10x15': { w: 100, h: 150, label: '10×15 cm (Foto)' },
};

export function getPaperLabel(size: PaperSize): string {
  return PAPER_DIMENSIONS[size]?.label || size;
}

export function getAllPaperSizes(): { value: PaperSize; label: string }[] {
  return Object.entries(PAPER_DIMENSIONS).map(([key, val]) => ({
    value: key as PaperSize,
    label: val.label,
  }));
}

/**
 * Build HTML document for standard printing with full settings
 */
function buildPrintHtml(
  contentHtml: string,
  settings: StandardPrintSettings,
): string {
  const paper = PAPER_DIMENSIONS[settings.paperSize];
  const isLandscape = settings.orientation === 'landscape';
  const w = isLandscape ? paper.h : paper.w;
  const h = isLandscape ? paper.w : paper.h;
  const margin = settings.borderMode === 'borderless' ? '0' : '10mm';

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
  @page {
    size: ${w}mm ${h}mm;
    margin: ${margin};
  }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body {
    width: ${w}mm;
    height: ${h}mm;
    overflow: hidden;
  }
  body {
    display: flex;
    align-items: center;
    justify-content: center;
    background: white;
  }
  .print-content {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    ${settings.borderMode === 'borderless' ? '' : 'padding: 10mm;'}
  }
  img {
    max-width: 100%;
    max-height: 100%;
    object-fit: contain;
    ${settings.quality === 'high' ? 'image-rendering: high-quality;' : ''}
  }
  .receipt-text {
    font-family: 'Courier New', monospace;
    font-size: 14px;
    white-space: pre-wrap;
    word-break: break-word;
    color: black;
    width: 100%;
  }
</style>
</head>
<body>
<div class="print-content">
${contentHtml}
</div>
</body>
</html>`;
}

/**
 * Print an image via standard printer (color support)
 */
export async function printImageStandard(
  imageUri: string,
  settings: StandardPrintSettings,
): Promise<void> {
  // Read image as base64
  const base64 = await FileSystem.readAsStringAsync(imageUri, {
    encoding: FileSystem.EncodingType.Base64,
  });

  const ext = imageUri.toLowerCase();
  const mime = ext.includes('.png') ? 'image/png'
    : ext.includes('.webp') ? 'image/webp'
    : 'image/jpeg';

  // Repeat content for number of copies
  const imgTag = `<img src="data:${mime};base64,${base64}" />`;
  const pages = Array(settings.copies).fill(`<div class="print-content">${imgTag}</div>`).join('<div style="page-break-after: always;"></div>');
  const html = buildPrintHtml(pages, settings);

  await Print.printAsync({ html });
}

/**
 * Print a PDF file via standard printer
 */
export async function printPdfStandard(
  pdfUri: string,
  _settings: StandardPrintSettings,
): Promise<void> {
  // For PDFs, use direct URI printing (Android handles rendering)
  await Print.printAsync({ uri: pdfUri });
}

/**
 * Print receipt/label text via standard printer (formatted)
 */
export async function printTextStandard(
  text: string,
  settings: StandardPrintSettings,
  storeName: string = 'HERNIPRINT',
): Promise<void> {
  const escapedText = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\n/g, '<br>');

  const singlePage = `
    <div style="width: 100%; text-align: center; padding: 20px;">
      <h2 style="font-family: Arial; margin-bottom: 20px; color: #333;">${storeName}</h2>
      <div class="receipt-text">${escapedText}</div>
    </div>`;

  const pages = Array(settings.copies).fill(`<div class="print-content">${singlePage}</div>`).join('<div style="page-break-after: always;"></div>');
  const html = buildPrintHtml(pages, settings);
  await Print.printAsync({ html });
}

/**
 * Print QR/Barcode image via standard printer
 * Takes a base64 image of the code
 */
export async function printCodeStandard(
  codeImageBase64: string,
  label: string,
  settings: StandardPrintSettings,
): Promise<void> {
  const contentHtml = `
    <div style="text-align: center; padding: 40px;">
      <img src="data:image/png;base64,${codeImageBase64}" style="max-width: 300px;" />
      <p style="font-family: 'Courier New', monospace; margin-top: 16px; font-size: 16px; color: #333;">${label}</p>
    </div>`;

  const html = buildPrintHtml(contentHtml, settings);
  await Print.printAsync({ html });
}

/**
 * Print QR Code or Barcode via standard printer using inline HTML generation
 * Generates the code directly in HTML using JavaScript libraries loaded from CDN
 */
export async function printCodeHtmlStandard(
  text: string,
  codeType: 'qr' | 'barcode',
  settings: StandardPrintSettings,
): Promise<void> {
  const paper = PAPER_DIMENSIONS[settings.paperSize];
  const isLandscape = settings.orientation === 'landscape';
  const w = isLandscape ? paper.h : paper.w;
  const h = isLandscape ? paper.w : paper.h;
  const margin = settings.borderMode === 'borderless' ? '0' : '10mm';

  const escapedText = text.replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  let codeHtml: string;
  if (codeType === 'qr') {
    // Generate QR code using SVG table (pure HTML, no JS library needed)
    codeHtml = `
      <div id="qr-container" style="text-align: center; padding: 40px;">
        <div id="qr-code"></div>
        <p style="font-family: 'Courier New', monospace; margin-top: 20px; font-size: 14px; color: #333;">${escapedText}</p>
      </div>
      <script src="https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js"></script>
      <script>
        new QRCode(document.getElementById('qr-code'), {
          text: "${escapedText}",
          width: 256,
          height: 256,
          colorDark: "#000000",
          colorLight: "#ffffff",
          correctLevel: QRCode.CorrectLevel.H
        });
      </script>`;
  } else {
    // Generate barcode using SVG
    codeHtml = `
      <div style="text-align: center; padding: 40px;">
        <svg id="barcode"></svg>
        <p style="font-family: 'Courier New', monospace; margin-top: 20px; font-size: 14px; color: #333;">${escapedText}</p>
      </div>
      <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.5/dist/JsBarcode.all.min.js"></script>
      <script>
        JsBarcode("#barcode", "${escapedText}", {
          format: "CODE128",
          width: 3,
          height: 100,
          displayValue: true,
          fontSize: 16,
          lineColor: "#000000"
        });
      </script>`;
  }

  const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
  @page { size: ${w}mm ${h}mm; margin: ${margin}; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    display: flex; align-items: center; justify-content: center;
    min-height: 100vh; background: white;
  }
</style>
</head>
<body>
${codeHtml}
</body>
</html>`;

  await Print.printAsync({ html });
}
