/**
 * PdfConverter — Converts PDF pages to images using WebView + PDF.js
 *
 * How it works:
 * 1. PDF file is read as base64
 * 2. Passed to a hidden WebView running Mozilla's pdf.js
 * 3. pdf.js renders the page to a <canvas>
 * 4. Canvas is exported as base64 PNG
 * 5. Returned to React Native via postMessage
 * 6. Saved to cache as a file
 *
 * Much more reliable than react-native-pdf + react-native-view-shot
 */
import React, { useRef, useCallback, useImperativeHandle, forwardRef, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { WebView, WebViewMessageEvent } from 'react-native-webview';
import * as FileSystem from 'expo-file-system';

export interface PdfConverterRef {
  convert: (pdfUri: string, page?: number, scale?: number) => Promise<string>;
}

interface Props {
  /** Scale factor for rendering (default 2.0 for good quality) */
  defaultScale?: number;
}

// HTML page with pdf.js that renders PDF to canvas
const PDF_RENDERER_HTML = `
<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<script src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js"></script>
<style>
  * { margin: 0; padding: 0; }
  body { background: white; }
  canvas { display: block; }
</style>
</head>
<body>
<canvas id="canvas"></canvas>
<script>
  pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

  window.addEventListener('message', async function(event) {
    try {
      const msg = JSON.parse(event.data);
      if (msg.type !== 'render') return;

      const pdfData = atob(msg.base64);
      const pdfArray = new Uint8Array(pdfData.length);
      for (let i = 0; i < pdfData.length; i++) {
        pdfArray[i] = pdfData.charCodeAt(i);
      }

      const pdf = await pdfjsLib.getDocument({ data: pdfArray }).promise;
      const page = await pdf.getPage(msg.page || 1);
      const scale = msg.scale || 2.0;
      const viewport = page.getViewport({ scale: scale });

      const canvas = document.getElementById('canvas');
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const ctx = canvas.getContext('2d');

      // White background
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      await page.render({ canvasContext: ctx, viewport: viewport }).promise;

      // Export as PNG base64
      const dataUrl = canvas.toDataURL('image/png');
      const base64Png = dataUrl.split(',')[1];

      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'result',
        success: true,
        base64: base64Png,
        width: Math.round(viewport.width),
        height: Math.round(viewport.height),
        totalPages: pdf.numPages,
      }));
    } catch (err) {
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'result',
        success: false,
        error: err.message || 'Unknown error',
      }));
    }
  });

  // Signal ready
  window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'ready' }));
</script>
</body>
</html>
`;

const PdfConverter = forwardRef<PdfConverterRef, Props>(({ defaultScale = 2.0 }, ref) => {
  const webViewRef = useRef<WebView>(null);
  const [ready, setReady] = useState(false);
  const resolveRef = useRef<((uri: string) => void) | null>(null);
  const rejectRef = useRef<((err: Error) => void) | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleMessage = useCallback(async (event: WebViewMessageEvent) => {
    try {
      const msg = JSON.parse(event.nativeEvent.data);

      if (msg.type === 'ready') {
        setReady(true);
        return;
      }

      if (msg.type === 'result') {
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
          timeoutRef.current = null;
        }

        if (msg.success && msg.base64) {
          // Save base64 PNG to cache file
          const filename = `pdf_converted_${Date.now()}.png`;
          const filePath = `${FileSystem.cacheDirectory}${filename}`;
          await FileSystem.writeAsStringAsync(filePath, msg.base64, {
            encoding: FileSystem.EncodingType.Base64,
          });

          if (resolveRef.current) {
            resolveRef.current(filePath);
            resolveRef.current = null;
            rejectRef.current = null;
          }
        } else {
          if (rejectRef.current) {
            rejectRef.current(new Error(msg.error || 'Konversi PDF gagal'));
            resolveRef.current = null;
            rejectRef.current = null;
          }
        }
      }
    } catch (e: any) {
      if (rejectRef.current) {
        rejectRef.current(new Error('Parse error: ' + e.message));
        resolveRef.current = null;
        rejectRef.current = null;
      }
    }
  }, []);

  useImperativeHandle(ref, () => ({
    convert: async (pdfUri: string, page: number = 1, scale?: number) => {
      // Read PDF file as base64
      const base64 = await FileSystem.readAsStringAsync(pdfUri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      return new Promise<string>((resolve, reject) => {
        // Cancel any pending operation
        if (rejectRef.current) {
          rejectRef.current(new Error('Dibatalkan'));
        }
        if (timeoutRef.current) clearTimeout(timeoutRef.current);

        resolveRef.current = resolve;
        rejectRef.current = reject;

        // Timeout after 20 seconds
        timeoutRef.current = setTimeout(() => {
          if (rejectRef.current) {
            rejectRef.current(new Error('Timeout: PDF terlalu besar atau koneksi lambat'));
            resolveRef.current = null;
            rejectRef.current = null;
          }
        }, 20000);

        // Send PDF data to WebView
        const message = JSON.stringify({
          type: 'render',
          base64,
          page,
          scale: scale || defaultScale,
        });

        if (webViewRef.current) {
          webViewRef.current.postMessage(message);
        } else {
          reject(new Error('WebView tidak tersedia'));
        }
      });
    },
  }));

  return (
    <View style={styles.container} pointerEvents="none">
      <WebView
        ref={webViewRef}
        source={{ html: PDF_RENDERER_HTML }}
        onMessage={handleMessage}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        originWhitelist={['*']}
        style={styles.webview}
        // Performance
        cacheEnabled={true}
        startInLoadingState={false}
        // Don't show anything
        androidLayerType="hardware"
      />
    </View>
  );
});

PdfConverter.displayName = 'PdfConverter';

export default PdfConverter;

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    width: 1,
    height: 1,
    opacity: 0,
    overflow: 'hidden',
  },
  webview: {
    width: 1,
    height: 1,
    opacity: 0,
  },
});
