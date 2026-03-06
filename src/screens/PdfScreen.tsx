import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, Image, ScrollView, StyleSheet, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import { SafeAreaView } from 'react-native-safe-area-context';

import Header from '../components/Header';
import ConnectionModal from '../components/ConnectionModal';
import AdBanner from '../components/AdBanner';
import { useApp } from '../contexts/AppContext';
import { COLORS, PAPER } from '../constants/theme';
import { processImageForPrint } from '../utils/imageProcessor';
import { pixelsToEscPos } from '../utils/escpos';

export default function PdfScreen() {
  const { sendToPrinter, paperWidth, contrast, isConnected } = useApp();
  const [fileUri, setFileUri] = useState<string | null>(null);
  const [fileName, setFileName] = useState('');
  const [printing, setPrinting] = useState(false);
  const [connModal, setConnModal] = useState(false);

  const pickDocument = async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: ['application/pdf', 'image/*'],
      copyToCacheDirectory: true,
    });
    if (!result.canceled && result.assets[0]) {
      setFileUri(result.assets[0].uri);
      setFileName(result.assets[0].name || 'dokumen');
    }
  };

  const handlePrint = async () => {
    if (!fileUri) return Alert.alert('Pilih File', 'Unggah dokumen terlebih dahulu.');
    if (!isConnected) return setConnModal(true);

    setPrinting(true);
    try {
      const targetWidth = PAPER[paperWidth].dots;
      const { pixels, width, height } = await processImageForPrint(fileUri, targetWidth);
      const escpos = pixelsToEscPos(pixels, width, height, contrast);
      await sendToPrinter(escpos);
      Alert.alert('Berhasil ✅', 'Dokumen berhasil dicetak!');
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
        <TouchableOpacity style={styles.uploadBox} onPress={pickDocument} activeOpacity={0.8}>
          <Ionicons name="document-text" size={40} color="#ef4444" />
          <Text style={styles.uploadTitle}>Unggah Dokumen PDF</Text>
          <Text style={styles.uploadSub}>Halaman pertama akan otomatis dikonversi</Text>
        </TouchableOpacity>

        {fileName ? (
          <View style={styles.fileInfo}>
            <Ionicons name="document-text" size={16} color="#ef4444" />
            <Text style={styles.fileName} numberOfLines={1}>{fileName}</Text>
            <TouchableOpacity onPress={() => { setFileUri(null); setFileName(''); }}>
              <Ionicons name="close-circle" size={18} color={COLORS.error} />
            </TouchableOpacity>
          </View>
        ) : null}

        <View style={styles.previewArea}>
          <View style={[styles.paper, paperWidth === 80 && styles.paper80]}>
            {fileUri ? (
              <View style={styles.pdfPlaceholder}>
                <Ionicons name="document-text" size={48} color="#ef4444" />
                <Text style={styles.pdfName}>{fileName}</Text>
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
        onPress={handlePrint}
        disabled={printing}
        activeOpacity={0.8}
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

  uploadBox: {
    marginHorizontal: 16, marginTop: 8,
    backgroundColor: COLORS.bgCard,
    borderRadius: 24, borderWidth: 2, borderStyle: 'dashed',
    borderColor: 'rgba(239,68,68,0.3)',
    padding: 32, alignItems: 'center', gap: 8,
  },
  uploadTitle: { fontSize: 13, fontWeight: '700', color: COLORS.white },
  uploadSub: { fontSize: 10, color: 'rgba(255,255,255,0.4)' },

  fileInfo: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    marginHorizontal: 16, marginTop: 10,
    backgroundColor: 'rgba(239,68,68,0.15)',
    borderRadius: 12, padding: 12,
  },
  fileName: { flex: 1, fontSize: 12, fontWeight: '600', color: COLORS.white },

  previewArea: {
    flex: 1, alignItems: 'center', marginTop: 20,
    backgroundColor: 'rgba(0,0,0,0.3)', borderRadius: 28,
    marginHorizontal: 16, padding: 24, minHeight: 250,
  },
  paper: {
    width: 220, backgroundColor: COLORS.white,
    borderRadius: 2, padding: 16, minHeight: 150,
    elevation: 10,
  },
  paper80: { width: 300 },
  paperEdge: {
    position: 'absolute', bottom: -6, left: 0, right: 0, height: 6,
    backgroundColor: COLORS.white,
  },
  pdfPlaceholder: { alignItems: 'center', paddingVertical: 30, gap: 8 },
  pdfName: { fontSize: 10, fontWeight: '600', color: '#333', textAlign: 'center' },
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
