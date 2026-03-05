import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useApp } from '../contexts/AppContext';
import { COLORS } from '../constants/theme';

export default function Header() {
  const { isConnected, printerName } = useApp();
  const navigation = useNavigation<any>();

  return (
    <View style={styles.container}>
      <View style={styles.left}>
        <View style={styles.logoBox}>
          <Ionicons name="print" size={28} color={COLORS.primary} />
        </View>
        <View>
          <Text style={styles.title}>
            HERNI<Text style={styles.titleGradient}>PRINT</Text>
          </Text>
          <View style={styles.statusRow}>
            <View
              style={[
                styles.statusDot,
                { backgroundColor: isConnected ? COLORS.success : COLORS.error },
              ]}
            />
            <Text
              style={[
                styles.statusText,
                { color: isConnected ? COLORS.success : COLORS.textSecondary },
              ]}
            >
              {isConnected ? printerName : 'Terputus'}
            </Text>
          </View>
        </View>
      </View>

      <TouchableOpacity
        style={styles.connectBtn}
        onPress={() => navigation.navigate('Connection')}
        activeOpacity={0.7}
      >
        <Ionicons
          name={isConnected ? 'bluetooth' : 'bluetooth-outline'}
          size={20}
          color={isConnected ? COLORS.success : COLORS.primaryLight}
        />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 12,
  },
  left: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  logoBox: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: COLORS.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontSize: 20, fontWeight: '900', color: COLORS.white },
  titleGradient: { color: COLORS.primaryLight },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: 9, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1 },
  connectBtn: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: COLORS.bgCard,
    borderWidth: 1,
    borderColor: COLORS.bgCardBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
