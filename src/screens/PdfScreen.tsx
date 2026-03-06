import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, StyleSheet, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import * as Print from 'expo-print';
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
  const [isPdf, setIsPdf] = useState(false);
  const [printing, setPrinting] = useState(false);
  const [connModal, setConnModal] = useState(false);

  const pickDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'image/*'],
        copyToCacheDirectory: true,
      });
      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        const pdf = asset.mimeType?.includes('pdf') || asset.name?.toLowerCase().endsWith('.pdf');
        setFileUri(asset.uri);
        setFileName(asset.name || 'dokumen');
        setIsPdf(!!pdf);
      }
    } catch (e: any) {
      Alert.alert('Error', 'Gagal memilih file: ' + e.message);
    }
  };

  // Cetak ke printer thermal (BLE) — hanya untuk gambar
  const printThermal = async () => {
    if (!fileUri) return Alert.alert('Pilih File', 'Unggah dokumen terlebih dahulu.');
    if (!isConnected) return setConnModal(true);

    if (isPdf) {
      return Alert.alert(
        'PDF → Thermal',
        'Untuk mencetak PDF ke printer thermal:\n\n1. Screenshot halaman PDF\n2. Gunakan tab GAMBAR untuk cetak screenshot\n\nAtau gunakan tombol "Cetak via Printer Biasa" di bawah.',
      );
    }

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

  // Cetak via Android Print Framework (semua printer: WiFi, USB, thermal)
  const printStandard = async () => {
    if (!fileUri) return Alert.alert('Pilih File', 'Unggah dokumen terlebih dahulu.');

    setPrinting(true);
    try {
      if (isPdf) {
        // PDF: langsung kirim ke Android print dialog
        await Print.printAsync({ uri: fileUri });
      } else {
        // Gambar: bungkus dalam HTML
        const FileSystem = require('expo-file-system');
        const base64 = await FileSystem.readAsStringAsync(fileUri, {
          encoding: FileSystem.EncodingType.Base64,
        });
        const ext = fileName.toLowerCase();
        const mime = ext.includes('png') ? 'image/png' : 'image/jpeg';
        const html = `<!DOCTYPE html><html><head><style>*{margin:0;padding:0}body{display:flex;align-items:center;justify-content:center;height:100vh}img{max-width:100%;max-height:100%;object-fit:contain}</style></head><body><img src="data:${mime};base64,${base64}"/></body></html>`;
        await Print.printAsync({ html });
      }
      Alert.alert('Selesai ✅', 'Dokumen dikirim ke printer.');
    } catch (e: any) {
      if (!e.message?.includes('cancel')) {
        Alert.alert('Gagal', e.message);
      }
    } finally {
      setPrinting(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Header onConnectionPress={() => setConnModal(true)} />
      <ScrollView style={styles.content} contentContainerStyle={styles.contentInner}>
        {/* Upload Area */}
        <TouchableOpacity style={styles.uploadBox} onPress={pickDocument} activeOpacity={0.8}>
          <Ionicons name="document-text" size={40} color="#ef4444" />
          <Text style={styles.uploadTitle}>Unggah Dokumen PDF / Gambar</Text>
          <Text style={styles.uploadSub}>PDF, PNG, JPG — pilih file untuk dicetak</Text>
        </TouchableOpacity>

        {/* File Info */}
        {fileName ? (
          <View style={styles.fileInfo}>
            <Ionicons
              name={isPdf ? 'document-text' : 'image'}
              size={16}
              color={isPdf ? '#ef4444' : COLORS.primaryLight}
            />
            <Text style={styles.fileName} numberOfLines={1}>{fileName}</Text>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{isPdf ? 'PDF' : 'IMG'}</Text>
            </View>
            <TouchableOpacity onPress={() => { setFileUri(null); setFileName(''); setIsPdf(false); }}>
              <Ionicons name="close-circle" size={18} color={COLORS.error} />
            </TouchableOpacity>
          </View>
        ) : null}

        {/* Preview */}
        <View style={styles.previewArea}>
          <View style={[styles.paper, paperWidth === 80 && styles.paper80]}>
            {fileUri ? (
              <View style={styles.filePreview}>
                <Ionicons
                  name={isPdf ? 'document-text' : 'image'}
                  size={48}
                  color={isPdf ? '#ef4444' : COLORS.primary}
                />
                <Text style={styles.previewName}>{fileName}</Text>
                <Text style={styles.previewType}>
                  {isPdf ? 'Dokumen PDF' : 'File Gambar'}
                </Text>
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

        {/* Print Buttons */}
        {fileUri && (
          <View style={styles.buttonGroup}>
            {/* Thermal Print (BLE) */}
            <TouchableOpacity
              style={[styles.actionBtn, styles.thermalBtn, isPdf && styles.actionBtnDim]}
              onPress={printThermal}
              disabled={printing}
              activeOpacity={0.8}
            >
              <Ionicons name="bluetooth" size={20} color={COLORS.white} />
              <View>
                <Text style={styles.actionBtnTitle}>Cetak Thermal (BLE)</Text>
                <Text style={styles.actionBtnSub}>
                  {isPdf ? 'Hanya gambar — PDF screenshot dulu' : 'Kirim ke printer thermal via Bluetooth'}
                </Text>
              </View>
            </TouchableOpacity>

            {/* Standard Print (WiFi/USB/All) */}
            <TouchableOpacity
              style={[styles.actionBtn, styles.standardBtn]}
              onPress={printStandard}
              disabled={printing}
              activeOpacity={0.8}
            >
              <Ionicons name="print" size={20} color={COLORS.white} />
              <View>
                <Text style={styles.actionBtnTitle}>Cetak via Printer Biasa</Text>
                <Text style={styles.actionBtnSub}>WiFi, USB, semua printer — PDF & gambar</Text>
              </View>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      {/* Floating Print Button */}
      <TouchableOpacity
        style={[styles.printFab, printing && styles.printFabDisabled]}
        onPress={isPdf ? printStandard : printThermal}
        disabled={printing || !fileUri}
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
  badge: {
    backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 6,
    paddingHorizontal: 8, paddingVertical: 2,
  },
  badgeText: { fontSize: 9, fontWeight: '800', color: COLORS.white },

  previewArea: {
    alignItems: 'center', marginTop: 20,
    backgroundColor: 'rgba(0,0,0,0.3)', borderRadius: 28,
    marginHorizontal: 16, padding: 24, minHeight: 200,
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
  filePreview: { alignItems: 'center', paddingVertical: 24, gap: 8 },
  previewName: { fontSize: 11, fontWeight: '700', color: '#333', textAlign: 'center' },
  previewType: { fontSize: 9, color: '#999' },
  emptyPreview: { alignItems: 'center', paddingVertical: 40, gap: 8 },
  emptyText: { fontSize: 9, fontWeight: '700', color: 'rgba(0,0,0,0.2)', textTransform: 'uppercase', letterSpacing: 2 },

  buttonGroup: { marginHorizontal: 16, marginTop: 16, gap: 10 },
  actionBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    borderRadius: 18, padding: 16,
  },
  actionBtnDim: { opacity: 0.5 },
  thermalBtn: { backgroundColor: 'rgba(79,70,229,0.3)', borderWidth: 1, borderColor: 'rgba(79,70,229,0.4)' },
  standardBtn: { backgroundColor: 'rgba(34,197,94,0.2)', borderWidth: 1, borderColor: 'rgba(34,197,94,0.3)' },
  actionBtnTitle: { fontSize: 12, fontWeight: '700', color: COLORS.white },
  actionBtnSub: { fontSize: 9, color: COLORS.textSecondary, marginTop: 2 },

  printFab: {
    position: 'absolute', bottom: 60, alignSelf: 'center',
    width: 70, height: 70, borderRadius: 35,
    backgroundColor: COLORS.primary,
    alignItems: 'center', justifyContent: 'center',
    elevation: 15,
    shadowColor: COLORS.primary, shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.4, shadowRadius: 20,
  },
  printFabDisabled: { opacity: 0.3 },
});
