/**
 * PdfConverter — Converts PDF pages to images using WebView + PDF.js
 *
 * Approach: Hidden WebView loads PDF.js from CDN, renders PDF pages
 * to <canvas>, exports as base64 PNG, saves to cache.
 *
 * Why WebView + PDF.js?
 * - react-native-pdf-to-image has compatibility issues with Expo SDK 52
 * - react-native-pdf + view-shot fails on Android (offscreen view optimization)
 * - PDF.js is battle-tested and works everywhere
 *
 * Features:
 * - Convert any page by number
 * - Get total page count
 * - Configurable render scale
 * - Proper error handling with timeout
 * - WebView persists for fast re-conversion
 */
import React, {
  useRef, useCallback, useImperativeHandle, forwardRef, useState,
} from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { WebView, WebViewMessageEvent } from 'react-native-webview';
import * as FileSystem from 'expo-file-system';

// ─── Public Interface ─────────────────────────────────────
export interface PdfConverterRef {
  /**
   * Load a PDF and get its page count.
   * Must be called before convertPage().
   */
  loadPdf: (pdfUri: string) => Promise<number>;

  /**
   * Convert a specific page to PNG image.
   * Returns file URI of the saved PNG.
   * loadPdf() must be called first.
   */
  convertPage: (page: number, scale?: number) => Promise<string>;

  /** Whether the WebView is ready */
  isReady: () => boolean;
}

interface Props {
  /** Default render scale (default 2.0 for good quality) */
  defaultScale?: number;
  /** Called when WebView is ready */
  onReady?: () => void;
}

// ─── PDF.js Renderer HTML ─────────────────────────────────
const PDF_RENDERER_HTML = `
<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<style>
  * { margin: 0; padding: 0; }
  body { background: white; overflow: hidden; }
  canvas { display: block; }
</style>
</head>
<body>
<canvas id="canvas"></canvas>
<script>
// Load PDF.js from CDN
var script = document.createElement('script');
script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
script.onload = function() {
  pdfjsLib.GlobalWorkerOptions.workerSrc =
    'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
  window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'ready' }));
};
script.onerror = function() {
  window.ReactNativeWebView.postMessage(JSON.stringify({
    type: 'ready_error',
    error: 'Gagal memuat PDF.js. Periksa koneksi internet.'
  }));
};
document.head.appendChild(script);

var currentPdf = null;

// Listen for messages from React Native
document.addEventListener('message', handleMsg);
window.addEventListener('message', handleMsg);

function handleMsg(event) {
  try {
    var msg = JSON.parse(event.data);

    if (msg.type === 'load_pdf') {
      loadPdf(msg.base64);
    } else if (msg.type === 'render_page') {
      renderPage(msg.page, msg.scale);
    }
  } catch(e) {
    window.ReactNativeWebView.postMessage(JSON.stringify({
      type: 'error',
      error: 'Parse error: ' + e.message
    }));
  }
}

async function loadPdf(base64Data) {
  try {
    var pdfData = atob(base64Data);
    var pdfArray = new Uint8Array(pdfData.length);
    for (var i = 0; i < pdfData.length; i++) {
      pdfArray[i] = pdfData.charCodeAt(i);
    }

    currentPdf = await pdfjsLib.getDocument({ data: pdfArray }).promise;

    window.ReactNativeWebView.postMessage(JSON.stringify({
      type: 'pdf_loaded',
      totalPages: currentPdf.numPages
    }));
  } catch(err) {
    currentPdf = null;
    window.ReactNativeWebView.postMessage(JSON.stringify({
      type: 'pdf_load_error',
      error: err.message || 'Gagal memuat PDF'
    }));
  }
}

async function renderPage(pageNum, scale) {
  try {
    if (!currentPdf) {
      throw new Error('PDF belum dimuat');
    }
    if (pageNum < 1 || pageNum > currentPdf.numPages) {
      throw new Error('Halaman ' + pageNum + ' tidak ada (total: ' + currentPdf.numPages + ')');
    }

    var page = await currentPdf.getPage(pageNum);
    var viewport = page.getViewport({ scale: scale || 2.0 });

    var canvas = document.getElementById('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    var ctx = canvas.getContext('2d');

    // White background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    await page.render({ canvasContext: ctx, viewport: viewport }).promise;

    // Export as PNG base64
    var dataUrl = canvas.toDataURL('image/png');
    var base64Png = dataUrl.split(',')[1];

    window.ReactNativeWebView.postMessage(JSON.stringify({
      type: 'page_rendered',
      success: true,
      base64: base64Png,
      page: pageNum,
      width: Math.round(viewport.width),
      height: Math.round(viewport.height),
      totalPages: currentPdf.numPages
    }));
  } catch(err) {
    window.ReactNativeWebView.postMessage(JSON.stringify({
      type: 'page_rendered',
      success: false,
      page: pageNum,
      error: err.message || 'Gagal render halaman'
    }));
  }
}
</script>
</body>
</html>
`;

