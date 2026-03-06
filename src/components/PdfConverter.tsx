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
 * - Message queuing (handles messages before PDF.js is loaded)
 */
import React, {
  useRef, useCallback, useImperativeHandle, forwardRef, useState,
} from 'react';
import { View, StyleSheet } from 'react-native';
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

  /** Whether the WebView + PDF.js is fully ready */
  isReady: () => boolean;
}

interface Props {
  /** Default render scale (default 2.0 for good quality) */
  defaultScale?: number;
  /** Called when WebView + PDF.js is ready */
  onReady?: () => void;
}

// ─── PDF.js Renderer HTML ─────────────────────────────────
// Key features:
// - Loads PDF.js from CDN with error handling
// - Queues messages received before PDF.js is ready
// - Processes queued messages once ready
// - Handles load_pdf and render_page commands
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
var pdfJsReady = false;
var messageQueue = [];
var currentPdf = null;

// Listen for messages from React Native (both Android & iOS)
document.addEventListener('message', handleMsg);
window.addEventListener('message', handleMsg);

function handleMsg(event) {
  try {
    var msg = JSON.parse(event.data);

    if (!pdfJsReady) {
      // PDF.js not loaded yet — queue the message
      messageQueue.push(msg);
      return;
    }

    processMessage(msg);
  } catch(e) {
    sendToRN({ type: 'error', error: 'Parse error: ' + e.message });
  }
}

function processMessage(msg) {
  if (msg.type === 'load_pdf') {
    loadPdf(msg.base64);
  } else if (msg.type === 'render_page') {
    renderPage(msg.page, msg.scale);
  }
}

function processQueue() {
  while (messageQueue.length > 0) {
    var msg = messageQueue.shift();
    processMessage(msg);
  }
}

function sendToRN(obj) {
  try {
    window.ReactNativeWebView.postMessage(JSON.stringify(obj));
  } catch(e) {
    // WebView not available — ignore
  }
}

// Load PDF.js from CDN
var script = document.createElement('script');
script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';

script.onload = function() {
  try {
    pdfjsLib.GlobalWorkerOptions.workerSrc =
      'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
    pdfJsReady = true;
    sendToRN({ type: 'ready' });
    // Process any messages that arrived before PDF.js was ready
    processQueue();
  } catch(e) {
    sendToRN({ type: 'ready_error', error: 'PDF.js init failed: ' + e.message });
  }
};

script.onerror = function() {
  sendToRN({
    type: 'ready_error',
    error: 'Gagal memuat PDF.js dari CDN. Periksa koneksi internet Anda.'
  });
};

document.head.appendChild(script);

async function loadPdf(base64Data) {
  try {
    if (typeof pdfjsLib === 'undefined') {
      throw new Error('PDF.js belum dimuat. Periksa koneksi internet.');
    }

    var pdfData = atob(base64Data);
    var pdfArray = new Uint8Array(pdfData.length);
    for (var i = 0; i < pdfData.length; i++) {
      pdfArray[i] = pdfData.charCodeAt(i);
    }

    currentPdf = await pdfjsLib.getDocument({ data: pdfArray }).promise;

    sendToRN({
      type: 'pdf_loaded',
      totalPages: currentPdf.numPages
    });
  } catch(err) {
    currentPdf = null;
    sendToRN({
      type: 'pdf_load_error',
      error: err.message || 'Gagal memuat PDF'
    });
  }
}

