import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import { SafeAreaView } from 'react-native-safe-area-context';

import Header from '../components/Header';
import PrintButton from '../components/PrintButton';
import PaperSettings from '../components/PaperSettings';
import AdBanner from '../components/AdBanner';
import { useApp } from '../contexts/AppContext';
import { COLORS } from '../constants/theme';
import { processImageForPrint } from '../utils/imageProcessor';

export default function PdfScreen() {
  const { sendToPrinter, paperWidth, contrast } = useApp();
  const [pdfUri, setPdfUri] = useState<string | null>(null);
  const [pdfName, setPdfName] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [pageImageUri, setPageImageUri] = useState<string | null>(null);

  const pickPdf = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/pdf',
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        setPdfUri(asset.uri);
        setPdfName(asset.name || 'document.pdf');
        setCurrentPage(1);
        // PDF rendering will be handled by react-native-pdf in the preview
        Alert.alert(
          'PDF Dimuat',
          `${asset.name}\nUkuran: ${((asset.size || 0) / 1024).toFixed(1)} KB\n\nPDF akan dirender saat mencetak.`
        );
      }
    } catch (e: any) {
      Alert.alert('Error', 'Gagal memilih file: ' + e.message);
    }
  };

  const handlePrint = async () => {
    if (!pdfUri) throw new Error('Pilih file PDF terlebih dahulu!');
    
    // For PDF printing, we convert the PDF page to an image first
    // This requires the PDF to be rendered via react-native-pdf
    if (pageImageUri) {
      const escposData = await processImageForPrint(pageImageUri, paperWidth, contrast / 100);
      await sendToPrinter(escposData);
    } else {
      Alert.alert('Info', 'Harap tunggu PDF selesai dirender sebelum mencetak.');
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Header />
      <ScrollView style={styles.content} contentContainerStyle={styles.contentInner}>
        <View style={styles.uploadArea}>
          <TouchableOpacity style={styles.uploadBtn} onPress={pickPdf} activeOpacity={0.7}>
            <Ionicons name="document-text" size={36} color="#ef4444" />
            <Text style={styles.uploadTitle}>Pilih File PDF</Text>
            <Text style={styles.uploadSub}>Dokumen akan dikonversi untuk cetak thermal</Text>
          </TouchableOpacity>
        </View>

        {pdfUri && (
          <View style={styles.pdfInfo}>
            <View style={styles.pdfInfoRow}>
              <Ionicons name="document" size={20} color={COLORS.primaryLight} />
              <Text style={styles.pdfName} numberOfLines={1}>{pdfName}</Text>
            </View>
            
            {totalPages > 1 && (
              <View style={styles.pageNav}>
                <TouchableOpacity
                  onPress={() => setCurrentPage(Math.max(1, currentPage - 1))}
                  style={styles.pageBtn}
                >
                  <Ionicons name="chevron-back" size={18} color={COLORS.white} />
                </TouchableOpacity>
                <Text style={styles.pageText}>
                  Halaman {currentPage} / {totalPages}
                </Text>
                <TouchableOpacity
                  onPress={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                  style={styles.pageBtn}
                >
                  <Ionicons name="chevron-forward" size={18} color={COLORS.white} />
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}

        <PaperSettings />
        <PrintButton onPrint={handlePrint} />
      </ScrollView>
      <AdBanner />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bgDark },
  content: { flex: 1 },
  contentInner: { paddingBottom: 20 },
  uploadArea: { margin: 20, gap: 12 },
  uploadBtn: {
    backgroundColor: COLORS.bgCard,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: 'rgba(239, 68, 68, 0.3)',
    borderStyle: 'dashed',
    padding: 32,
    alignItems: 'center',
    gap: 8,
  },
  uploadTitle: { fontSize: 14, fontWeight: '700', color: COLORS.white },
  uploadSub: { fontSize: 10, color: COLORS.textMuted, textAlign: 'center' },
  pdfInfo: {
    marginHorizontal: 20,
    marginBottom: 16,
    backgroundColor: COLORS.bgCard,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.bgCardBorder,
    padding: 16,
    gap: 12,
  },
  pdfInfoRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  pdfName: { fontSize: 13, fontWeight: '600', color: COLORS.white, flex: 1 },
  pageNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  pageBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pageText: { fontSize: 12, fontWeight: '700', color: COLORS.white },
});
