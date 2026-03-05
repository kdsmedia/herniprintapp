import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Image, ScrollView, StyleSheet, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { SafeAreaView } from 'react-native-safe-area-context';

import Header from '../components/Header';
import PrintButton from '../components/PrintButton';
import PaperSettings from '../components/PaperSettings';
import AdBanner from '../components/AdBanner';
import { useApp } from '../contexts/AppContext';
import { COLORS } from '../constants/theme';
import { processImageForPrint } from '../utils/imageProcessor';

export default function ImageScreen() {
  const { sendToPrinter, paperWidth, contrast } = useApp();
  const [imageUri, setImageUri] = useState<string | null>(null);

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Izin Diperlukan', 'Izinkan akses galeri untuk memilih gambar.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 1,
      allowsEditing: false,
    });

    if (!result.canceled && result.assets[0]) {
      setImageUri(result.assets[0].uri);
    }
  };

  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Izin Diperlukan', 'Izinkan akses kamera untuk memfoto dokumen.');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      quality: 1,
      allowsEditing: false,
    });

    if (!result.canceled && result.assets[0]) {
      setImageUri(result.assets[0].uri);
    }
  };

  const handlePrint = async () => {
    if (!imageUri) throw new Error('Pilih gambar terlebih dahulu!');
    const escposData = await processImageForPrint(imageUri, paperWidth, contrast / 100);
    await sendToPrinter(escposData);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Header />
      <ScrollView style={styles.content} contentContainerStyle={styles.contentInner}>
        <View style={styles.uploadArea}>
          <TouchableOpacity style={styles.uploadBtn} onPress={pickImage} activeOpacity={0.7}>
            <Ionicons name="images" size={36} color={COLORS.primaryLight} />
            <Text style={styles.uploadTitle}>Pilih dari Galeri</Text>
            <Text style={styles.uploadSub}>PNG, JPG, WEBP (Max 5MB)</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.cameraBtn} onPress={takePhoto} activeOpacity={0.7}>
            <Ionicons name="camera" size={24} color={COLORS.primaryLight} />
            <Text style={styles.cameraBtnText}>Ambil Foto</Text>
          </TouchableOpacity>
        </View>

        {imageUri && (
          <View style={styles.previewContainer}>
            <Text style={styles.previewTitle}>Preview</Text>
            <View style={styles.previewBox}>
              <Image source={{ uri: imageUri }} style={styles.previewImage} resizeMode="contain" />
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

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bgDark },
  content: { flex: 1 },
  contentInner: { paddingBottom: 20 },
  uploadArea: { margin: 20, gap: 12 },
  uploadBtn: {
    backgroundColor: COLORS.bgCard,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: 'rgba(129, 140, 248, 0.3)',
    borderStyle: 'dashed',
    padding: 32,
    alignItems: 'center',
    gap: 8,
  },
  uploadTitle: { fontSize: 14, fontWeight: '700', color: COLORS.white },
  uploadSub: { fontSize: 10, color: COLORS.textMuted },
  cameraBtn: {
    backgroundColor: COLORS.bgCard,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.bgCardBorder,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  cameraBtnText: { fontSize: 13, fontWeight: '600', color: COLORS.primaryLight },
  previewContainer: { marginHorizontal: 20, marginBottom: 16 },
  previewTitle: { fontSize: 12, fontWeight: '700', color: COLORS.textSecondary, marginBottom: 8, textTransform: 'uppercase' },
  previewBox: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    padding: 12,
    alignItems: 'center',
    minHeight: 150,
  },
  previewImage: { width: '100%', height: 250 },
});