async function renderPage(pageNum, scale) {
  try {
    if (!currentPdf) {
      throw new Error('PDF belum dimuat. Silakan muat ulang file.');
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

    sendToRN({
      type: 'page_rendered',
      success: true,
      base64: base64Png,
      page: pageNum,
      width: Math.round(viewport.width),
      height: Math.round(viewport.height),
      totalPages: currentPdf.numPages
    });
  } catch(err) {
    sendToRN({
      type: 'page_rendered',
      success: false,
      page: pageNum,
      error: err.message || 'Gagal render halaman'
    });
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
    const readyRef = useRef(false);

    // Promise resolvers for async operations
    const loadResolveRef = useRef<((pages: number) => void) | null>(null);
    const loadRejectRef = useRef<((err: Error) => void) | null>(null);
    const renderResolveRef = useRef<((uri: string) => void) | null>(null);
    const renderRejectRef = useRef<((err: Error) => void) | null>(null);
    const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const clearPendingTimeout = () => {
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
            readyRef.current = true;
            onReady?.();
            break;

          case 'ready_error':
            console.error('PDF.js load failed:', msg.error);
            readyRef.current = false;
            // Reject any pending operations with clear error
            if (loadRejectRef.current) {
              loadRejectRef.current(new Error(msg.error));
              loadResolveRef.current = null;
              loadRejectRef.current = null;
            }
            if (renderRejectRef.current) {
              renderRejectRef.current(new Error(msg.error));
              renderResolveRef.current = null;
              renderRejectRef.current = null;
            }
            clearPendingTimeout();
            break;

          case 'pdf_loaded':
            clearPendingTimeout();
            if (loadResolveRef.current) {
              loadResolveRef.current(msg.totalPages);
              loadResolveRef.current = null;
              loadRejectRef.current = null;
            }
            break;

          case 'pdf_load_error':
            clearPendingTimeout();
            if (loadRejectRef.current) {
              loadRejectRef.current(new Error(msg.error || 'Gagal memuat PDF'));
              loadResolveRef.current = null;
              loadRejectRef.current = null;
            }
            break;

          case 'page_rendered':
            clearPendingTimeout();
            if (msg.success && msg.base64) {
              try {
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
              } catch (saveErr: any) {
                if (renderRejectRef.current) {
                  renderRejectRef.current(
                    new Error('Gagal menyimpan gambar: ' + saveErr.message)
                  );
                  renderResolveRef.current = null;
                  renderRejectRef.current = null;
                }
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
            console.error('PdfConverter WebView error:', msg.error);
            break;
        }
      } catch (e: any) {
        console.error('PdfConverter handleMessage error:', e);
      }
    }, [onReady]);

    // Handle WebView load errors
    const handleWebViewError = useCallback((syntheticEvent: any) => {
      const { nativeEvent } = syntheticEvent;
      console.error('WebView load error:', nativeEvent);
      readyRef.current = false;

      // Reject any pending operations
      const error = new Error('WebView gagal dimuat. Coba restart aplikasi.');
      if (loadRejectRef.current) {
        loadRejectRef.current(error);
        loadResolveRef.current = null;
        loadRejectRef.current = null;
      }
      if (renderRejectRef.current) {
        renderRejectRef.current(error);
        renderResolveRef.current = null;
        renderRejectRef.current = null;
      }
      clearPendingTimeout();
    }, []);

    useImperativeHandle(ref, () => ({
      isReady: () => readyRef.current,

      loadPdf: async (pdfUri: string): Promise<number> => {
        if (!webViewRef.current) {
          throw new Error('PDF converter belum tersedia. Tunggu beberapa detik dan coba lagi.');
        }

        // Read PDF as base64
        let base64: string;
        try {
          base64 = await FileSystem.readAsStringAsync(pdfUri, {
            encoding: FileSystem.EncodingType.Base64,
          });
        } catch (readErr: any) {
          throw new Error('Gagal membaca file PDF: ' + (readErr.message || 'File tidak ditemukan'));
        }

        if (!base64 || base64.length === 0) {
          throw new Error('File PDF kosong atau rusak.');
        }

        return new Promise<number>((resolve, reject) => {
          // Cancel any pending load
          if (loadRejectRef.current) {
            loadRejectRef.current(new Error('Dibatalkan'));
          }
          clearPendingTimeout();

          loadResolveRef.current = resolve;
          loadRejectRef.current = reject;

          // Timeout 25s (extra time for CDN + large PDF)
          timeoutRef.current = setTimeout(() => {
            if (loadRejectRef.current) {
              loadRejectRef.current(
                new Error('Timeout memuat PDF. Pastikan koneksi internet stabil dan coba lagi.')
              );
              loadResolveRef.current = null;
              loadRejectRef.current = null;
            }
          }, 25000);

          // Send to WebView — messages are queued if PDF.js not ready yet
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
          throw new Error('PDF converter belum tersedia.');
        }

        return new Promise<string>((resolve, reject) => {
          // Cancel any pending render
          if (renderRejectRef.current) {
            renderRejectRef.current(new Error('Dibatalkan'));
          }
          clearPendingTimeout();

          renderResolveRef.current = resolve;
          renderRejectRef.current = reject;

          // Timeout 20s per page (complex pages may take longer)
          timeoutRef.current = setTimeout(() => {
            if (renderRejectRef.current) {
              renderRejectRef.current(
                new Error('Timeout render halaman. Halaman mungkin terlalu kompleks.')
              );
              renderResolveRef.current = null;
              renderRejectRef.current = null;
            }
          }, 20000);

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
          onError={handleWebViewError}
          onHttpError={handleWebViewError}
          javaScriptEnabled={true}
          domStorageEnabled={true}
          originWhitelist={['*']}
          style={styles.webview}
          cacheEnabled={true}
          startInLoadingState={false}
          androidLayerType="hardware"
          mixedContentMode="compatibility"
          collapsable={false}
          nestedScrollEnabled={false}
          // Prevent media playback (security)
          mediaPlaybackRequiresUserAction={true}
          // Allow file access for cache operations
          allowFileAccess={true}
        />
      </View>
    );
  }
);

PdfConverter.displayName = 'PdfConverter';
export default PdfConverter;

// ─── Styles ───────────────────────────────────────────────
// Position offscreen with real dimensions so Android renders the WebView
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
