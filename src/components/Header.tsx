import React from 'react';
import { View, Text, TouchableOpacity, Image, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../contexts/AppContext';
import { COLORS } from '../constants/theme';

export default function Header({ onConnectionPress }: { onConnectionPress?: () => void }) {
  const { isConnected, connectedDeviceName } = useApp();

  return (
    <View style={styles.container}>
      <View style={styles.left}>
        <View style={styles.logoBox}>
          <Image source={require('../../assets/logo.png')} style={styles.logo} resizeMode="contain" />
        </View>
        <View>
          <Text style={styles.title}>
            HERNI<Text style={styles.titleGradient}>PRINT</Text>
          </Text>
          <View style={styles.statusRow}>
            <View style={[styles.dot, isConnected ? styles.dotGreen : styles.dotRed]} />
            <Text style={[styles.statusText, isConnected && styles.statusTextGreen]}>
              {isConnected ? connectedDeviceName || 'Terhubung' : 'Terputus'}
            </Text>
          </View>
        </View>
      </View>
      <TouchableOpacity style={styles.settingsBtn} onPress={onConnectionPress} activeOpacity={0.7}>
        <Ionicons name="link" size={20} color={COLORS.primaryLight} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 12,
  },
  left: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  logoBox: {
    width: 50, height: 50, backgroundColor: COLORS.white,
    borderRadius: 16, alignItems: 'center', justifyContent: 'center',
    padding: 4, elevation: 8,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8,
  },
  logo: { width: '100%', height: '100%' },
  title: { fontSize: 22, fontWeight: '900', color: COLORS.white, letterSpacing: -0.5 },
  titleGradient: { color: COLORS.primaryLight },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
  dot: { width: 7, height: 7, borderRadius: 4 },
  dotRed: { backgroundColor: '#ef4444' },
  dotGreen: { backgroundColor: '#22c55e' },
  statusText: { fontSize: 9, fontWeight: '700', color: COLORS.primaryLight, textTransform: 'uppercase', letterSpacing: 2 },
  statusTextGreen: { color: '#22c55e' },
  settingsBtn: {
    width: 44, height: 44, borderRadius: 16,
    backgroundColor: COLORS.bgCard, borderWidth: 1, borderColor: COLORS.bgCardBorder,
    alignItems: 'center', justifyContent: 'center',
  },
});
