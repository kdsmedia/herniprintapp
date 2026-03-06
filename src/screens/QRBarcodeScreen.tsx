import React, { useState, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import QRCode from 'react-native-qrcode-svg';

import Header from '../components/Header';
import ConnectionModal from '../components/ConnectionModal';
import AdBanner from '../components/AdBanner';
import { useApp } from '../contexts/AppContext';
import { COLORS, PAPER } from '../constants/theme';
import { generateEscPosQR, generateEscPosBarcode } from '../utils/escpos';

type CodeType = 'qr' | 'barcode';

export default function QRBarcodeScreen() {
  const { sendToPrinter, paperWidth, isConnected } = useApp();
  const [codeType, setCodeType] = useState<CodeType>('qr');
  const [inputText, setInputText] = useState('');
  const [printing, setPrinting] = useState(false);
  const [connModal, setConnModal] = useState(false);

  const handlePrint = async () => {
    if (!inputText.trim()) return Alert.alert('Input Kosong', 'Masukkan teks atau URL terlebih dahulu.');
    if (!isConnected) return setConnModal(true);

    setPrinting(true);
    try {
      const targetWidth = PAPER[paperWidth].dots;
      let escpos: Uint8Array;

      if (codeType === 'qr') {
        escpos = generateEscPosQR(inputText, targetWidth);
      } else {
        escpos = generateEscPosBarcode(inputText, targetWidth);
      }

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
        {/* Form Card */}
        <View style={styles.formCard}>
          {/* Type Switcher */}
          <View style={styles.typeRow}>
            <TouchableOpacity
              style={[styles.typeBtn, codeType === 'qr' && styles.typeBtnActive]}
              onPress={() => setCodeType('qr')}
            >
              <Text style={[styles.typeBtnText, codeType === 'qr' && styles.typeBtnTextActive]}>QR CODE</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.typeBtn, codeType === 'barcode' && styles.typeBtnActive]}
              onPress={() => setCodeType('barcode')}
            >
              <Text style={[styles.typeBtnText, codeType === 'barcode' && styles.typeBtnTextActive]}>BARCODE</Text>
            </TouchableOpacity>
          </View>

          <TextInput
            style={styles.input}
            placeholder="Masukkan Teks atau URL"
            placeholderTextColor="#64748b"
            value={inputText}
            onChangeText={setInputText}
            textAlign="center"
          />
        </View>

        {/* Preview */}
        <View style={styles.previewArea}>
          <View style={[styles.paper, paperWidth === 80 && styles.paper80]}>
            {inputText.trim() ? (
              <View style={styles.codePreview}>
                {codeType === 'qr' ? (
                  <QRCode value={inputText} size={150} backgroundColor="white" color="black" />
                ) : (
                  <View style={styles.barcodePreview}>
                    <View style={styles.barcodeLines}>
                      {inputText.split('').map((char, i) => (
                        <View
                          key={i}
                          style={[
                            styles.barcodeLine,
                            { width: (char.charCodeAt(0) % 3) + 1 },
                          ]}
                        />
                      ))}
                    </View>
                    <Text style={styles.barcodeText}>{inputText}</Text>
                  </View>
                )}
              </View>
            ) : (
              <View style={styles.emptyPreview}>
                <Ionicons name="print" size={36} color="rgba(0,0,0,0.15)" />
                <Text style={styles.emptyText}>Siap Mencetak</Text>
              </View>
            )}
            <View style={styles.paperEdge} />
          </View>
        </View>
      </ScrollView>

      <TouchableOpacity
        style={[styles.printFab, printing && styles.printFabDisabled]}
        onPress={handlePrint} disabled={printing} activeOpacity={0.8}
      >
        <Ionicons name={printing ? 'sync' : 'flash'} size={28} color={COLORS.white} />
      </TouchableOpacity>

      <AdBanner />
      <ConnectionModal visible={connModal} onClose={() => setConnModal(false)} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bgDark },
  content: { flex: 1 },
  contentInner: { paddingBottom: 100 },

  formCard: {
    marginHorizontal: 16, marginTop: 8,
    backgroundColor: COLORS.bgCard, borderRadius: 24,
    borderWidth: 1, borderColor: COLORS.bgCardBorder, padding: 16, gap: 12,
  },
  typeRow: {
    flexDirection: 'row', backgroundColor: 'rgba(0,0,0,0.4)',
    borderRadius: 16, padding: 5, gap: 6,
  },
  typeBtn: { flex: 1, paddingVertical: 10, borderRadius: 12, alignItems: 'center' },
  typeBtnActive: { backgroundColor: COLORS.primary, elevation: 6 },
  typeBtnText: { fontSize: 11, fontWeight: '700', color: COLORS.textMuted },
  typeBtnTextActive: { color: COLORS.white },

  input: {
    backgroundColor: 'rgba(0,0,0,0.3)', borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)', borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 12,
    color: COLORS.white, fontSize: 12,
  },

  previewArea: {
    alignItems: 'center', marginTop: 20,
    backgroundColor: 'rgba(0,0,0,0.3)', borderRadius: 28,
    marginHorizontal: 16, padding: 24, minHeight: 250,
  },
  paper: {
    width: 220, backgroundColor: COLORS.white,
    borderRadius: 2, padding: 16, minHeight: 150,
    elevation: 10, alignItems: 'center',
  },
  paper80: { width: 300 },
  paperEdge: {
    position: 'absolute', bottom: -6, left: 0, right: 0, height: 6,
    backgroundColor: COLORS.white,
  },
  codePreview: { alignItems: 'center', paddingVertical: 20 },
  barcodePreview: { alignItems: 'center', gap: 8 },
  barcodeLines: { flexDirection: 'row', height: 60, alignItems: 'stretch', gap: 1 },
  barcodeLine: { backgroundColor: '#000', marginRight: 1 },
  barcodeText: { fontSize: 10, fontWeight: '600', color: '#000' },
  emptyPreview: { alignItems: 'center', paddingVertical: 40, gap: 8 },
  emptyText: { fontSize: 9, fontWeight: '700', color: 'rgba(0,0,0,0.2)', textTransform: 'uppercase', letterSpacing: 2 },

  printFab: {
    position: 'absolute', bottom: 60, alignSelf: 'center',
    width: 70, height: 70, borderRadius: 35,
    backgroundColor: COLORS.primary,
    alignItems: 'center', justifyContent: 'center',
    elevation: 15,
    shadowColor: COLORS.primary, shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.4, shadowRadius: 20,
  },
  printFabDisabled: { opacity: 0.5 },
});
