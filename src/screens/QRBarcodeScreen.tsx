import React, { useState, useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import QRCode from 'react-native-qrcode-svg';

import Header from '../components/Header';
import PrintButton from '../components/PrintButton';
import PaperSettings from '../components/PaperSettings';
import AdBanner from '../components/AdBanner';
import { useApp } from '../contexts/AppContext';
import { COLORS, PAPER } from '../constants/theme';
import { pixelsToEscPos } from '../utils/escpos';

type CodeType = 'qr' | 'barcode';

export default function QRBarcodeScreen() {
  const { sendToPrinter, paperWidth, contrast } = useApp();
  const [codeType, setCodeType] = useState<CodeType>('qr');
  const [inputText, setInputText] = useState('');
  const qrRef = useRef<any>(null);

  const handlePrint = async () => {
    if (!inputText.trim()) throw new Error('Masukkan teks atau URL terlebih dahulu!');
    
    const targetWidth = PAPER[paperWidth].widthPx;
    
    if (codeType === 'qr') {
      // Get QR code as pixel data
      await printQRCode(targetWidth);
    } else {
      // Get barcode as pixel data
      await printBarcode(targetWidth);
    }
  };

  const printQRCode = async (targetWidth: number) => {
    // Use ESC/POS native QR code command — much better quality than raster
    const escpos = generateEscPosQR(inputText, targetWidth);
    await sendToPrinter(escpos);
  };

  const printBarcode = async (targetWidth: number) => {
    // Use ESC/POS native barcode command
    const escpos = generateEscPosBarcode(inputText, targetWidth);
    await sendToPrinter(escpos);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Header />
      <ScrollView style={styles.content} contentContainerStyle={styles.contentInner}>
        {/* Type Switcher */}
        <View style={styles.typeSwitch}>
          <TouchableOpacity
            style={[styles.typeBtn, codeType === 'qr' && styles.typeBtnActive]}
            onPress={() => setCodeType('qr')}
          >
            <Ionicons name="qr-code" size={16} color={codeType === 'qr' ? COLORS.white : COLORS.textMuted} />
            <Text style={[styles.typeBtnText, codeType === 'qr' && styles.typeBtnTextActive]}>QR CODE</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.typeBtn, codeType === 'barcode' && styles.typeBtnActive]}
            onPress={() => setCodeType('barcode')}
          >
            <Ionicons name="barcode" size={16} color={codeType === 'barcode' ? COLORS.white : COLORS.textMuted} />
            <Text style={[styles.typeBtnText, codeType === 'barcode' && styles.typeBtnTextActive]}>BARCODE</Text>
          </TouchableOpacity>
        </View>

        {/* Input */}
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            placeholder={codeType === 'qr' ? 'Masukkan URL atau Teks' : 'Masukkan kode (angka/huruf)'}
            placeholderTextColor={COLORS.textMuted}
            value={inputText}
            onChangeText={setInputText}
            autoCapitalize="none"
          />
        </View>

        {/* Preview */}
        {inputText.trim().length > 0 && (
          <View style={styles.previewContainer}>
            <Text style={styles.previewTitle}>Preview</Text>
            <View style={[styles.previewBox, { width: paperWidth === 58 ? 220 : 300 }]}>
              {codeType === 'qr' ? (
                <View style={styles.qrWrapper}>
                  <QRCode
                    value={inputText}
                    size={150}
                    color={COLORS.black}
                    backgroundColor={COLORS.white}
                    getRef={(ref: any) => (qrRef.current = ref)}
                  />
                </View>
              ) : (
                <View style={styles.barcodeWrapper}>
                  {/* Simple barcode visual representation */}
                  <View style={styles.barcodeLines}>
                    {inputText.split('').map((char, i) => (
                      <View
                        key={i}
                        style={[
                          styles.barcodeLine,
                          { width: (char.charCodeAt(0) % 3) + 1, marginRight: 1 },
                        ]}
                      />
                    ))}
                  </View>
                  <Text style={styles.barcodeText}>{inputText}</Text>
                </View>
              )}
            </View>
          </View>
        )}

        <PaperSettings />
        <PrintButton onPrint={handlePrint} />
      </ScrollView>
      <AdBanner />
    </SafeAreaView>
  );
}

