import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, Linking, Image, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';

import Header from '../components/Header';
import ConnectionModal from '../components/ConnectionModal';
import AdBanner from '../components/AdBanner';
import { useApp } from '../contexts/AppContext';
import { COLORS } from '../constants/theme';

export default function SettingsScreen() {
  const { storeName, setStoreName, storeContact, setStoreContact } = useApp();
  const [connModal, setConnModal] = useState(false);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Header onConnectionPress={() => setConnModal(true)} />
      <ScrollView style={styles.content} contentContainerStyle={styles.contentInner}>

        {/* Store Settings */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>🏪 Pengaturan Toko</Text>
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Nama Toko</Text>
            <TextInput
              style={styles.input}
              value={storeName}
              onChangeText={setStoreName}
              placeholder="Nama toko Anda"
              placeholderTextColor={COLORS.textMuted}
            />
          </View>
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Kontak Toko</Text>
            <TextInput
              style={styles.input}
              value={storeContact}
              onChangeText={setStoreContact}
              placeholder="No. HP / WhatsApp"
              placeholderTextColor={COLORS.textMuted}
              keyboardType="phone-pad"
            />
          </View>
        </View>

        {/* About */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>ℹ️ Tentang Aplikasi</Text>
          <View style={styles.aboutBox}>
            <Image source={require('../../assets/logo.png')} style={styles.aboutLogo} resizeMode="contain" />
            <Text style={styles.aboutName}>HERNIPRINT</Text>
            <Text style={styles.aboutVersion}>Versi 2.0.0</Text>
            <Text style={styles.aboutDesc}>
              Solusi cetak thermal & printer warna untuk UMKM Indonesia. Mendukung Bluetooth, USB/OTG, cetak gambar, PDF, resi/label, QR code, dan barcode.
            </Text>
          </View>
        </View>

        {/* Disclaimer */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>⚠️ Disclaimer</Text>
          <Text style={styles.disclaimer}>
            Aplikasi ini disediakan "sebagaimana adanya" tanpa jaminan apapun. Penggunaan sepenuhnya menjadi tanggung jawab pengguna. Kami tidak bertanggung jawab atas kerusakan printer atau kesalahan cetak.
          </Text>
        </View>

        {/* Contact / Telegram */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>📱 Hubungi Kami</Text>
          <TouchableOpacity
            style={styles.telegramBtn}
            onPress={() => Linking.openURL('https://t.me/altomediaindonesia')}
            activeOpacity={0.8}
          >
            <Ionicons name="paper-plane" size={20} color={COLORS.white} />
            <View>
              <Text style={styles.telegramTitle}>Telegram</Text>
              <Text style={styles.telegramSub}>@altomediaindonesia</Text>
            </View>
            <Ionicons name="chevron-forward" size={14} color="rgba(255,255,255,0.5)" style={{ marginLeft: 'auto' }} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.waBtn}
            onPress={() => Linking.openURL('https://wa.me/6285813899649')}
            activeOpacity={0.8}
          >
            <Ionicons name="logo-whatsapp" size={20} color={COLORS.white} />
            <View>
              <Text style={styles.telegramTitle}>WhatsApp</Text>
              <Text style={styles.telegramSub}>+62 858-1389-9649</Text>
            </View>
            <Ionicons name="chevron-forward" size={14} color="rgba(255,255,255,0.5)" style={{ marginLeft: 'auto' }} />
          </TouchableOpacity>
        </View>

        <Text style={styles.footer}>© 2026 Alto Media Indonesia</Text>
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

  card: {
    marginHorizontal: 16, marginTop: 16,
    backgroundColor: COLORS.bgCard, borderRadius: 24,
    borderWidth: 1, borderColor: COLORS.bgCardBorder, padding: 18,
  },
  cardTitle: { fontSize: 14, fontWeight: '700', color: COLORS.white, marginBottom: 14 },

  field: { marginBottom: 12 },
  fieldLabel: { fontSize: 10, fontWeight: '700', color: COLORS.textSecondary, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 1 },
  input: {
    backgroundColor: 'rgba(0,0,0,0.3)', borderRadius: 12,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: 14, paddingVertical: 10,
    color: COLORS.white, fontSize: 13,
  },

  aboutBox: { alignItems: 'center', paddingVertical: 10, gap: 6 },
  aboutLogo: { width: 60, height: 60, borderRadius: 16 },
  aboutName: { fontSize: 18, fontWeight: '900', color: COLORS.white },
  aboutVersion: { fontSize: 11, color: COLORS.textMuted },
  aboutDesc: { fontSize: 11, color: COLORS.textSecondary, textAlign: 'center', lineHeight: 18, marginTop: 6 },

  disclaimer: { fontSize: 11, color: COLORS.textMuted, lineHeight: 18 },

  telegramBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#0088cc', borderRadius: 16, padding: 14, marginBottom: 10,
  },
  waBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#25D366', borderRadius: 16, padding: 14,
  },
  telegramTitle: { fontSize: 12, fontWeight: '700', color: COLORS.white },
  telegramSub: { fontSize: 10, color: 'rgba(255,255,255,0.7)' },

  footer: {
    textAlign: 'center', fontSize: 10, color: COLORS.textMuted,
    marginTop: 24, marginBottom: 16,
  },
});
