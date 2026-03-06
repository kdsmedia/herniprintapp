/**
 * PdfCapture — Hidden PDF renderer that converts PDF pages to images
 *
 * Renders PDF off-screen using react-native-pdf, captures with
 * react-native-view-shot's captureRef, then returns the image URI
 * for thermal printing pipeline.
 */
import React, { useRef, useState, useCallback, useImperativeHandle, forwardRef } from 'react';
import { View, StyleSheet, findNodeHandle } from 'react-native';
import Pdf from 'react-native-pdf';
import { captureRef } from 'react-native-view-shot';

export interface PdfCaptureRef {
  /** Convert a PDF page to an image. Returns the captured image URI. */
  capture: (pdfUri: string, page?: number) => Promise<string>;
}

interface Props {
  /** Width in pixels to render the PDF (match printer dots: 384 or 576) */
  renderWidth: number;
}

const PdfCapture = forwardRef<PdfCaptureRef, Props>(({ renderWidth }, ref) => {
  const containerRef = useRef<View>(null);
  const [pdfSource, setPdfSource] = useState<{ uri: string } | null>(null);
  const [targetPage, setTargetPage] = useState(1);
  const resolveRef = useRef<((uri: string) => void) | null>(null);
  const rejectRef = useRef<((err: Error) => void) | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Render height proportional to A4 ratio (1:1.414)
  const renderHeight = Math.round(renderWidth * 1.414);

  const handleLoadComplete = useCallback(async (_numberOfPages: number) => {
    // Give PDF a moment to fully render after load callback
    await new Promise(r => setTimeout(r, 800));

    try {
      if (containerRef.current) {
        const uri = await captureRef(containerRef, {
          format: 'png',
          quality: 1.0,
          result: 'tmpfile',
        });
        if (resolveRef.current) {
          resolveRef.current(uri);
          resolveRef.current = null;
          rejectRef.current = null;
        }
      } else {
        throw new Error('Container ref not available');
      }
    } catch (e: any) {
      if (rejectRef.current) {
        rejectRef.current(new Error('Gagal capture PDF: ' + e.message));
        resolveRef.current = null;
        rejectRef.current = null;
      }
    } finally {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      // Clean up - hide PDF after capture
      setTimeout(() => setPdfSource(null), 100);
    }
  }, []);

  const handleError = useCallback((error: any) => {
    if (rejectRef.current) {
      rejectRef.current(new Error('Gagal memuat PDF: ' + (error?.message || 'unknown error')));
      resolveRef.current = null;
      rejectRef.current = null;
    }
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setPdfSource(null);
  }, []);

  useImperativeHandle(ref, () => ({
    capture: (pdfUri: string, page: number = 1) => {
      return new Promise<string>((resolve, reject) => {
        // Clean up any pending operation
        if (rejectRef.current) {
          rejectRef.current(new Error('Dibatalkan'));
        }
        if (timeoutRef.current) clearTimeout(timeoutRef.current);

        resolveRef.current = resolve;
        rejectRef.current = reject;

        // Timeout after 15 seconds
        timeoutRef.current = setTimeout(() => {
          if (rejectRef.current) {
            rejectRef.current(new Error('Timeout: PDF terlalu lama dimuat'));
            resolveRef.current = null;
            rejectRef.current = null;
          }
          setPdfSource(null);
        }, 15000);

        setTargetPage(page);
        setPdfSource({ uri: pdfUri });
      });
    },
  }));

  if (!pdfSource) return null;

  return (
    <View style={styles.offscreen} pointerEvents="none" collapsable={false}>
      <View
        ref={containerRef}
        collapsable={false}
        style={{ width: renderWidth, height: renderHeight, backgroundColor: '#fff' }}
      >
        <Pdf
          source={pdfSource}
          page={targetPage}
          singlePage={true}
          fitPolicy={0}
          style={{ flex: 1, backgroundColor: '#fff' }}
          onLoadComplete={handleLoadComplete}
          onError={handleError}
          enablePaging={false}
          horizontal={false}
        />
      </View>
    </View>
  );
});

PdfCapture.displayName = 'PdfCapture';

export default PdfCapture;

const styles = StyleSheet.create({
  // Use opacity near-zero + collapsable=false to ensure Android
  // actually renders the native PDF view (fully offscreen views
  // may be optimized away and never draw their content).
  offscreen: {
    position: 'absolute',
    left: 0,
    top: 0,
    opacity: 0.01,
    zIndex: -1,
  },
});
