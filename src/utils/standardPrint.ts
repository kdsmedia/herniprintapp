/**
 * Standard Printer Engine
 * Professional color printing to regular printers (Epson, Canon, HP, Brother, etc.)
 * via Android Print Framework using expo-print
 * 
 * Supports: images, PDF, text/receipts, QR/barcode
 * Settings: paper size, quality, orientation, paper type, border, copies, color mode
 */
import * as Print from 'expo-print';
import * as FileSystem from 'expo-file-system';

// ─── Types ────────────────────────────────────────────────
export type PrinterMode = 'thermal' | 'standard';

export type PaperSize = 
  | 'A4' | 'A3' | 'A5' | 'B5' 
  | 'Letter' | 'Legal' 
  | '4x6' | '5x7' | '10x15' | '13x18';

export type PrintQuality = 'draft' | 'standard' | 'high';
export type Orientation = 'portrait' | 'landscape';
export type PaperType = 'plain' | 'matte' | 'glossy' | 'photo' | 'cardstock' | 'envelope' | 'label';
export type BorderMode = 'bordered' | 'borderless';
export type ColorMode = 'color' | 'grayscale';

export interface StandardPrintSettings {
  paperSize: PaperSize;
  quality: PrintQuality;
  orientation: Orientation;
  paperType: PaperType;
  borderMode: BorderMode;
  colorMode: ColorMode;
  copies: number;
}

export const DEFAULT_PRINT_SETTINGS: StandardPrintSettings = {
  paperSize: 'A4',
  quality: 'standard',
  orientation: 'portrait',
  paperType: 'plain',
  borderMode: 'bordered',
  colorMode: 'color',
  copies: 1,
};

// ─── Paper Dimensions (mm) ────────────────────────────────
const PAPER_DIMENSIONS: Record<PaperSize, { w: number; h: number; label: string; category: string }> = {
  'A3':    { w: 297, h: 420, label: 'A3 (297 × 420 mm)', category: 'Dokumen' },
  'A4':    { w: 210, h: 297, label: 'A4 (210 × 297 mm)', category: 'Dokumen' },
  'A5':    { w: 148, h: 210, label: 'A5 (148 × 210 mm)', category: 'Dokumen' },
  'B5':    { w: 176, h: 250, label: 'B5 (176 × 250 mm)', category: 'Dokumen' },
  'Letter':{ w: 216, h: 279, label: 'Letter (8.5 × 11")', category: 'Dokumen' },
  'Legal': { w: 216, h: 356, label: 'Legal (8.5 × 14")', category: 'Dokumen' },
  '4x6':   { w: 102, h: 152, label: '4×6" (Foto)', category: 'Foto' },
  '5x7':   { w: 127, h: 178, label: '5×7" (Foto)', category: 'Foto' },
  '10x15': { w: 100, h: 150, label: '10×15 cm', category: 'Foto' },
  '13x18': { w: 130, h: 180, label: '13×18 cm', category: 'Foto' },
};

export function getPaperLabel(size: PaperSize): string {
  return PAPER_DIMENSIONS[size]?.label || size;
}

export function getPaperDimensions(size: PaperSize) {
  return PAPER_DIMENSIONS[size];
}

export function getAllPaperSizes(): { value: PaperSize; label: string; category: string }[] {
  return Object.entries(PAPER_DIMENSIONS).map(([key, val]) => ({
    value: key as PaperSize,
    label: val.label,
    category: val.category,
  }));
}

// ─── Quality to DPI mapping ──────────────────────────────
function qualityToDpi(quality: PrintQuality): number {
  switch (quality) {
    case 'draft': return 150;
    case 'standard': return 300;
    case 'high': return 600;
  }
}

// ─── CSS for print quality ───────────────────────────────
function qualityCss(quality: PrintQuality): string {
  switch (quality) {
    case 'draft': return 'image-rendering: pixelated;';
    case 'standard': return 'image-rendering: auto;';
    case 'high': return 'image-rendering: high-quality; -webkit-print-color-adjust: exact; print-color-adjust: exact;';
  }
}