/**
 * Generate ESC/POS native QR code commands.
 * Much better quality than raster image.
 */
function generateEscPosQR(text: string, _width: number): Uint8Array {
  const encoder = new TextEncoder();
  const textBytes = encoder.encode(text);
  const textLen = textBytes.length;
  
  const commands: number[] = [];
  
  // ESC @ — Initialize
  commands.push(0x1b, 0x40);
  
  // Center align
  commands.push(0x1b, 0x61, 0x01);
  
  // GS ( k — QR Code commands (function 165-181)
  // Set QR model: Model 2
  commands.push(0x1d, 0x28, 0x6b, 0x04, 0x00, 0x31, 0x41, 0x32, 0x00);
  
  // Set QR size (module size 6)
  commands.push(0x1d, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x43, 0x06);
  
  // Set error correction level (Level H)
  commands.push(0x1d, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x45, 0x33);
  
  // Store QR data
  const storeLen = textLen + 3;
  commands.push(0x1d, 0x28, 0x6b,
    storeLen & 0xff, (storeLen >> 8) & 0xff,
    0x31, 0x50, 0x30);
  for (const b of textBytes) commands.push(b);
  
  // Print QR
  commands.push(0x1d, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x51, 0x30);
  
  // Feed + cut
  commands.push(0x0a, 0x0a, 0x0a, 0x1d, 0x56, 0x41, 0x03);
  
  return new Uint8Array(commands);
}

/**
 * Generate ESC/POS native barcode commands (CODE128).
 */
function generateEscPosBarcode(text: string, _width: number): Uint8Array {
  const encoder = new TextEncoder();
  const textBytes = encoder.encode(text);
  
  const commands: number[] = [];
  
  // ESC @ — Initialize
  commands.push(0x1b, 0x40);
  
  // Center align
  commands.push(0x1b, 0x61, 0x01);
  
  // Set barcode height (100 dots)
  commands.push(0x1d, 0x68, 0x64);
  
  // Set barcode width (3)
  commands.push(0x1d, 0x77, 0x03);
  
  // Set HRI position (below barcode)
  commands.push(0x1d, 0x48, 0x02);
  
  // Set HRI font (Font A)
  commands.push(0x1d, 0x66, 0x00);
  
  // Print barcode: GS k m n [data] — CODE128 (type 73)
  commands.push(0x1d, 0x6b, 0x49, textBytes.length);
  for (const b of textBytes) commands.push(b);
  
  // Feed + cut
  commands.push(0x0a, 0x0a, 0x0a, 0x1d, 0x56, 0x41, 0x03);
  
  return new Uint8Array(commands);
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bgDark },
  content: { flex: 1 },
  contentInner: { paddingBottom: 20 },
  typeSwitch: {
    flexDirection: 'row',
    marginHorizontal: 20,
    marginTop: 12,
    marginBottom: 12,
    backgroundColor: 'rgba(0,0,0,0.4)',
    borderRadius: 14,
    padding: 5,
    gap: 5,
  },
  typeBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 10,
  },
  typeBtnActive: { backgroundColor: COLORS.primary },
  typeBtnText: { fontSize: 11, fontWeight: '700', color: COLORS.textMuted },
  typeBtnTextActive: { color: COLORS.white },
  inputContainer: { marginHorizontal: 20, marginBottom: 16 },
  input: {
    backgroundColor: COLORS.bgCard,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.bgCardBorder,
    padding: 16,
    color: COLORS.white,
    fontSize: 14,
    textAlign: 'center',
  },
  previewContainer: { marginHorizontal: 20, marginBottom: 16, alignItems: 'center' },
  previewTitle: { fontSize: 12, fontWeight: '700', color: COLORS.textSecondary, marginBottom: 8, textTransform: 'uppercase', alignSelf: 'flex-start' },
  previewBox: {
    backgroundColor: COLORS.white,
    borderRadius: 8,
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 200,
  },
  qrWrapper: { padding: 10 },
  barcodeWrapper: { alignItems: 'center', gap: 10 },
  barcodeLines: { flexDirection: 'row', height: 70, alignItems: 'stretch' },
  barcodeLine: { backgroundColor: COLORS.black, height: '100%' },
  barcodeText: { fontFamily: 'monospace', fontSize: 12, color: COLORS.black },
});
