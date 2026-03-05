/**
 * StandardPrintScreen — Full-featured printing to regular (WiFi/USB/network) printers.
 * Supports color, paper sizes, orientation, margins, quality — like a standard print dialog.
 * Uses expo-print which leverages Android Print Framework.
 */

import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, Image, ScrollView,
  StyleSheet, Alert, Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import * as Print from 'expo-print';
import * as FileSystem from 'expo-file-system';
import { SafeAreaView } from 'react-native-safe-area-context';

import Header from '../components/Header';
import AdBanner from '../components/AdBanner';
import { COLORS } from '../constants/theme';

// ─── Paper Size Definitions (mm) ──────────────────────────────────
const PAPER_SIZES = [
  { id: 'a4',     label: 'A4',      w: 210,  h: 297 },
  { id: 'a5',     label: 'A5',      w: 148,  h: 210 },
  { id: 'a6',     label: 'A6',      w: 105,  h: 148 },
  { id: 'letter', label: 'Letter',  w: 216,  h: 279 },
  { id: 'legal',  label: 'Legal',   w: 216,  h: 356 },
  { id: 'b5',     label: 'B5',      w: 176,  h: 250 },
  { id: '4x6',    label: '4x6 Foto', w: 102, h: 152 },
  { id: '5x7',    label: '5x7 Foto', w: 127, h: 178 },
  { id: '58mm',   label: '58mm Roll', w: 58,  h: 3276 },
  { id: '80mm',   label: '80mm Roll', w: 80,  h: 3276 },
] as const;

type PaperSizeId = typeof PAPER_SIZES[number]['id'];
type Orientation = 'portrait' | 'landscape';
type MarginMode = 'normal' | 'narrow' | 'borderless';
type Quality = 'normal' | 'high';
type ColorMode = 'color' | 'grayscale';
type FileType = 'image' | 'pdf' | null;

const MARGIN_VALUES: Record<MarginMode, number> = {
  normal: 15,     // 15mm
  narrow: 5,      // 5mm
  borderless: 0,  // 0mm
};

