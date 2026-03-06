import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, Image, ScrollView, StyleSheet, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { SafeAreaView } from 'react-native-safe-area-context';

import Header from '../components/Header';
import ConnectionModal from '../components/ConnectionModal';
import AdBanner from '../components/AdBanner';
import { useApp } from '../contexts/AppContext';
import { COLORS, PAPER } from '../constants/theme';
import { processImageForPrint } from '../utils/imageProcessor';
import { pixelsToEscPos } from '../utils/escpos';

export default function ImageScreen() {
  const { sendToPrinter, paperWidth, contrast, isConnected } = useApp();
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [printing, setPrinting] = useState(false);
  const [connModal, setConnModal] = useState(false);

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Izin Diperlukan', 'Izinkan akses galeri untuk memilih gambar.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 1,
    });
    if (!result.canceled && result.assets[0]) {
      setImageUri(result.assets[0].uri);
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
      setImageUri(result.assets[0].uri);
    }
  };

  const handlePrint = async () => {
    if (!imageUri) return Alert.alert('Pilih Gambar', 'Pilih gambar terlebih dahulu.');
    if (!isConnected) return setConnModal(true);

    setPrinting(true);
    try {
      const targetWidth = PAPER[paperWidth].dots;
      const { pixels, width, height } = await processImageForPrint(imageUri, targetWidth);
      const escpos = pixelsToEscPos(pixels, width, height, contrast);
      await sendToPrinter(escpos);
      Alert.alert('Berhasil ✅', 'Gambar berhasil dicetak!');
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
        {/* Upload Area */}
        <TouchableOpacity style={styles.uploadBox} onPress={pickImage} activeOpacity={0.8}>
          <Ionicons name="cloud-upload" size={40} color={COLORS.primaryLight} />
          <Text style={styles.uploadTitle}>Pilih atau Seret Gambar</Text>
          <Text style={styles.uploadSub}>PNG, JPG, WEBP (Max 5MB)</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.cameraBtn} onPress={takePhoto}>
          <Ionicons name="camera" size={18} color={COLORS.primaryLight} />
          <Text style={styles.cameraBtnText}>Ambil Foto</Text>
        </TouchableOpacity>

        {/* Preview */}
        {imageUri ? (
          <View style={styles.previewArea}>
            <View style={[styles.paper, paperWidth === 80 && styles.paper80]}>
              <Image source={{ uri: imageUri }} style={styles.previewImage} resizeMode="contain" />
              <View style={styles.paperEdge} />
            </View>
          </View>
        ) : (
          <View style={styles.previewArea}>
            <View style={[styles.paper, paperWidth === 80 && styles.paper80]}>
              <View style={styles.emptyPreview}>
                <Ionicons name="print" size={36} color="rgba(0,0,0,0.15)" />
                <Text style={styles.emptyText}>Siap Mencetak</Text>
              </View>
              <View style={styles.paperEdge} />
            </View>
          </View>
        )}
      </ScrollView>

      {/* Floating Print Button */}
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
    borderColor: 'rgba(129,140,248,0.3)',
    padding: 32, alignItems: 'center', gap: 8,
  },
  uploadTitle: { fontSize: 13, fontWeight: '700', color: COLORS.white },
  uploadSub: { fontSize: 10, color: 'rgba(255,255,255,0.4)' },

  cameraBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, marginHorizontal: 16, marginTop: 10,
    backgroundColor: COLORS.bgCard, borderRadius: 16, borderWidth: 1,
    borderColor: COLORS.bgCardBorder, padding: 12,
  },
  cameraBtnText: { fontSize: 12, fontWeight: '600', color: COLORS.primaryLight },

  previewArea: {
    flex: 1, alignItems: 'center', marginTop: 20,
    backgroundColor: 'rgba(0,0,0,0.3)', borderRadius: 28,
    marginHorizontal: 16, padding: 24, minHeight: 250,
  },
  paper: {
    width: 220, backgroundColor: COLORS.white,
    borderRadius: 2, padding: 16, minHeight: 150,
    elevation: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5, shadowRadius: 20,
  },
  paper80: { width: 300 },
  previewImage: { width: '100%', height: 200 },
  paperEdge: {
    position: 'absolute', bottom: -6, left: 0, right: 0, height: 6,
    backgroundColor: COLORS.white, borderBottomLeftRadius: 2, borderBottomRightRadius: 2,
  },
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
