import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, Image, ScrollView, StyleSheet, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import * as Print from 'expo-print';
import * as FileSystem from 'expo-file-system';
import { SafeAreaView } from 'react-native-safe-area-context';

import Header from '../components/Header';
import ConnectionModal from '../components/ConnectionModal';
import AdBanner from '../components/AdBanner';
import { COLORS } from '../constants/theme';

const PAPER_SIZES = [
  { id: 'a4', label: 'A4', w: 210, h: 297 },
  { id: 'a5', label: 'A5', w: 148, h: 210 },
  { id: 'letter', label: 'Letter', w: 216, h: 279 },
  { id: 'legal', label: 'Legal', w: 216, h: 356 },
  { id: '4x6', label: '4x6 Foto', w: 102, h: 152 },
] as const;

type Orientation = 'portrait' | 'landscape';
type MarginMode = 'normal' | 'narrow' | 'borderless';
type Quality = 'normal' | 'high';
type ColorMode = 'color' | 'grayscale';

const MARGINS: Record<MarginMode, number> = { normal: 15, narrow: 5, borderless: 0 };

export default function StandardPrintScreen() {
  const [fileUri, setFileUri] = useState<string | null>(null);
  const [fileName, setFileName] = useState('');
  const [fileType, setFileType] = useState<'image' | 'pdf' | null>(null);
  const [paperSize, setPaperSize] = useState<string>('a4');
  const [orientation, setOrientation] = useState<Orientation>('portrait');
  const [marginMode, setMarginMode] = useState<MarginMode>('normal');
  const [quality, setQuality] = useState<Quality>('normal');
  const [colorMode, setColorMode] = useState<ColorMode>('color');
  const [copies, setCopies] = useState(1);
  const [connModal, setConnModal] = useState(false);

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') return;
    const result = await ImagePicker.launchImageLibraryAsync({ quality: 1 });
    if (!result.canceled && result.assets[0]) {
      setFileUri(result.assets[0].uri);
      setFileName(result.assets[0].fileName || 'gambar.jpg');
      setFileType('image');
    }
  };

  const pickFile = async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: ['application/pdf', 'image/*'], copyToCacheDirectory: true,
    });
    if (!result.canceled && result.assets[0]) {
      const a = result.assets[0];
      setFileUri(a.uri);
      setFileName(a.name || 'dokumen');
      setFileType(a.mimeType?.includes('pdf') ? 'pdf' : 'image');
    }
  };

  const handlePrint = async () => {
    if (!fileUri) return Alert.alert('Pilih File', 'Pilih gambar atau PDF terlebih dahulu.');
    try {
      if (fileType === 'pdf') {
        await Print.printAsync({
          uri: fileUri,
          orientation: orientation === 'portrait' ? Print.Orientation.portrait : Print.Orientation.landscape,
        });
      } else {
        const base64 = await FileSystem.readAsStringAsync(fileUri, { encoding: FileSystem.EncodingType.Base64 });
        const paper = PAPER_SIZES.find(p => p.id === paperSize) || PAPER_SIZES[0];
        const pw = orientation === 'portrait' ? paper.w : paper.h;
        const ph = orientation === 'portrait' ? paper.h : paper.w;
        const m = MARGINS[marginMode];
        const gray = colorMode === 'grayscale' ? 'filter:grayscale(100%);' : '';
        const html = `<!DOCTYPE html><html><head><style>@page{size:${pw}mm ${ph}mm;margin:${m}mm}*{margin:0;padding:0}body{display:flex;align-items:center;justify-content:center;height:100%}img{max-width:100%;max-height:100%;object-fit:contain;${gray}}</style></head><body><img src="data:image/jpeg;base64,${base64}"/></body></html>`;
        for (let i = 0; i < copies; i++) {
          await Print.printAsync({
            html,
            orientation: orientation === 'portrait' ? Print.Orientation.portrait : Print.Orientation.landscape,
          });
        }
      }
      Alert.alert('Selesai ✅', 'Dokumen dikirim ke printer.');
    } catch (e: any) {
      if (!e.message?.includes('cancel')) Alert.alert('Gagal', e.message);
    }
  };

  const Option = ({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) => (
    <TouchableOpacity style={[styles.optBtn, active && styles.optBtnActive]} onPress={onPress}>
      <Text style={[styles.optBtnText, active && styles.optBtnTextActive]}>{label}</Text>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Header onConnectionPress={() => setConnModal(true)} />
      <ScrollView style={styles.content} contentContainerStyle={styles.contentInner}>
        <View style={styles.titleRow}>
          <Ionicons name="color-palette" size={20} color={COLORS.primaryLight} />
          <Text style={styles.titleText}>Cetak Umum / Warna</Text>
        </View>
        <Text style={styles.subtitle}>Untuk printer biasa (WiFi, USB, jaringan)</Text>

        {/* File Picker */}
        <View style={styles.pickerRow}>
          <TouchableOpacity style={styles.pickerBtn} onPress={pickImage}>
            <Ionicons name="images" size={22} color={COLORS.primaryLight} />
            <Text style={styles.pickerText}>Galeri</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.pickerBtn} onPress={pickFile}>
            <Ionicons name="document" size={22} color="#ef4444" />
            <Text style={styles.pickerText}>PDF/File</Text>
          </TouchableOpacity>
        </View>

        {fileName ? (
          <View style={styles.fileInfo}>
            <Ionicons name={fileType === 'pdf' ? 'document-text' : 'image'} size={16} color={fileType === 'pdf' ? '#ef4444' : COLORS.primaryLight} />
            <Text style={styles.fileName} numberOfLines={1}>{fileName}</Text>
            <TouchableOpacity onPress={() => { setFileUri(null); setFileType(null); setFileName(''); }}>
              <Ionicons name="close-circle" size={18} color={COLORS.error} />
            </TouchableOpacity>
          </View>
        ) : null}

        {/* Settings */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>⚙️ Pengaturan Cetak</Text>

          <Text style={styles.optLabel}>📄 Ukuran Kertas</Text>
          <View style={styles.optRow}>
            {PAPER_SIZES.map(p => (
              <Option key={p.id} label={p.label} active={paperSize === p.id} onPress={() => setPaperSize(p.id)} />
            ))}
          </View>

          <Text style={styles.optLabel}>🔄 Orientasi</Text>
          <View style={styles.optRow}>
            <Option label="Portrait" active={orientation === 'portrait'} onPress={() => setOrientation('portrait')} />
            <Option label="Landscape" active={orientation === 'landscape'} onPress={() => setOrientation('landscape')} />
          </View>

          <Text style={styles.optLabel}>📐 Margin</Text>
          <View style={styles.optRow}>
            <Option label="Normal" active={marginMode === 'normal'} onPress={() => setMarginMode('normal')} />
            <Option label="Narrow" active={marginMode === 'narrow'} onPress={() => setMarginMode('narrow')} />
            <Option label="Borderless" active={marginMode === 'borderless'} onPress={() => setMarginMode('borderless')} />
          </View>

          <Text style={styles.optLabel}>✨ Kualitas</Text>
          <View style={styles.optRow}>
            <Option label="Normal" active={quality === 'normal'} onPress={() => setQuality('normal')} />
            <Option label="High" active={quality === 'high'} onPress={() => setQuality('high')} />
          </View>

          <Text style={styles.optLabel}>🎨 Warna</Text>
          <View style={styles.optRow}>
            <Option label="Color" active={colorMode === 'color'} onPress={() => setColorMode('color')} />
            <Option label="Grayscale" active={colorMode === 'grayscale'} onPress={() => setColorMode('grayscale')} />
          </View>

          <Text style={styles.optLabel}>📋 Jumlah</Text>
          <View style={styles.copiesRow}>
            <TouchableOpacity style={styles.copiesBtn} onPress={() => setCopies(Math.max(1, copies - 1))}>
              <Ionicons name="remove" size={18} color={COLORS.white} />
            </TouchableOpacity>
            <Text style={styles.copiesText}>{copies}</Text>
            <TouchableOpacity style={styles.copiesBtn} onPress={() => setCopies(Math.min(99, copies + 1))}>
              <Ionicons name="add" size={18} color={COLORS.white} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Print Button */}
        <TouchableOpacity style={[styles.printBtn, !fileUri && { opacity: 0.4 }]} onPress={handlePrint} disabled={!fileUri}>
          <Ionicons name="print" size={22} color={COLORS.white} />
          <Text style={styles.printBtnText}>Cetak</Text>
        </TouchableOpacity>
      </ScrollView>
      <AdBanner />
      <ConnectionModal visible={connModal} onClose={() => setConnModal(false)} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bgDark },
  content: { flex: 1 },
  contentInner: { paddingBottom: 30 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 20, paddingTop: 8 },
  titleText: { fontSize: 16, fontWeight: '800', color: COLORS.white },
  subtitle: { fontSize: 10, color: COLORS.textMuted, paddingHorizontal: 20, marginTop: 2, marginBottom: 12 },

  pickerRow: { flexDirection: 'row', gap: 10, paddingHorizontal: 16, marginBottom: 10 },
  pickerBtn: {
    flex: 1, alignItems: 'center', gap: 6, backgroundColor: COLORS.bgCard,
    borderRadius: 16, borderWidth: 1, borderColor: COLORS.bgCardBorder, paddingVertical: 18,
  },
  pickerText: { fontSize: 10, fontWeight: '600', color: COLORS.textSecondary },

  fileInfo: {
    flexDirection: 'row', alignItems: 'center', gap: 10, marginHorizontal: 16, marginBottom: 10,
    backgroundColor: 'rgba(79,70,229,0.15)', borderRadius: 12, padding: 12,
  },
  fileName: { flex: 1, fontSize: 12, fontWeight: '600', color: COLORS.white },

  card: {
    marginHorizontal: 16, marginBottom: 16, backgroundColor: COLORS.bgCard,
    borderRadius: 20, borderWidth: 1, borderColor: COLORS.bgCardBorder, padding: 16,
  },
  cardTitle: { fontSize: 13, fontWeight: '800', color: COLORS.white, marginBottom: 10 },
  optLabel: { fontSize: 10, fontWeight: '700', color: COLORS.textSecondary, marginTop: 12, marginBottom: 6 },
  optRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  optBtn: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10,
    backgroundColor: 'rgba(0,0,0,0.3)', minWidth: 60, alignItems: 'center',
  },
  optBtnActive: { backgroundColor: COLORS.primary },
  optBtnText: { fontSize: 10, fontWeight: '700', color: COLORS.textMuted },
  optBtnTextActive: { color: COLORS.white },

  copiesRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  copiesBtn: {
    width: 34, height: 34, borderRadius: 10, backgroundColor: COLORS.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  copiesText: { fontSize: 18, fontWeight: '800', color: COLORS.white, minWidth: 30, textAlign: 'center' },

  printBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    marginHorizontal: 16, paddingVertical: 16, borderRadius: 16,
    backgroundColor: COLORS.primary,
  },
  printBtnText: { fontSize: 14, fontWeight: '700', color: COLORS.white },
});