// ─── Build HTML ──────────────────────────────────────────
function buildPrintHtml(
  contentHtml: string,
  settings: StandardPrintSettings,
): string {
  const paper = PAPER_DIMENSIONS[settings.paperSize];
  const isLandscape = settings.orientation === 'landscape';
  const w = isLandscape ? paper.h : paper.w;
  const h = isLandscape ? paper.w : paper.h;

  // Margin based on border mode
  const margin = settings.borderMode === 'borderless' ? '0' : '8mm';

  // Grayscale filter
  const grayscaleFilter = settings.colorMode === 'grayscale' ? 'filter: grayscale(100%);' : '';

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<style>
  @page {
    size: ${w}mm ${h}mm;
    margin: ${margin};
  }
  @media print {
    html, body { 
      width: ${w}mm; 
      height: ${h}mm; 
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
  }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body {
    width: 100%;
    min-height: 100%;
    font-family: -apple-system, 'Segoe UI', Roboto, Arial, sans-serif;
  }
  body {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    background: white;
    ${grayscaleFilter}
  }
  .page {
    width: 100%;
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    text-align: center;
    ${settings.borderMode === 'borderless' ? '' : 'padding: 8mm;'}
    page-break-after: always;
  }
  .page:last-child {
    page-break-after: auto;
  }
  img {
    max-width: 100%;
    max-height: ${settings.borderMode === 'borderless' ? '100vh' : 'calc(100vh - 16mm)'};
    object-fit: contain;
    display: block;
    margin: 0 auto;
    ${qualityCss(settings.quality)}
  }
  .receipt-text {
    font-family: 'Courier New', 'Consolas', monospace;
    font-size: 12pt;
    white-space: pre-wrap;
    word-break: break-word;
    color: #000;
    width: 100%;
    text-align: left;
    line-height: 1.5;
  }
  .receipt-header {
    font-family: Arial, sans-serif;
    font-size: 18pt;
    font-weight: bold;
    color: #1a1a1a;
    margin-bottom: 16px;
    text-align: center;
    border-bottom: 2px solid #333;
    padding-bottom: 12px;
  }
  .receipt-footer {
    margin-top: 16px;
    padding-top: 12px;
    border-top: 1px solid #ccc;
    font-size: 9pt;
    color: #666;
    text-align: center;
  }
  .code-container {
    text-align: center;
    padding: 30px;
  }
  .code-label {
    font-family: 'Courier New', monospace;
    margin-top: 20px;
    font-size: 14pt;
    color: #333;
    letter-spacing: 2px;
  }
</style>
</head>
<body>
${contentHtml}
</body>
</html>`;
}

// ─── Print: Image ────────────────────────────────────────
export async function printImageStandard(
  imageUri: string,
  settings: StandardPrintSettings,
): Promise<void> {
  const base64 = await FileSystem.readAsStringAsync(imageUri, {
    encoding: FileSystem.EncodingType.Base64,
  });

  const ext = imageUri.toLowerCase();
  const mime = ext.includes('.png') ? 'image/png'
    : ext.includes('.webp') ? 'image/webp'
    : 'image/jpeg';

  const imgTag = `<img src="data:${mime};base64,${base64}" />`;

  // Generate pages for copies
  const pages = Array.from({ length: settings.copies }, () =>
    `<div class="page">${imgTag}</div>`
  ).join('\n');

  const html = buildPrintHtml(pages, settings);
  await Print.printAsync({ html });
}

// ─── Print: PDF ──────────────────────────────────────────
export async function printPdfStandard(
  pdfUri: string,
  _settings: StandardPrintSettings,
): Promise<void> {
  // Android Print Framework handles PDF rendering natively
  // Settings like orientation/paper size are chosen in the system print dialog
  await Print.printAsync({ uri: pdfUri });
}

// ─── Print: Receipt/Text ─────────────────────────────────
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

  const now = new Date();
  const dateStr = now.toLocaleDateString('id-ID', { 
    year: 'numeric', month: 'long', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });

  const singlePage = `
    <div class="page">
      <div style="width: 100%; max-width: 400px; margin: 0 auto;">
        <div class="receipt-header">${storeName}</div>
        <div class="receipt-text">${escapedText}</div>
        <div class="receipt-footer">
          Dicetak: ${dateStr}<br>
          HERNIPRINT Digital Printing Solutions
        </div>
      </div>
    </div>`;

  const pages = Array.from({ length: settings.copies }, () => singlePage).join('\n');
  const html = buildPrintHtml(pages, settings);
  await Print.printAsync({ html });
}

// ─── Print: QR/Barcode ───────────────────────────────────
export async function printCodeHtmlStandard(
  text: string,
  codeType: 'qr' | 'barcode',
  settings: StandardPrintSettings,
): Promise<void> {
  const escapedText = text.replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const grayscaleFilter = settings.colorMode === 'grayscale' ? 'filter: grayscale(100%);' : '';

  let codeHtml: string;
  if (codeType === 'qr') {
    codeHtml = `
      <div class="code-container">
        <div id="qr-code" style="${grayscaleFilter}"></div>
        <p class="code-label">${escapedText}</p>
      </div>
      <script src="https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js"><\/script>
      <script>
        new QRCode(document.getElementById('qr-code'), {
          text: "${escapedText}",
          width: 280,
          height: 280,
          colorDark: "#000000",
          colorLight: "#ffffff",
          correctLevel: QRCode.CorrectLevel.H
        });
      <\/script>`;
  } else {
    codeHtml = `
      <div class="code-container" style="${grayscaleFilter}">
        <svg id="barcode"></svg>
        <p class="code-label">${escapedText}</p>
      </div>
      <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.5/dist/JsBarcode.all.min.js"><\/script>
      <script>
        JsBarcode("#barcode", "${escapedText}", {
          format: "CODE128",
          width: 3,
          height: 120,
          displayValue: false,
          lineColor: "#000000",
          margin: 0
        });
      <\/script>`;
  }

  // Build pages with copies
  const singlePage = `<div class="page">${codeHtml}</div>`;
  const pages = Array.from({ length: settings.copies }, () => singlePage).join('\n');

  const paper = PAPER_DIMENSIONS[settings.paperSize];
  const isLandscape = settings.orientation === 'landscape';
  const w = isLandscape ? paper.h : paper.w;
  const h = isLandscape ? paper.w : paper.h;
  const margin = settings.borderMode === 'borderless' ? '0' : '8mm';

  const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
  @page { size: ${w}mm ${h}mm; margin: ${margin}; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    display: flex; flex-direction: column; 
    align-items: center; justify-content: center;
    min-height: 100vh; background: white;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .page {
    width: 100%; min-height: 100vh;
    display: flex; align-items: center; justify-content: center;
    page-break-after: always;
  }
  .page:last-child { page-break-after: auto; }
  .code-container { text-align: center; padding: 30px; }
  .code-label {
    font-family: 'Courier New', monospace;
    margin-top: 20px; font-size: 14pt; color: #333;
    letter-spacing: 2px;
  }
</style>
</head>
<body>
${pages}
</body>
</html>`;

  await Print.printAsync({ html });
}

// ─── Print: Save as PDF file ─────────────────────────────
export async function saveAsPdf(
  imageUri: string,
  settings: StandardPrintSettings,
): Promise<string> {
  const base64 = await FileSystem.readAsStringAsync(imageUri, {
    encoding: FileSystem.EncodingType.Base64,
  });

  const ext = imageUri.toLowerCase();
  const mime = ext.includes('.png') ? 'image/png' : 'image/jpeg';
  const imgTag = `<img src="data:${mime};base64,${base64}" />`;
  const page = `<div class="page">${imgTag}</div>`;
  const html = buildPrintHtml(page, settings);

  const { uri } = await Print.printToFileAsync({ html });
  return uri;
}
