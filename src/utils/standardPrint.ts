/**
 * Standard Printer Engine — Professional Print System
 * Like HP/Canon/Epson printer software dialog
 * via Android Print Framework (expo-print)
 */
import * as Print from 'expo-print';
import * as FileSystem from 'expo-file-system';

// ─── Types ────────────────────────────────────────────────
export type PrinterMode = 'thermal' | 'standard';

export type PaperSize =
  | 'A4' | 'A3' | 'A5' | 'B5'
  | 'Letter' | 'Legal'
  | '4x6' | '5x7' | '10x15' | '13x18';

export type PrintQuality = 'draft' | 'standard' | 'high' | 'photo';
export type Orientation = 'portrait' | 'landscape';
export type PaperType = 'plain' | 'matte' | 'glossy' | 'photo' | 'cardstock' | 'envelope' | 'label';
export type BorderMode = 'bordered' | 'narrow' | 'borderless';
export type ColorMode = 'color' | 'grayscale';
export type ScaleMode = 'fit' | 'fill' | 'actual' | 'custom';
export type DuplexMode = 'simplex' | 'long-edge' | 'short-edge';

export interface StandardPrintSettings {
  paperSize: PaperSize;
  quality: PrintQuality;
  orientation: Orientation;
  paperType: PaperType;
  borderMode: BorderMode;
  colorMode: ColorMode;
  copies: number;
  scaleMode: ScaleMode;
  customScale: number; // 10-400%
  duplex: DuplexMode;
  collate: boolean; // untuk multi-copy: urut per set atau per halaman
}

export const DEFAULT_PRINT_SETTINGS: StandardPrintSettings = {
  paperSize: 'A4',
  quality: 'standard',
  orientation: 'portrait',
  paperType: 'plain',
  borderMode: 'bordered',
  colorMode: 'color',
  copies: 1,
  scaleMode: 'fit',
  customScale: 100,
  duplex: 'simplex',
  collate: true,
};

