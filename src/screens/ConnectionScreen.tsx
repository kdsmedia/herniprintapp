import React, { useEffect } from 'react';
import {
  View, Text, TouchableOpacity, FlatList, ActivityIndicator,
  StyleSheet, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';

import { useApp } from '../contexts/AppContext';
import { COLORS } from '../constants/theme';

export default function ConnectionScreen() {
  const navigation = useNavigation();
  const {
    isConnected, printerName,
    isScanning, foundDevices,
    scanForPrinters, stopScan, connectToPrinter, disconnectPrinter,
  } = useApp();

  useEffect(() => {
    // Auto-scan on open
    if (!isConnected) {
      scanForPrinters();
    }
    return () => stopScan();
  }, []);

  const handleConnect = async (deviceId: string, deviceName: string) => {
    stopScan();
    try {
      Alert.alert('Menghubungkan...', `Menghubungkan ke ${deviceName}...`);
      await connectToPrinter(deviceId);
      Alert.alert('Berhasil! ✅', `Terhubung ke ${deviceName}`, [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (e: any) {
      // Error already shown by connectToPrinter
    }
  };

  const handleDisconnect = () => {
    Alert.alert('Putuskan Koneksi?', `Putuskan dari ${printerName}?`, [
      { text: 'Batal' },
      {
        text: 'Putuskan',
        style: 'destructive',
        onPress: async () => {
          await disconnectPrinter();
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Hubungkan <Text style={{ color: COLORS.primaryLight }}>Printer</Text></Text>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.closeBtn}>
          <Ionicons name="close" size={24} color={COLORS.textSecondary} />
        </TouchableOpacity>
      </View>

      {/* Connected Printer */}
      {isConnected && (
        <View style={styles.connectedCard}>
          <View style={styles.connectedInfo}>
            <View style={styles.connectedDot} />
            <View>
              <Text style={styles.connectedName}>{printerName}</Text>
              <Text style={styles.connectedStatus}>Terhubung via Bluetooth</Text>
            </View>
          </View>
          <TouchableOpacity style={styles.disconnectBtn} onPress={handleDisconnect}>
            <Text style={styles.disconnectText}>Putuskan</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Bluetooth Section */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Ionicons name="bluetooth" size={20} color={COLORS.primaryLight} />
          <Text style={styles.sectionTitle}>Bluetooth (BLE)</Text>
          {isScanning && <ActivityIndicator size="small" color={COLORS.primaryLight} />}
        </View>
        <Text style={styles.sectionSub}>
          {isScanning ? 'Mencari printer...' : `${foundDevices.length} perangkat ditemukan`}
        </Text>
      </View>

      {/* Device List */}
      <FlatList
        data={foundDevices}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.deviceItem}
            onPress={() => handleConnect(item.id, item.name)}
            activeOpacity={0.7}
          >
            <View style={styles.deviceIcon}>
              <Ionicons name="print" size={20} color={COLORS.primaryLight} />
            </View>
            <View style={styles.deviceInfo}>
              <Text style={styles.deviceName}>{item.name}</Text>
              <Text style={styles.deviceId}>{item.id}</Text>
            </View>
            <View style={styles.deviceSignal}>
              <Ionicons
                name="wifi"
                size={14}
                color={
                  item.rssi && item.rssi > -60
                    ? COLORS.success
                    : item.rssi && item.rssi > -80
                    ? COLORS.warning
                    : COLORS.textMuted
                }
              />
              <Text style={styles.deviceRssi}>{item.rssi ?? '?'} dBm</Text>
            </View>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          !isScanning ? (
            <View style={styles.empty}>
              <Ionicons name="search" size={48} color={COLORS.textMuted} />
              <Text style={styles.emptyText}>Tidak ada printer ditemukan</Text>
              <Text style={styles.emptySub}>Pastikan printer menyala dan Bluetooth aktif</Text>
            </View>
          ) : null
        }
      />

      {/* Scan Button */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.scanBtn, isScanning && styles.scanBtnScanning]}
          onPress={isScanning ? stopScan : scanForPrinters}
          activeOpacity={0.7}
        >
          <Ionicons
            name={isScanning ? 'stop' : 'search'}
            size={20}
            color={COLORS.white}
          />
          <Text style={styles.scanBtnText}>
            {isScanning ? 'Berhenti' : 'Scan Ulang'}
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bgDark },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 20,
  },
  title: { fontSize: 22, fontWeight: '800', color: COLORS.white },
  closeBtn: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: COLORS.bgCard,
    alignItems: 'center', justifyContent: 'center',
  },
  connectedCard: {
    marginHorizontal: 20,
    marginBottom: 16,
    backgroundColor: 'rgba(34,197,94,0.15)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(34,197,94,0.3)',
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  connectedInfo: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  connectedDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: COLORS.success },
  connectedName: { fontSize: 14, fontWeight: '700', color: COLORS.white },
  connectedStatus: { fontSize: 10, color: COLORS.success, marginTop: 2 },
  disconnectBtn: {
    paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: 10, backgroundColor: 'rgba(239,68,68,0.2)',
  },
  disconnectText: { fontSize: 11, fontWeight: '700', color: COLORS.error },
  section: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.bgCardBorder,
  },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: COLORS.white, flex: 1 },
  sectionSub: { fontSize: 11, color: COLORS.textMuted, marginTop: 4, marginLeft: 28 },
  listContent: { paddingHorizontal: 20, paddingTop: 8 },
  deviceItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.bgCard,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.bgCardBorder,
    padding: 14,
    marginBottom: 8,
    gap: 12,
  },
  deviceIcon: {
    width: 42, height: 42, borderRadius: 12,
    backgroundColor: 'rgba(129,140,248,0.15)',
    alignItems: 'center', justifyContent: 'center',
  },
  deviceInfo: { flex: 1 },
  deviceName: { fontSize: 13, fontWeight: '600', color: COLORS.white },
  deviceId: { fontSize: 9, color: COLORS.textMuted, marginTop: 2 },
  deviceSignal: { alignItems: 'center', gap: 2 },
  deviceRssi: { fontSize: 8, color: COLORS.textMuted },
  empty: { alignItems: 'center', paddingTop: 60, gap: 12 },
  emptyText: { fontSize: 14, fontWeight: '600', color: COLORS.textMuted },
  emptySub: { fontSize: 11, color: COLORS.textMuted, textAlign: 'center', paddingHorizontal: 40 },
  footer: { paddingHorizontal: 20, paddingVertical: 16 },
  scanBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: COLORS.primary,
    borderRadius: 14,
    paddingVertical: 16,
  },
  scanBtnScanning: { backgroundColor: COLORS.error },
  scanBtnText: { fontSize: 14, fontWeight: '700', color: COLORS.white },
});
