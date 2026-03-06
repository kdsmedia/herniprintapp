import React, { useState, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, Alert, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import QRCode from 'react-native-qrcode-svg';

import Header from '../components/Header';
import ConnectionModal from '../components/ConnectionModal';
import AdBanner from '../components/AdBanner';
import { useApp } from '../contexts/AppContext';
import { COLORS, PAPER } from '../constants/theme';
import { CMD } from '../utils/escpos';

type CodeType = 'qr' | 'barcode';

// Generate ESC/POS native QR code command
function generateEscPosQR(text: string, paperDots: number): Uint8Array {
  const textBytes = Array.from(new TextEncoder().encode(text));
  const store = textBytes.length + 3;
  const cmds: number[] = [
    ...CMD.INIT,
    ...CMD.CENTER,
    // GS ( k - QR Code
    0x1D, 0x28, 0x6B, 0x03, 0x00, 0x31, 0x43, 0x06, // model size 6
    0x1D, 0x28, 0x6B, 0x03, 0x00, 0x31, 0x45, 0x31, // error correction L
    0x1D, 0x28, 0x6B, store & 0xFF, (store >> 8) & 0xFF, 0x31, 0x50, 0x30, ...textBytes,
    0x1D, 0x28, 0x6B, 0x03, 0x00, 0x31, 0x51, 0x30, // print QR
    0x0A, 0x0A,
    ...CMD.LEFT,
    ...Array.from(new TextEncoder().encode(text.substring(0, PAPER[paperDots === 384 ? 58 : 80].chars))),
    0x0A, 0x0A, 0x0A,
    ...CMD.CUT,
  ];
  return new Uint8Array(cmds);
}

// Generate ESC/POS native barcode command (CODE128)
function generateEscPosBarcode(text: string, paperDots: number): Uint8Array {
  const textBytes = Array.from(new TextEncoder().encode(text));
  const cmds: number[] = [
    ...CMD.INIT,
    ...CMD.CENTER,
    0x1D, 0x68, 0x50,       // barcode height = 80
    0x1D, 0x77, 0x02,       // barcode width = 2
    0x1D, 0x48, 0x02,       // HRI below barcode
    0x1D, 0x6B, 0x49, textBytes.length, ...textBytes, // CODE128
    0x0A, 0x0A, 0x0A,
    ...CMD.CUT,
  ];
  return new Uint8Array(cmds);
}

export default function QRBarcodeScreen() {
  const { paperWidth, sendToPrinter, isConnected } = useApp();
  const [codeType, setCodeType] = useState<CodeType>('qr');
  const [inputText, setInputText] = useState('');
  const [printing, setPrinting] = useState(false);
  const [connModal, setConnModal] = useState(false);
  const qrRef = useRef<any>(null);

  const handlePrint = async () => {
    if (!inputText.trim()) return Alert.alert('Info', 'Masukkan teks atau URL.');
    if (!isConnected) return setConnModal(true);

    setPrinting(true);
    try {
      const targetWidth = PAPER[paperWidth].dots;
      const escpos = codeType === 'qr'
        ? generateEscPosQR(inputText, targetWidth)
        : generateEscPosBarcode(inputText, targetWidth);
      await sendToPrinter(escpos);
      Alert.alert('Berhasil ✅', `${codeType === 'qr' ? 'QR Code' : 'Barcode'} berhasil dicetak!`);
    } catch (e: any) {
      Alert.alert('Gagal Cetak', e.message);
    } finally {
      setPrinting(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Header onConnectionPress={() => setConnModal(true)} />
      <ScrollView style={styles.content} contentContainerStyle={styles.contentInner}>
        {/* Type Switcher */}
        <View style={styles.switchCard}>
          <View style={styles.switchRow}>
            <TouchableOpacity
              style={[styles.switchBtn, codeType === 'qr' && styles.switchBtnActive]}
              onPress={() => setCodeType('qr')}
            >
              <Text style={[styles.switchBtnText, codeType === 'qr' && styles.switchBtnTextActive]}>QR CODE</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.switchBtn, codeType === 'barcode' && styles.switchBtnActive]}
              onPress={() => setCodeType('barcode')}
            >
              <Text style={[styles.switchBtnText, codeType === 'barcode' && styles.switchBtnTextActive]}>BARCODE</Text>
            </TouchableOpacity>
          </View>
          <TextInput
            style={styles.input}
            placeholder="Masukkan Teks atau URL"
            placeholderTextColor={COLORS.textMuted}
            value={inputText}
            onChangeText={setInputText}
            textAlign="center"
          />
        </View>

        {/* Preview */}
        <View style={styles.previewContainer}>
          <View style={[styles.paperPreview, paperWidth === 80 && styles.paper80]}>
            {inputText.trim() ? (
              <View style={styles.codePreview}>
                {codeType === 'qr' ? (
                  <QRCode ref={qrRef} value={inputText || ' '} size={150} backgroundColor="white" color="black" />
                ) : (
                  <View style={styles.barcodePreview}>
                    {inputText.split('').map((char, i) => (
                      <View
                        key={i}
                        style={{
                          width: (char.charCodeAt(0) % 3) + 1,
                          height: 60,
                          backgroundColor: '#000',
                          marginRight: 1,
                        }}
                      />
                    ))}
                  </View>
                )}
                <Text style={styles.codeText}>{inputText}</Text>
              </View>
            ) : (
              <>
                <Ionicons name="qr-code" size={36} color="rgba(0,0,0,0.15)" />
                <Text style={styles.emptyText}>Siap Mencetak</Text>
              </>
            )}
            <View style={styles.paperEdge} />
          </View>
        </View>
      </ScrollView>

      {/* FAB */}
      <View style={styles.fabContainer}>
        <TouchableOpacity style={styles.fab} onPress={handlePrint} disabled={printing} activeOpacity={0.8}>
          {printing ? <ActivityIndicator size="large" color={COLORS.white} /> : <Ionicons name="flash" size={30} color={COLORS.white} />}
        </TouchableOpacity>
      </View>

      <AdBanner />
      <ConnectionModal visible={connModal} onClose={() => setConnModal(false)} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bgDark },
  content: { flex: 1 },
  contentInner: { paddingBottom: 100 },
  switchCard: {
    marginHorizontal: 16, marginTop: 8,
    backgroundColor: COLORS.bgCard, borderRadius: 24,
    borderWidth: 1, borderColor: COLORS.bgCardBorder, padding: 16, gap: 12,
  },
  switchRow: {
    flexDirection: 'row', gap: 8,
    backgroundColor: 'rgba(0,0,0,0.4)', borderRadius: 16, padding: 4,
  },
  switchBtn: { flex: 1, paddingVertical: 10, borderRadius: 12, alignItems: 'center' },
  switchBtnActive: { backgroundColor: COLORS.primary, elevation: 4 },
  switchBtnText: { fontSize: 11, fontWeight: '800', color: COLORS.textMuted },
  switchBtnTextActive: { color: COLORS.white },
  input: {
    backgroundColor: 'rgba(0,0,0,0.3)', borderRadius: 12,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
    padding: 14, color: COLORS.white, fontSize: 13,
  },
  previewContainer: {
    marginHorizontal: 16, marginTop: 20,
    backgroundColor: 'rgba(0,0,0,0.3)', borderRadius: 32, padding: 24,
    alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)',
    minHeight: 280, justifyContent: 'center',
  },
  paperPreview: {
    width: 220, backgroundColor: COLORS.white, borderRadius: 2,
    padding: 16, alignItems: 'center', justifyContent: 'center',
    minHeight: 200, elevation: 10,
  },
  paper80: { width: 300 },
  paperEdge: { position: 'absolute', bottom: -6, left: 0, right: 0, height: 6, backgroundColor: COLORS.white },
  codePreview: { alignItems: 'center', gap: 10, padding: 10 },
  barcodePreview: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  codeText: { fontSize: 10, fontWeight: '600', color: '#333', textAlign: 'center' },
  emptyText: { fontSize: 9, fontWeight: '700', color: 'rgba(0,0,0,0.2)', textTransform: 'uppercase', letterSpacing: 3, marginTop: 8 },
  fabContainer: { position: 'absolute', bottom: 80, alignSelf: 'center', zIndex: 50 },
  fab: {
    width: 70, height: 70, borderRadius: 35, backgroundColor: COLORS.primary,
    alignItems: 'center', justifyContent: 'center', elevation: 15,
    shadowColor: COLORS.primary, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.5, shadowRadius: 20,
  },
});
