/**
 * PdfConverter — Converts PDF pages to images using react-native-pdf-to-image
 *
 * Uses Android's native PdfRenderer for fast, reliable conversion.
 * No WebView, no capture hacks — direct native PDF → PNG.
 */
import { convert } from 'react-native-pdf-to-image';

export interface ConvertResult {
  uri: string;
  allPages: string[];
}

/**
 * Convert PDF to PNG images (all pages).
 * Returns the first page URI and all page URIs.
 *
 * @param pdfUri - URI/path to the PDF file
 * @param pageIndex - Which page to return as primary (0-based, default 0)
 * @returns Object with primary image URI and all page URIs
 */
export async function convertPdfToImage(
  pdfUri: string,
  _page: number = 1,
  _quality: number = 100,
): Promise<ConvertResult> {
  // Strip file:// prefix if present (native expects path)
  const path = pdfUri.startsWith('file://') ? pdfUri.replace('file://', '') : pdfUri;

  const result = await convert(path);

  if (!result.outputFiles || result.outputFiles.length === 0) {
    throw new Error('Konversi PDF gagal: tidak ada output');
  }

  // Ensure all URIs have file:// prefix
  const allPages = result.outputFiles.map(f =>
    f.startsWith('file://') ? f : `file://${f}`
  );

  const pageIdx = Math.min(Math.max(0, _page - 1), allPages.length - 1);

  return {
    uri: allPages[pageIdx],
    allPages,
  };
}
