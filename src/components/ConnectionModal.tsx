import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, Modal, FlatList, ActivityIndicator,
  StyleSheet, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../contexts/AppContext';
import { COLORS } from '../constants/theme';
import {
  requestBluetoothPermissions,
  scanForPrinters,
  stopScan,
  PrinterDevice,
} from '../utils/bluetooth';

interface Props {
  visible: boolean;
  onClose: () => void;
}

export default function ConnectionModal({ visible, onClose }: Props) {
  const { isConnected, connectedDeviceName, connectDevice, disconnect } = useApp();
  const [scanning, setScanning] = useState(false);
  const [devices, setDevices] = useState<PrinterDevice[]>([]);
  const [connecting, setConnecting] = useState<string | null>(null);

  const startBLEScan = useCallback(async () => {
    const granted = await requestBluetoothPermissions();
    if (!granted) {
      Alert.alert('Izin Ditolak', 'Izinkan Bluetooth & Lokasi untuk mendeteksi printer.');
      return;
    }

    setDevices([]);
    setScanning(true);

    const stopFn = scanForPrinters(
      (device) => {
        setDevices((prev) => {
          if (prev.find((d) => d.id === device.id)) return prev;
          return [...prev, device];
        });
      },
      (error) => {
        Alert.alert('Error', error);
        setScanning(false);
      }
    );

    // Stop after 15 seconds
    setTimeout(() => {
      stopFn();
      setScanning(false);
    }, 15000);
  }, []);

  const handleConnect = useCallback(
    async (device: PrinterDevice) => {
      stopScan();
      setScanning(false);
      setConnecting(device.id);

      try {
        await connectDevice(device);
        Alert.alert('Terhubung ✅', `Printer ${device.name} berhasil dihubungkan.`);
        onClose();
      } catch (e: any) {
        Alert.alert('Gagal', e.message || 'Gagal menghubungkan printer.');
      } finally {
        setConnecting(null);
      }
    },
    [connectDevice, onClose]
  );

  const handleDisconnect = useCallback(async () => {
    await disconnect();
    Alert.alert('Terputus', 'Printer telah diputuskan.');
  }, [disconnect]);

  useEffect(() => {
    if (!visible) {
      stopScan();
      setScanning(false);
    }
  }, [visible]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
            <Ionicons name="close" size={18} color="#9ca3af" />
          </TouchableOpacity>

          <Text style={styles.title}>
            Hubungkan <Text style={{ color: COLORS.primaryLight }}>Printer</Text>
          </Text>
          <Text style={styles.subtitle}>Pilih jenis koneksi printer thermal Anda.</Text>

          {/* Current connection */}
          {isConnected && (
            <View style={styles.connectedCard}>
              <View style={styles.connectedInfo}>
                <Ionicons name="checkmark-circle" size={20} color={COLORS.success} />
                <Text style={styles.connectedText}>{connectedDeviceName}</Text>
              </View>
              <TouchableOpacity style={styles.disconnectBtn} onPress={handleDisconnect}>
                <Text style={styles.disconnectText}>PUTUS</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Bluetooth Scan Button */}
          <TouchableOpacity style={styles.btBtn} onPress={startBLEScan} activeOpacity={0.8}>
            <View style={styles.btIconBox}>
              <Ionicons name="bluetooth" size={22} color={COLORS.white} />
            </View>
            <View style={styles.btInfo}>
              <Text style={styles.btTitle}>Bluetooth</Text>
              <Text style={styles.btSubtitle}>Direkomendasikan untuk Mobile</Text>
            </View>
            {scanning ? (
              <ActivityIndicator size="small" color={COLORS.white} />
            ) : (
              <Ionicons name="chevron-forward" size={14} color="rgba(255,255,255,0.5)" />
            )}
          </TouchableOpacity>

          {/* USB Button */}
          <TouchableOpacity style={styles.usbBtn} activeOpacity={0.8}
            onPress={() => Alert.alert('USB/OTG', 'Hubungkan printer via kabel USB OTG. Printer akan terdeteksi otomatis saat dihubungkan.')}>
            <View style={styles.usbIconBox}>
              <Ionicons name="flash" size={22} color={COLORS.white} />
            </View>
            <View style={styles.btInfo}>
              <Text style={styles.btTitle}>USB / OTG</Text>
              <Text style={styles.btSubtitle}>Sangat Stabil untuk PC/Laptop</Text>
            </View>
            <Ionicons name="chevron-forward" size={14} color="rgba(255,255,255,0.3)" />
          </TouchableOpacity>

          {/* Device List */}
          {devices.length > 0 && (
            <View style={styles.deviceList}>
              <Text style={styles.deviceListTitle}>Perangkat Terdeteksi</Text>
              <FlatList
                data={devices}
                keyExtractor={(d) => d.id}
                style={{ maxHeight: 200 }}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={styles.deviceItem}
                    onPress={() => handleConnect(item)}
                    disabled={connecting !== null}
                  >
                    <Ionicons name="print" size={16} color={COLORS.primaryLight} />
                    <Text style={styles.deviceName}>{item.name}</Text>
                    {connecting === item.id ? (
                      <ActivityIndicator size="small" color={COLORS.primaryLight} />
                    ) : (
                      <Text style={styles.connectLabel}>HUBUNGKAN</Text>
                    )}
                  </TouchableOpacity>
                )}
              />
            </View>
          )}

          {scanning && devices.length === 0 && (
            <View style={styles.scanningInfo}>
              <ActivityIndicator size="small" color={COLORS.primaryLight} />
              <Text style={styles.scanningText}>Mencari printer...</Text>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.85)',
    alignItems: 'center', justifyContent: 'center', padding: 20,
  },
  card: {
    width: '100%', maxWidth: 380,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 32, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)',
    padding: 32,
  },
  closeBtn: { position: 'absolute', top: 24, right: 24, zIndex: 1 },
  title: { fontSize: 22, fontWeight: '700', color: COLORS.white, marginBottom: 4 },
  subtitle: { fontSize: 11, color: '#9ca3af', marginBottom: 24 },

  connectedCard: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: 'rgba(34,197,94,0.15)', borderRadius: 16,
    borderWidth: 1, borderColor: 'rgba(34,197,94,0.3)',
    padding: 14, marginBottom: 16,
  },
  connectedInfo: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  connectedText: { fontSize: 12, fontWeight: '700', color: COLORS.success },
  disconnectBtn: { backgroundColor: 'rgba(239,68,68,0.2)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  disconnectText: { fontSize: 9, fontWeight: '800', color: COLORS.error },

  btBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: COLORS.primary, borderRadius: 20,
    padding: 16, marginBottom: 12,
  },
  btIconBox: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center', justifyContent: 'center',
  },
  btInfo: { flex: 1 },
  btTitle: { fontSize: 12, fontWeight: '700', color: COLORS.white },
  btSubtitle: { fontSize: 9, color: 'rgba(255,255,255,0.6)' },

  usbBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 20, padding: 16, marginBottom: 12,
  },
  usbIconBox: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center', justifyContent: 'center',
  },

  deviceList: {
    backgroundColor: 'rgba(0,0,0,0.4)', borderRadius: 16,
    padding: 14, marginTop: 8,
  },
  deviceListTitle: {
    fontSize: 9, fontWeight: '800', color: COLORS.primaryLight,
    textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10,
  },
  deviceItem: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  deviceName: { flex: 1, fontSize: 12, fontWeight: '700', color: COLORS.white },
  connectLabel: {
    fontSize: 9, fontWeight: '800', color: COLORS.white,
    backgroundColor: 'rgba(255,255,255,0.15)', paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: 8, overflow: 'hidden',
  },

  scanningInfo: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 10, marginTop: 16,
  },
  scanningText: { fontSize: 11, color: COLORS.textSecondary },
});
