import React from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, Linking, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';

import Header from '../components/Header';
import ConnectionModal from '../components/ConnectionModal';
import AdBanner from '../components/AdBanner';
import { useApp } from '../contexts/AppContext';
import { COLORS } from '../constants/theme';

export default function SettingsScreen() {
  const { storeName, setStoreName, storeContact, setStoreContact, paperWidth, setPaperWidth } = useApp();
  const [connModal, setConnModal] = React.useState(false);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Header onConnectionPress={() => setConnModal(true)} />
      <ScrollView style={styles.content} contentContainerStyle={styles.contentInner}>

        {/* Store Settings */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>🏪 Pengaturan Toko</Text>
          <Text style={styles.label}>Nama Toko</Text>
          <TextInput
            style={styles.input} value={storeName} onChangeText={setStoreName}
            placeholder="Nama toko Anda" placeholderTextColor="#64748b"
          />
          <Text style={styles.label}>Kontak Toko</Text>
          <TextInput
            style={styles.input} value={storeContact} onChangeText={setStoreContact}
            placeholder="No. HP / Email" placeholderTextColor="#64748b"
          />
        </View>

        {/* Paper Settings */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>📄 Ukuran Kertas Default</Text>
          <View style={styles.paperRow}>
            <TouchableOpacity
              style={[styles.paperBtn, paperWidth === 58 && styles.paperBtnActive]}
              onPress={() => setPaperWidth(58)}
            >
              <Text style={[styles.paperBtnText, paperWidth === 58 && styles.paperBtnTextActive]}>58mm</Text>
              <Text style={styles.paperBtnSub}>384 dots</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.paperBtn, paperWidth === 80 && styles.paperBtnActive]}
              onPress={() => setPaperWidth(80)}
            >
              <Text style={[styles.paperBtnText, paperWidth === 80 && styles.paperBtnTextActive]}>80mm</Text>
              <Text style={styles.paperBtnSub}>576 dots</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* About */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>ℹ️ Tentang Aplikasi</Text>
          <Text style={styles.aboutText}>
            HERNIPRINT v2.0{'\n'}
            Solusi Cetak Thermal untuk UMKM Indonesia{'\n\n'}
            Aplikasi ini mendukung pencetakan gambar, PDF, resi pengiriman,
            label barang, QR Code, dan Barcode melalui printer thermal via Bluetooth dan USB.
          </Text>
        </View>

        {/* Disclaimer */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>⚠️ Disclaimer</Text>
          <Text style={styles.aboutText}>
            Aplikasi ini disediakan "sebagaimana adanya" tanpa jaminan apapun.
            Pengembang tidak bertanggung jawab atas kerusakan atau kerugian yang
            timbul dari penggunaan aplikasi ini. Pastikan printer Anda kompatibel
            dengan ESC/POS sebelum menggunakan.
          </Text>
        </View>

        {/* Contact */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>📞 Hubungi Kami</Text>
          <TouchableOpacity
            style={styles.contactBtn}
            onPress={() => Linking.openURL('https://t.me/altomediaindonesia')}
          >
            <Ionicons name="paper-plane" size={20} color="#0088cc" />
            <View>
              <Text style={styles.contactTitle}>Telegram</Text>
              <Text style={styles.contactSub}>@altomediaindonesia</Text>
            </View>
            <Ionicons name="chevron-forward" size={14} color={COLORS.textMuted} />
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
  contentInner: { paddingBottom: 30, gap: 12 },

  card: {
    marginHorizontal: 16,
    backgroundColor: COLORS.bgCard, borderRadius: 24,
    borderWidth: 1, borderColor: COLORS.bgCardBorder, padding: 18,
  },
  cardTitle: { fontSize: 14, fontWeight: '800', color: COLORS.white, marginBottom: 14 },

  label: { fontSize: 10, fontWeight: '700', color: COLORS.textSecondary, marginBottom: 6, marginTop: 8 },
  input: {
    backgroundColor: 'rgba(0,0,0,0.3)', borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)', borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 10,
    color: COLORS.white, fontSize: 12,
  },

  paperRow: { flexDirection: 'row', gap: 10 },
  paperBtn: {
    flex: 1, alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(0,0,0,0.3)', borderRadius: 14,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
    paddingVertical: 16,
  },
  paperBtnActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  paperBtnText: { fontSize: 16, fontWeight: '800', color: COLORS.textMuted },
  paperBtnTextActive: { color: COLORS.white },
  paperBtnSub: { fontSize: 10, color: COLORS.textMuted },

  aboutText: { fontSize: 11, color: COLORS.textSecondary, lineHeight: 18 },

  contactBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: 'rgba(0,136,204,0.1)', borderRadius: 16,
    padding: 14, borderWidth: 1, borderColor: 'rgba(0,136,204,0.2)',
  },
  contactTitle: { fontSize: 12, fontWeight: '700', color: COLORS.white, flex: 1 },
  contactSub: { fontSize: 10, color: '#0088cc' },

  footer: { textAlign: 'center', fontSize: 10, color: COLORS.textMuted, marginTop: 8 },
});
