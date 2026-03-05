import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, Alert, Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useInterstitialAd } from 'react-native-google-mobile-ads';

import Header from '../components/Header';
import AdBanner from '../components/AdBanner';
import { useApp } from '../contexts/AppContext';
import { COLORS } from '../constants/theme';
import { getAdId } from '../constants/ads';

const APP_VERSION = '2.0.0';

export default function SettingsScreen() {
  const { storeName, setStoreName, storeContact, setStoreContact } = useApp();
  const [nameInput, setNameInput] = useState(storeName);
  const [contactInput, setContactInput] = useState(storeContact);
  const [showAbout, setShowAbout] = useState(false);
  const [showDisclaimer, setShowDisclaimer] = useState(false);

  const { isLoaded, load, show } = useInterstitialAd(getAdId('INTERSTITIAL'), {
    requestNonPersonalizedAdsOnly: false,
  });

  useEffect(() => { load(); }, [load]);

  const showAdThenAction = (action: () => void) => {
    if (isLoaded) {
      show();
      setTimeout(action, 500);
    } else {
      action();
    }
  };

  useEffect(() => { setNameInput(storeName); }, [storeName]);
  useEffect(() => { setContactInput(storeContact); }, [storeContact]);

  const saveName = () => {
    const trimmed = nameInput.trim();
    if (trimmed) {
      setStoreName(trimmed);
      Alert.alert('Tersimpan ✅', `Nama toko diubah menjadi "${trimmed}"`);
    }
  };

  const saveContact = () => {
    const trimmed = contactInput.trim();
    setStoreContact(trimmed);
    Alert.alert('Tersimpan ✅', trimmed ? `Kontak toko: ${trimmed}` : 'Kontak toko dihapus.');
  };

  const openTelegram = () => {
    Linking.openURL('https://t.me/altomediaindonesia').catch(() =>
      Alert.alert('Error', 'Tidak dapat membuka Telegram.')
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Header />
      <ScrollView style={styles.content} contentContainerStyle={styles.contentInner}>
        {/* Store Name */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>
            <Ionicons name="storefront" size={14} color={COLORS.primaryLight} /> Nama Toko
          </Text>
          <Text style={styles.cardSub}>Akan muncul di header cetakan resi dan label (opsional)</Text>
          <View style={styles.inputRow}>
            <TextInput
              style={styles.input}
              placeholder="Nama toko Anda"
              placeholderTextColor={COLORS.textMuted}
              value={nameInput}
              onChangeText={setNameInput}
              maxLength={40}
            />
            <TouchableOpacity style={styles.saveBtn} onPress={saveName}>
              <Text style={styles.saveBtnText}>Simpan</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Store Contact */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>
            <Ionicons name="call" size={14} color={COLORS.primaryLight} /> Kontak Toko
          </Text>
          <Text style={styles.cardSub}>Nomor telepon/WA yang akan dicetak di resi (opsional)</Text>
          <View style={styles.inputRow}>
            <TextInput
              style={styles.input}
              placeholder="08xx-xxxx-xxxx"
              placeholderTextColor={COLORS.textMuted}
              value={contactInput}
              onChangeText={setContactInput}
              keyboardType="phone-pad"
              maxLength={20}
            />
            <TouchableOpacity style={styles.saveBtn} onPress={saveContact}>
              <Text style={styles.saveBtnText}>Simpan</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* About */}
        <TouchableOpacity
          style={styles.menuItem}
          onPress={() => { setShowAbout(!showAbout); setShowDisclaimer(false); }}
          activeOpacity={0.7}
        >
          <View style={styles.menuLeft}>
            <Ionicons name="information-circle" size={22} color={COLORS.primaryLight} />
            <Text style={styles.menuText}>Tentang Aplikasi</Text>
          </View>
          <Ionicons name={showAbout ? 'chevron-up' : 'chevron-down'} size={18} color={COLORS.textMuted} />
        </TouchableOpacity>
        {showAbout && (
          <View style={styles.expandedCard}>
            <Text style={styles.aboutTitle}>HERNIPRINT v{APP_VERSION}</Text>
            <Text style={styles.aboutText}>
              HERNIPRINT adalah aplikasi pencetakan thermal portabel yang dirancang khusus untuk
              para pelaku UMKM, online shop, dan bisnis kecil di Indonesia.{'\n\n'}

              <Text style={styles.bold}>Fitur Utama:</Text>{'\n'}
              • Cetak gambar dari galeri atau kamera{'\n'}
              • Cetak dokumen PDF langsung ke printer thermal{'\n'}
              • Cetak resi pengiriman dengan format profesional{'\n'}
              • Cetak label barang hingga 100 item dengan kalkulasi otomatis{'\n'}
              • Generator QR Code dan Barcode (CODE128){'\n'}
              • Dukungan kertas 58mm dan 80mm{'\n'}
              • Koneksi Bluetooth Low Energy (BLE){'\n'}
              • Pengaturan kontras dan ukuran teks{'\n'}
              • Kustomisasi nama dan kontak toko{'\n\n'}

              <Text style={styles.bold}>Kompatibilitas:</Text>{'\n'}
              • Android 8.0 (Oreo) ke atas{'\n'}
              • Printer thermal Bluetooth (BLE) 58mm/80mm{'\n'}
              • Mendukung sebagian besar merk: Xprinter, Epson, Bixolon, Rongta, dll{'\n\n'}

              <Text style={styles.bold}>Pengembang:</Text>{'\n'}
              Alto Media Indonesia{'\n'}
              Telegram: @altomediaindonesia{'\n\n'}

              Dibuat dengan ❤️ untuk UMKM Indonesia
            </Text>
          </View>
        )}

        {/* Disclaimer */}
        <TouchableOpacity
          style={styles.menuItem}
          onPress={() => { setShowDisclaimer(!showDisclaimer); setShowAbout(false); }}
          activeOpacity={0.7}
        >
          <View style={styles.menuLeft}>
            <Ionicons name="shield-checkmark" size={22} color={COLORS.warning} />
            <Text style={styles.menuText}>Disclaimer</Text>
          </View>
          <Ionicons name={showDisclaimer ? 'chevron-up' : 'chevron-down'} size={18} color={COLORS.textMuted} />
        </TouchableOpacity>
        {showDisclaimer && (
          <View style={styles.expandedCard}>
            <Text style={styles.aboutText}>
              <Text style={styles.bold}>PEMBERITAHUAN PENTING — Harap Dibaca</Text>{'\n\n'}

              1. <Text style={styles.bold}>Kompatibilitas Printer</Text>{'\n'}
              HERNIPRINT dirancang untuk printer thermal yang mendukung protokol ESC/POS
              melalui koneksi Bluetooth Low Energy (BLE). Tidak semua printer thermal
              kompatibel. Hasil cetak dapat bervariasi tergantung merk, model, dan
              firmware printer Anda.{'\n\n'}

              2. <Text style={styles.bold}>Kualitas Cetak</Text>{'\n'}
              Kualitas hasil cetakan dipengaruhi oleh beberapa faktor termasuk resolusi
              printer, kualitas kertas thermal, pengaturan kontras, dan kondisi head
              printer. Pengembang tidak bertanggung jawab atas kualitas cetak yang
              tidak sesuai ekspektasi.{'\n\n'}

              3. <Text style={styles.bold}>Penggunaan Data</Text>{'\n'}
              Semua data yang Anda masukkan (nama penerima, alamat, data barang, dll)
              hanya disimpan secara lokal di perangkat Anda. Kami tidak mengumpulkan,
              mengirim, atau menyimpan data Anda di server manapun.{'\n\n'}

              4. <Text style={styles.bold}>Izin Aplikasi</Text>{'\n'}
              Aplikasi ini memerlukan izin Bluetooth untuk menghubungkan printer,
              izin kamera untuk memfoto dokumen, dan izin penyimpanan untuk mengakses
              gambar/PDF. Semua izin digunakan sesuai fungsinya dan tidak disalahgunakan.{'\n\n'}

              5. <Text style={styles.bold}>Iklan</Text>{'\n'}
              Aplikasi ini menampilkan iklan dari Google AdMob untuk mendukung
              pengembangan berkelanjutan. Iklan yang muncul dikelola oleh Google dan
              bukan tanggung jawab pengembang.{'\n\n'}

              6. <Text style={styles.bold}>Batasan Tanggung Jawab</Text>{'\n'}
              Aplikasi ini disediakan "sebagaimana adanya" (as-is) tanpa jaminan
              apapun. Pengembang tidak bertanggung jawab atas kerugian langsung maupun
              tidak langsung yang timbul dari penggunaan aplikasi ini, termasuk namun
              tidak terbatas pada kerusakan printer, kehilangan data, atau kerugian bisnis.{'\n\n'}

              7. <Text style={styles.bold}>Hak Cipta</Text>{'\n'}
              © 2024-2026 Alto Media Indonesia. Seluruh hak dilindungi undang-undang.
              HERNIPRINT dan logonya merupakan merek dagang terdaftar dari
              Alto Media Indonesia.{'\n\n'}

              Dengan menggunakan aplikasi ini, Anda dianggap telah membaca, memahami,
              dan menyetujui seluruh ketentuan di atas.
            </Text>
          </View>
        )}

        {/* Telegram */}
        <TouchableOpacity style={styles.telegramBtn} onPress={openTelegram} activeOpacity={0.7}>
          <Ionicons name="paper-plane" size={22} color="#ffffff" />
          <View>
            <Text style={styles.telegramTitle}>Hubungi Kami di Telegram</Text>
            <Text style={styles.telegramSub}>@altomediaindonesia — Bantuan & Saran</Text>
          </View>
          <Ionicons name="open-outline" size={16} color="rgba(255,255,255,0.6)" />
        </TouchableOpacity>

        {/* App Info Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>HERNIPRINT v{APP_VERSION}</Text>
          <Text style={styles.footerText}>© 2024-2026 Alto Media Indonesia</Text>
          <Text style={styles.footerText}>Dibuat untuk UMKM Indonesia 🇮🇩</Text>
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
  card: {
    marginHorizontal: 20,
    marginTop: 12,
    backgroundColor: COLORS.bgCard,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.bgCardBorder,
    padding: 16,
  },
  cardTitle: { fontSize: 14, fontWeight: '700', color: COLORS.white, marginBottom: 4 },
  cardSub: { fontSize: 10, color: COLORS.textMuted, marginBottom: 12 },
  inputRow: { flexDirection: 'row', gap: 8 },
  input: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    padding: 10,
    color: COLORS.white,
    fontSize: 13,
  },
  saveBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: 10,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBtnText: { fontSize: 12, fontWeight: '700', color: COLORS.white },
  menuItem: {
    marginHorizontal: 20,
    marginTop: 8,
    backgroundColor: COLORS.bgCard,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.bgCardBorder,
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  menuLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  menuText: { fontSize: 14, fontWeight: '600', color: COLORS.white },
  expandedCard: {
    marginHorizontal: 20,
    marginTop: 2,
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.bgCardBorder,
    padding: 20,
  },
  aboutTitle: { fontSize: 16, fontWeight: '800', color: COLORS.primaryLight, marginBottom: 12 },
  aboutText: { fontSize: 12, lineHeight: 20, color: COLORS.textSecondary },
  bold: { fontWeight: '700', color: COLORS.white },
  telegramBtn: {
    marginHorizontal: 20,
    marginTop: 16,
    backgroundColor: '#0088cc',
    borderRadius: 16,
    padding: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  telegramTitle: { fontSize: 14, fontWeight: '700', color: '#ffffff', flex: 1 },
  telegramSub: { fontSize: 10, color: 'rgba(255,255,255,0.7)', marginTop: 2 },
  footer: {
    marginTop: 30,
    paddingHorizontal: 20,
    alignItems: 'center',
    gap: 4,
  },
  footerText: { fontSize: 10, color: COLORS.textMuted },
});