// ─── Paper Dimensions (mm) ────────────────────────────────
const PAPER_DIMENSIONS: Record<PaperSize, { w: number; h: number; label: string; category: string }> = {
  'A3':     { w: 297, h: 420, label: 'A3 (297 × 420 mm)', category: 'Dokumen' },
  'A4':     { w: 210, h: 297, label: 'A4 (210 × 297 mm)', category: 'Dokumen' },
  'A5':     { w: 148, h: 210, label: 'A5 (148 × 210 mm)', category: 'Dokumen' },
  'B5':     { w: 176, h: 250, label: 'B5 (176 × 250 mm)', category: 'Dokumen' },
  'Letter': { w: 216, h: 279, label: 'Letter (8.5 × 11")', category: 'Dokumen' },
  'Legal':  { w: 216, h: 356, label: 'Legal (8.5 × 14")', category: 'Dokumen' },
  '4x6':    { w: 102, h: 152, label: '4×6" (Foto)', category: 'Foto' },
  '5x7':    { w: 127, h: 178, label: '5×7" (Foto)', category: 'Foto' },
  '10x15':  { w: 100, h: 150, label: '10×15 cm', category: 'Foto' },
  '13x18':  { w: 130, h: 180, label: '13×18 cm', category: 'Foto' },
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

// ─── Margin values ───────────────────────────────────────
function getMargin(mode: BorderMode): string {
  switch (mode) {
    case 'bordered': return '10mm';
    case 'narrow': return '5mm';
    case 'borderless': return '0';
  }
}

// ─── Scale CSS ───────────────────────────────────────────
function getScaleCss(settings: StandardPrintSettings): string {
  switch (settings.scaleMode) {
    case 'fit':
      return 'max-width: 100%; max-height: 100%; object-fit: contain;';
    case 'fill':
      return 'width: 100%; height: 100%; object-fit: cover;';
    case 'actual':
      return 'width: auto; height: auto; max-width: none;';
    case 'custom':
      return `width: ${settings.customScale}%; height: auto;`;
  }
}

// ─── Quality CSS ─────────────────────────────────────────
function getQualityCss(quality: PrintQuality): string {
  switch (quality) {
    case 'draft': return 'image-rendering: pixelated;';
    case 'standard': return 'image-rendering: auto;';
    case 'high': return 'image-rendering: high-quality;';
    case 'photo': return 'image-rendering: high-quality; -webkit-print-color-adjust: exact;';
  }
}

// ─── Build Print HTML ────────────────────────────────────
function buildPrintHtml(
  contentHtml: string,
  settings: StandardPrintSettings,
): string {
  const paper = PAPER_DIMENSIONS[settings.paperSize];
  const isLandscape = settings.orientation === 'landscape';
  const w = isLandscape ? paper.h : paper.w;
  const h = isLandscape ? paper.w : paper.h;
  const margin = getMargin(settings.borderMode);
  const grayscale = settings.colorMode === 'grayscale' ? 'filter: grayscale(100%);' : '';

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
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
  }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body {
    width: 100%;
    min-height: 100%;
    font-family: -apple-system, 'Segoe UI', Roboto, Arial, sans-serif;
    background: white;
  }
  body { ${grayscale} }
  .page {
    width: 100%;
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    page-break-after: always;
    overflow: hidden;
    ${settings.borderMode !== 'borderless' ? `padding: ${margin};` : ''}
  }
  .page:last-child { page-break-after: auto; }
  img {
    display: block;
    margin: 0 auto;
    ${getScaleCss(settings)}
    ${getQualityCss(settings.quality)}
  }
  .receipt-wrap {
    width: 100%;
    max-width: 500px;
    margin: 0 auto;
    font-family: 'Courier New', 'Consolas', monospace;
  }
  .receipt-header {
    font-family: Arial, Helvetica, sans-serif;
    font-size: 20pt;
    font-weight: bold;
    color: #1a1a1a;
    text-align: center;
    border-bottom: 2px solid #333;
    padding-bottom: 12px;
    margin-bottom: 16px;
  }
  .receipt-body {
    font-size: 11pt;
    white-space: pre-wrap;
    word-break: break-word;
    color: #000;
    line-height: 1.6;
  }
  .receipt-footer {
    margin-top: 20px;
    padding-top: 12px;
    border-top: 1px dashed #999;
    font-size: 9pt;
    color: #666;
    text-align: center;
    font-family: Arial, sans-serif;
  }
  .code-wrap {
    text-align: center;
    padding: 40px 20px;
  }
  .code-label {
    font-family: 'Courier New', monospace;
    margin-top: 24px;
    font-size: 14pt;
    color: #333;
    letter-spacing: 3px;
  }
</style>
</head>
<body>
${contentHtml}
</body>
</html>`;
}

// ─── Generate pages with copies ──────────────────────────
function makePages(singlePage: string, copies: number): string {
  return Array.from({ length: copies }, () => singlePage).join('\n');
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
  const page = `<div class="page">${imgTag}</div>`;
  const html = buildPrintHtml(makePages(page, settings.copies), settings);
  await Print.printAsync({ html });
}

// ─── Print: PDF ──────────────────────────────────────────
export async function printPdfStandard(
  pdfUri: string,
  _settings: StandardPrintSettings,
): Promise<void> {
  await Print.printAsync({ uri: pdfUri });
}

// ─── Print: Receipt/Text ─────────────────────────────────
export async function printTextStandard(
  text: string,
  settings: StandardPrintSettings,
  storeName: string = 'HERNIPRINT',
): Promise<void> {
  const escaped = text
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/\n/g, '<br>');

  const now = new Date();
  const dateStr = now.toLocaleDateString('id-ID', {
    year: 'numeric', month: 'long', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });

  const page = `<div class="page">
    <div class="receipt-wrap">
      <div class="receipt-header">${storeName}</div>
      <div class="receipt-body">${escaped}</div>
      <div class="receipt-footer">
        ${dateStr}
      </div>
    </div>
  </div>`;

  const html = buildPrintHtml(makePages(page, settings.copies), settings);
  await Print.printAsync({ html });
}

// ─── Print: QR/Barcode ───────────────────────────────────
export async function printCodeHtmlStandard(
  text: string,
  codeType: 'qr' | 'barcode',
  settings: StandardPrintSettings,
): Promise<void> {
  const esc = text.replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const paper = PAPER_DIMENSIONS[settings.paperSize];
  const isLandscape = settings.orientation === 'landscape';
  const w = isLandscape ? paper.h : paper.w;
  const h = isLandscape ? paper.w : paper.h;
  const margin = getMargin(settings.borderMode);
  const grayscale = settings.colorMode === 'grayscale' ? 'filter: grayscale(100%);' : '';

  let codeHtml: string;
  if (codeType === 'qr') {
    codeHtml = `<div class="code-wrap" style="${grayscale}">
      <div id="qr-code"></div>
      <p class="code-label">${esc}</p>
    </div>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js"><\/script>
    <script>new QRCode(document.getElementById('qr-code'),{text:"${esc}",width:280,height:280,colorDark:"#000",colorLight:"#fff",correctLevel:QRCode.CorrectLevel.H});<\/script>`;
  } else {
    codeHtml = `<div class="code-wrap" style="${grayscale}">
      <svg id="barcode"></svg>
      <p class="code-label">${esc}</p>
    </div>
    <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.5/dist/JsBarcode.all.min.js"><\/script>
    <script>JsBarcode("#barcode","${esc}",{format:"CODE128",width:3,height:120,displayValue:false,lineColor:"#000",margin:0});<\/script>`;
  }

  const page = `<div class="page">${codeHtml}</div>`;
  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8">
<style>
  @page{size:${w}mm ${h}mm;margin:${margin}}
  *{margin:0;padding:0;box-sizing:border-box}
  body{display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;background:#fff;-webkit-print-color-adjust:exact;print-color-adjust:exact}
  .page{width:100%;min-height:100vh;display:flex;align-items:center;justify-content:center;page-break-after:always}
  .page:last-child{page-break-after:auto}
  .code-wrap{text-align:center;padding:30px}
  .code-label{font-family:'Courier New',monospace;margin-top:20px;font-size:14pt;color:#333;letter-spacing:3px}
</style></head><body>${makePages(page, settings.copies)}</body></html>`;
  await Print.printAsync({ html });
}

// ─── Save as PDF ─────────────────────────────────────────
export async function saveAsPdf(
  imageUri: string,
  settings: StandardPrintSettings,
): Promise<string> {
  const base64 = await FileSystem.readAsStringAsync(imageUri, {
    encoding: FileSystem.EncodingType.Base64,
  });
  const mime = imageUri.toLowerCase().includes('.png') ? 'image/png' : 'image/jpeg';
  const page = `<div class="page"><img src="data:${mime};base64,${base64}" /></div>`;
  const html = buildPrintHtml(page, settings);
  const { uri } = await Print.printToFileAsync({ html });
  return uri;
}