// ─── Component ────────────────────────────────────────────
const PdfConverter = forwardRef<PdfConverterRef, Props>(
  ({ defaultScale = 2.0, onReady }, ref) => {
    const webViewRef = useRef<WebView>(null);
    const [ready, setReady] = useState(false);

    // Promise resolvers for async operations
    const loadResolveRef = useRef<((pages: number) => void) | null>(null);
    const loadRejectRef = useRef<((err: Error) => void) | null>(null);
    const renderResolveRef = useRef<((uri: string) => void) | null>(null);
    const renderRejectRef = useRef<((err: Error) => void) | null>(null);
    const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const clearTimeout_ = () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };

    const handleMessage = useCallback(async (event: WebViewMessageEvent) => {
      try {
        const msg = JSON.parse(event.nativeEvent.data);

        switch (msg.type) {
          case 'ready':
            setReady(true);
            onReady?.();
            break;

          case 'ready_error':
            console.error('PDF.js load failed:', msg.error);
            // Still mark as "ready" but operations will fail with clear errors
            setReady(true);
            onReady?.();
            break;

          case 'pdf_loaded':
            clearTimeout_();
            if (loadResolveRef.current) {
              loadResolveRef.current(msg.totalPages);
              loadResolveRef.current = null;
              loadRejectRef.current = null;
            }
            break;

          case 'pdf_load_error':
            clearTimeout_();
            if (loadRejectRef.current) {
              loadRejectRef.current(new Error(msg.error || 'Gagal memuat PDF'));
              loadResolveRef.current = null;
              loadRejectRef.current = null;
            }
            break;

          case 'page_rendered':
            clearTimeout_();
            if (msg.success && msg.base64) {
              // Save PNG to cache
              const filename = `pdf_page_${msg.page}_${Date.now()}.png`;
              const filePath = `${FileSystem.cacheDirectory}${filename}`;
              await FileSystem.writeAsStringAsync(filePath, msg.base64, {
                encoding: FileSystem.EncodingType.Base64,
              });

              if (renderResolveRef.current) {
                renderResolveRef.current(filePath);
                renderResolveRef.current = null;
                renderRejectRef.current = null;
              }
            } else {
              if (renderRejectRef.current) {
                renderRejectRef.current(
                  new Error(msg.error || 'Gagal render halaman')
                );
                renderResolveRef.current = null;
                renderRejectRef.current = null;
              }
            }
            break;

          case 'error':
            console.error('PdfConverter error:', msg.error);
            break;
        }
      } catch (e: any) {
        console.error('PdfConverter handleMessage error:', e);
      }
    }, [onReady]);

    useImperativeHandle(ref, () => ({
      isReady: () => ready,

      loadPdf: async (pdfUri: string): Promise<number> => {
        if (!webViewRef.current) {
          throw new Error('WebView belum siap');
        }

        // Read PDF as base64
        const base64 = await FileSystem.readAsStringAsync(pdfUri, {
          encoding: FileSystem.EncodingType.Base64,
        });

        return new Promise<number>((resolve, reject) => {
          // Cancel any pending load
          if (loadRejectRef.current) {
            loadRejectRef.current(new Error('Dibatalkan'));
          }
          clearTimeout_();

          loadResolveRef.current = resolve;
          loadRejectRef.current = reject;

          // Timeout 20s
          timeoutRef.current = setTimeout(() => {
            if (loadRejectRef.current) {
              loadRejectRef.current(
                new Error('Timeout: PDF terlalu besar atau koneksi lambat')
              );
              loadResolveRef.current = null;
              loadRejectRef.current = null;
            }
          }, 20000);

          webViewRef.current!.postMessage(
            JSON.stringify({ type: 'load_pdf', base64 })
          );
        });
      },

      convertPage: async (
        page: number,
        scale?: number
      ): Promise<string> => {
        if (!webViewRef.current) {
          throw new Error('WebView belum siap');
        }

        return new Promise<string>((resolve, reject) => {
          // Cancel any pending render
          if (renderRejectRef.current) {
            renderRejectRef.current(new Error('Dibatalkan'));
          }
          clearTimeout_();

          renderResolveRef.current = resolve;
          renderRejectRef.current = reject;

          // Timeout 15s per page
          timeoutRef.current = setTimeout(() => {
            if (renderRejectRef.current) {
              renderRejectRef.current(
                new Error('Timeout: Halaman terlalu kompleks')
              );
              renderResolveRef.current = null;
              renderRejectRef.current = null;
            }
          }, 15000);

          webViewRef.current!.postMessage(
            JSON.stringify({
              type: 'render_page',
              page,
              scale: scale || defaultScale,
            })
          );
        });
      },
    }));

    return (
      <View style={styles.container} pointerEvents="none" collapsable={false}>
        <WebView
          ref={webViewRef}
          source={{ html: PDF_RENDERER_HTML }}
          onMessage={handleMessage}
          javaScriptEnabled={true}
          domStorageEnabled={true}
          originWhitelist={['*']}
          style={styles.webview}
          cacheEnabled={true}
          startInLoadingState={false}
          androidLayerType="hardware"
          // Allow mixed content for CDN loading
          mixedContentMode="compatibility"
          // Important: don't let Android skip rendering
          collapsable={false}
          nestedScrollEnabled={false}
        />
      </View>
    );
  }
);

PdfConverter.displayName = 'PdfConverter';
export default PdfConverter;

// ─── Styles ───────────────────────────────────────────────
// Use offscreen positioning instead of opacity:0 + tiny size
// Android will NOT skip rendering views that are offscreen but have real dimensions
const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: -9999,
    top: -9999,
    width: 500,
    height: 700,
    overflow: 'hidden',
  },
  webview: {
    width: 500,
    height: 700,
    backgroundColor: '#ffffff',
  },
});