export default function StandardPrintScreen() {
  // File state
  const [fileUri, setFileUri] = useState<string | null>(null);
  const [fileName, setFileName] = useState('');
  const [fileType, setFileType] = useState<FileType>(null);
  const [previewUri, setPreviewUri] = useState<string | null>(null);

  // Print settings
  const [paperSize, setPaperSize] = useState<PaperSizeId>('a4');
  const [orientation, setOrientation] = useState<Orientation>('portrait');
  const [marginMode, setMarginMode] = useState<MarginMode>('normal');
  const [quality, setQuality] = useState<Quality>('normal');
  const [colorMode, setColorMode] = useState<ColorMode>('color');
  const [copies, setCopies] = useState(1);
  const [fitToPage, setFitToPage] = useState(true);

  // ─── File Picker ────────────────────────────────────────
  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Izin Diperlukan', 'Izinkan akses galeri.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 1,
    });
    if (!result.canceled && result.assets[0]) {
      setFileUri(result.assets[0].uri);
      setFileName(result.assets[0].fileName || 'gambar.jpg');
      setFileType('image');
      setPreviewUri(result.assets[0].uri);
    }
  };

  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Izin Diperlukan', 'Izinkan akses kamera.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({ quality: 1 });
    if (!result.canceled && result.assets[0]) {
      setFileUri(result.assets[0].uri);
      setFileName('foto.jpg');
      setFileType('image');
      setPreviewUri(result.assets[0].uri);
    }
  };

  const pickPdf = async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: ['application/pdf', 'image/*'],
      copyToCacheDirectory: true,
    });
    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      const isPdf = asset.mimeType?.includes('pdf') || asset.name?.endsWith('.pdf');
      setFileUri(asset.uri);
      setFileName(asset.name || 'dokumen');
      setFileType(isPdf ? 'pdf' : 'image');
      setPreviewUri(isPdf ? null : asset.uri);
    }
  };

  // ─── Build HTML for printing ────────────────────────────
  const buildPrintHTML = async (): Promise<string> => {
    if (!fileUri) throw new Error('Pilih file terlebih dahulu!');

    const paper = PAPER_SIZES.find((p) => p.id === paperSize)!;
    const marginMM = MARGIN_VALUES[marginMode];

    // Effective paper dimensions
    const pw = orientation === 'portrait' ? paper.w : paper.h;
    const ph = orientation === 'portrait' ? paper.h : paper.w;

    const grayscaleCSS = colorMode === 'grayscale'
      ? 'filter: grayscale(100%); -webkit-filter: grayscale(100%);'
      : '';

    const qualityCSS = quality === 'high'
      ? 'image-rendering: -webkit-optimize-contrast; image-rendering: high-quality;'
      : 'image-rendering: auto;';

    if (fileType === 'image') {
      // Read image as base64 for embedding
      const base64 = await FileSystem.readAsStringAsync(fileUri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      const ext = fileName.toLowerCase();
      const mime = ext.includes('png') ? 'image/png'
        : ext.includes('webp') ? 'image/webp'
        : 'image/jpeg';

      const fitCSS = fitToPage
        ? 'max-width: 100%; max-height: 100%; object-fit: contain;'
        : 'width: auto; height: auto;';

      return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  @page {
    size: ${pw}mm ${ph}mm;
    margin: ${marginMM}mm;
  }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
  }
  img {
    ${fitCSS}
    ${grayscaleCSS}
    ${qualityCSS}
  }
</style>
</head>
<body>
  <img src="data:${mime};base64,${base64}" />
</body>
</html>`;
    }

    // For PDF — we'll print directly using uri
    return '';
  };

  // ─── Print ──────────────────────────────────────────────
  const handlePrint = async () => {
    if (!fileUri) {
      Alert.alert('Pilih File', 'Pilih gambar atau PDF terlebih dahulu.');
      return;
    }

    try {
      if (fileType === 'pdf') {
        // Print PDF directly — Android print dialog handles everything
        await Print.printAsync({
          uri: fileUri,
          orientation: orientation === 'portrait'
            ? Print.Orientation.portrait
            : Print.Orientation.landscape,
        });
      } else {
        // Print image via HTML
        const html = await buildPrintHTML();

        // Print multiple copies
        for (let i = 0; i < copies; i++) {
          await Print.printAsync({
            html,
            orientation: orientation === 'portrait'
              ? Print.Orientation.portrait
              : Print.Orientation.landscape,
          });
        }
      }

      Alert.alert('Selesai ✅', 'Dokumen dikirim ke printer.');
    } catch (e: any) {
      if (e.message?.includes('cancelled') || e.message?.includes('canceled')) {
        // User cancelled — silently ignore
        return;
      }
      Alert.alert('Gagal Cetak', e.message || 'Terjadi kesalahan.');
    }
  };

  // ─── Save as PDF ────────────────────────────────────────
  const handleSavePdf = async () => {
    if (!fileUri || fileType !== 'image') {
      Alert.alert('Info', 'Pilih gambar untuk disimpan sebagai PDF.');
      return;
    }
    try {
      const html = await buildPrintHTML();
      const paper = PAPER_SIZES.find((p) => p.id === paperSize)!;
      const pw = orientation === 'portrait' ? paper.w : paper.h;
      const ph = orientation === 'portrait' ? paper.h : paper.w;

      const { uri } = await Print.printToFileAsync({
        html,
        width: pw * 2.835, // mm to points (72dpi)
        height: ph * 2.835,
      });

      Alert.alert('PDF Tersimpan ✅', `File disimpan di:\n${uri}`);
    } catch (e: any) {
      Alert.alert('Gagal', e.message);
    }
  };

  // ─── UI Helpers ─────────────────────────────────────────
  const OptionButton = ({
    label, active, onPress, icon,
  }: { label: string; active: boolean; onPress: () => void; icon?: string }) => (
    <TouchableOpacity
      style={[styles.optionBtn, active && styles.optionBtnActive]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      {icon && <Ionicons name={icon as any} size={14} color={active ? COLORS.white : COLORS.textMuted} />}
      <Text style={[styles.optionBtnText, active && styles.optionBtnTextActive]}>{label}</Text>
    </TouchableOpacity>
  );

  const selectedPaper = PAPER_SIZES.find((p) => p.id === paperSize)!;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Header />
      <ScrollView style={styles.content} contentContainerStyle={styles.contentInner}>

        {/* Title */}
        <View style={styles.titleRow}>
          <Ionicons name="color-palette" size={22} color={COLORS.primaryLight} />
          <Text style={styles.titleText}>Cetak Umum / Warna</Text>
        </View>
        <Text style={styles.subtitle}>
          Untuk printer biasa (WiFi, USB, jaringan) — cetak warna, foto, dokumen
        </Text>

        {/* File Picker */}
        <View style={styles.pickerRow}>
          <TouchableOpacity style={styles.pickerBtn} onPress={pickImage} activeOpacity={0.7}>
            <Ionicons name="images" size={24} color={COLORS.primaryLight} />
            <Text style={styles.pickerBtnText}>Galeri</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.pickerBtn} onPress={takePhoto} activeOpacity={0.7}>
            <Ionicons name="camera" size={24} color={COLORS.primaryLight} />
            <Text style={styles.pickerBtnText}>Kamera</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.pickerBtn} onPress={pickPdf} activeOpacity={0.7}>
            <Ionicons name="document" size={24} color="#ef4444" />
            <Text style={styles.pickerBtnText}>PDF/File</Text>
          </TouchableOpacity>
        </View>

        {/* File Info */}
        {fileUri && (
          <View style={styles.fileInfo}>
            <Ionicons
              name={fileType === 'pdf' ? 'document-text' : 'image'}
              size={18}
              color={fileType === 'pdf' ? '#ef4444' : COLORS.primaryLight}
            />
            <Text style={styles.fileName} numberOfLines={1}>{fileName}</Text>
            <TouchableOpacity onPress={() => { setFileUri(null); setFileType(null); setPreviewUri(null); }}>
              <Ionicons name="close-circle" size={18} color={COLORS.error} />
            </TouchableOpacity>
          </View>
        )}

        {/* Image Preview */}
        {previewUri && (
          <View style={styles.previewBox}>
            <Image source={{ uri: previewUri }} style={styles.previewImage} resizeMode="contain" />
          </View>
        )}

        {/* ═══ PRINT SETTINGS ═══ */}
        <View style={styles.settingsCard}>
          <Text style={styles.settingsTitle}>⚙️ Pengaturan Cetak</Text>

          {/* Paper Size */}
          <Text style={styles.optionLabel}>📄 Ukuran Kertas</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.optionScroll}>
            <View style={styles.optionRow}>
              {PAPER_SIZES.map((p) => (
                <OptionButton
                  key={p.id}
                  label={`${p.label}\n${p.w}×${p.h}mm`}
                  active={paperSize === p.id}
                  onPress={() => setPaperSize(p.id)}
                />
              ))}
            </View>
          </ScrollView>

          {/* Orientation */}
          <Text style={styles.optionLabel}>🔄 Orientasi</Text>
          <View style={styles.optionRow}>
            <OptionButton
              label="Portrait"
              icon="phone-portrait"
              active={orientation === 'portrait'}
              onPress={() => setOrientation('portrait')}
            />
            <OptionButton
              label="Landscape"
              icon="phone-landscape"
              active={orientation === 'landscape'}
              onPress={() => setOrientation('landscape')}
            />
          </View>

          {/* Margins */}
          <Text style={styles.optionLabel}>📐 Margin / Border</Text>
          <View style={styles.optionRow}>
            <OptionButton
              label={`Normal\n15mm`}
              active={marginMode === 'normal'}
              onPress={() => setMarginMode('normal')}
            />
            <OptionButton
              label={`Narrow\n5mm`}
              active={marginMode === 'narrow'}
              onPress={() => setMarginMode('narrow')}
            />
            <OptionButton
              label={`Borderless\n0mm`}
              active={marginMode === 'borderless'}
              onPress={() => setMarginMode('borderless')}
            />
          </View>

          {/* Quality */}
          <Text style={styles.optionLabel}>✨ Kualitas</Text>
          <View style={styles.optionRow}>
            <OptionButton
              label="Normal"
              icon="speedometer-outline"
              active={quality === 'normal'}
              onPress={() => setQuality('normal')}
            />
            <OptionButton
              label="High Quality"
              icon="diamond"
              active={quality === 'high'}
              onPress={() => setQuality('high')}
            />
          </View>

          {/* Color Mode */}
          <Text style={styles.optionLabel}>🎨 Warna</Text>
          <View style={styles.optionRow}>
            <OptionButton
              label="Full Color"
              icon="color-palette"
              active={colorMode === 'color'}
              onPress={() => setColorMode('color')}
            />
            <OptionButton
              label="Grayscale"
              icon="contrast"
              active={colorMode === 'grayscale'}
              onPress={() => setColorMode('grayscale')}
            />
          </View>

          {/* Fit to Page */}
          <Text style={styles.optionLabel}>📏 Ukuran Gambar</Text>
          <View style={styles.optionRow}>
            <OptionButton
              label="Fit to Page"
              icon="resize"
              active={fitToPage}
              onPress={() => setFitToPage(true)}
            />
            <OptionButton
              label="Original Size"
              icon="scan"
              active={!fitToPage}
              onPress={() => setFitToPage(false)}
            />
          </View>

          {/* Copies */}
          <Text style={styles.optionLabel}>📋 Jumlah Cetak</Text>
          <View style={styles.copiesRow}>
            <TouchableOpacity
              style={styles.copiesBtn}
              onPress={() => setCopies(Math.max(1, copies - 1))}
            >
              <Ionicons name="remove" size={20} color={COLORS.white} />
            </TouchableOpacity>
            <Text style={styles.copiesText}>{copies}</Text>
            <TouchableOpacity
              style={styles.copiesBtn}
              onPress={() => setCopies(Math.min(99, copies + 1))}
            >
              <Ionicons name="add" size={20} color={COLORS.white} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Summary */}
        <View style={styles.summaryCard}>
          <Text style={styles.summaryTitle}>Ringkasan</Text>
          <Text style={styles.summaryText}>
            {selectedPaper.label} • {orientation === 'portrait' ? 'Portrait' : 'Landscape'} • {
              marginMode === 'normal' ? 'Border 15mm' : marginMode === 'narrow' ? 'Border 5mm' : 'Borderless'
            }
          </Text>
          <Text style={styles.summaryText}>
            {colorMode === 'color' ? 'Full Color' : 'Grayscale'} • {quality === 'high' ? 'High Quality' : 'Normal'} • {copies}x cetak
          </Text>
        </View>

        {/* Action Buttons */}
        <View style={styles.actionRow}>
          <TouchableOpacity
            style={[styles.actionBtn, styles.printBtn, !fileUri && styles.actionBtnDisabled]}
            onPress={handlePrint}
            disabled={!fileUri}
            activeOpacity={0.8}
          >
            <Ionicons name="print" size={22} color={COLORS.white} />
            <Text style={styles.actionBtnText}>Cetak</Text>
          </TouchableOpacity>

          {fileType === 'image' && (
            <TouchableOpacity
              style={[styles.actionBtn, styles.pdfBtn, !fileUri && styles.actionBtnDisabled]}
              onPress={handleSavePdf}
              disabled={!fileUri}
              activeOpacity={0.8}
            >
              <Ionicons name="download" size={22} color={COLORS.white} />
              <Text style={styles.actionBtnText}>Simpan PDF</Text>
            </TouchableOpacity>
          )}
        </View>

      </ScrollView>
      <AdBanner />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bgDark },
  content: { flex: 1 },
  contentInner: { paddingBottom: 30 },

  titleRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 20, paddingTop: 12,
  },
  titleText: { fontSize: 18, fontWeight: '800', color: COLORS.white },
  subtitle: {
    fontSize: 11, color: COLORS.textMuted,
    paddingHorizontal: 20, marginTop: 4, marginBottom: 16,
  },

  // File picker
  pickerRow: {
    flexDirection: 'row', gap: 10,
    paddingHorizontal: 20, marginBottom: 12,
  },
  pickerBtn: {
    flex: 1, alignItems: 'center', gap: 6,
    backgroundColor: COLORS.bgCard,
    borderRadius: 14, borderWidth: 1, borderColor: COLORS.bgCardBorder,
    paddingVertical: 18,
  },
  pickerBtnText: { fontSize: 11, fontWeight: '600', color: COLORS.textSecondary },

  fileInfo: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    marginHorizontal: 20, marginBottom: 12,
    backgroundColor: 'rgba(79,70,229,0.15)',
    borderRadius: 12, padding: 12,
  },
  fileName: { flex: 1, fontSize: 12, fontWeight: '600', color: COLORS.white },

  previewBox: {
    marginHorizontal: 20, marginBottom: 16,
    backgroundColor: COLORS.white, borderRadius: 12,
    padding: 8, alignItems: 'center',
  },
  previewImage: { width: '100%', height: 200, borderRadius: 8 },

  // Settings card
  settingsCard: {
    marginHorizontal: 16, marginBottom: 16,
    backgroundColor: COLORS.bgCard,
    borderRadius: 20, borderWidth: 1, borderColor: COLORS.bgCardBorder,
    padding: 18,
  },
  settingsTitle: {
    fontSize: 14, fontWeight: '800', color: COLORS.white, marginBottom: 14,
  },
  optionLabel: {
    fontSize: 11, fontWeight: '700', color: COLORS.textSecondary,
    marginTop: 14, marginBottom: 8,
  },
  optionScroll: { marginHorizontal: -4 },
  optionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },

  optionBtn: {
    paddingHorizontal: 12, paddingVertical: 8,
    borderRadius: 10, backgroundColor: 'rgba(0,0,0,0.3)',
    alignItems: 'center', flexDirection: 'row', gap: 5,
    minWidth: 65,
  },
  optionBtnActive: { backgroundColor: COLORS.primary },
  optionBtnText: {
    fontSize: 10, fontWeight: '700', color: COLORS.textMuted,
    textAlign: 'center',
  },
  optionBtnTextActive: { color: COLORS.white },

  copiesRow: {
    flexDirection: 'row', alignItems: 'center', gap: 16,
  },
  copiesBtn: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: COLORS.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  copiesText: { fontSize: 20, fontWeight: '800', color: COLORS.white, minWidth: 30, textAlign: 'center' },

  // Summary
  summaryCard: {
    marginHorizontal: 16, marginBottom: 16,
    backgroundColor: 'rgba(79,70,229,0.12)',
    borderRadius: 14, borderWidth: 1, borderColor: 'rgba(129,140,248,0.2)',
    padding: 14,
  },
  summaryTitle: { fontSize: 11, fontWeight: '700', color: COLORS.primaryLight, marginBottom: 4 },
  summaryText: { fontSize: 11, color: COLORS.textSecondary, lineHeight: 18 },

  // Action buttons
  actionRow: {
    flexDirection: 'row', gap: 10,
    paddingHorizontal: 20, marginBottom: 12,
  },
  actionBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, paddingVertical: 16, borderRadius: 14,
  },
  actionBtnDisabled: { opacity: 0.4 },
  printBtn: { backgroundColor: COLORS.primary },
  pdfBtn: { backgroundColor: '#059669' },
  actionBtnText: { fontSize: 14, fontWeight: '700', color: COLORS.white },
});
