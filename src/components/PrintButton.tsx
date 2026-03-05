import React, { useState } from 'react';
import { TouchableOpacity, ActivityIndicator, StyleSheet, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../contexts/AppContext';
import { COLORS } from '../constants/theme';
import { useNavigation } from '@react-navigation/native';

interface Props {
  onPrint: () => Promise<void>;
}

export default function PrintButton({ onPrint }: Props) {
  const { isConnected } = useApp();
  const navigation = useNavigation<any>();
  const [isPrinting, setIsPrinting] = useState(false);

  const handlePress = async () => {
    if (isPrinting) return;
    
    if (!isConnected) {
      Alert.alert(
        'Printer Belum Terhubung',
        'Hubungkan printer Bluetooth terlebih dahulu.',
        [
          { text: 'Batal', style: 'cancel' },
          { text: 'Hubungkan', onPress: () => navigation.navigate('Connection') },
        ]
      );
      return;
    }

    setIsPrinting(true);
    try {
      await onPrint();
      Alert.alert('Berhasil', 'Dokumen berhasil dicetak! 🖨️');
    } catch (e: any) {
      Alert.alert('Cetak Gagal', e.message || 'Terjadi kesalahan saat mencetak.');
    } finally {
      setIsPrinting(false);
    }
  };

  return (
    <TouchableOpacity
      style={[styles.button, isPrinting && styles.buttonDisabled]}
      onPress={handlePress}
      activeOpacity={0.8}
      disabled={isPrinting}
    >
      {isPrinting ? (
        <ActivityIndicator color={COLORS.white} size="large" />
      ) : (
        <Ionicons name="flash" size={32} color={COLORS.white} />
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginVertical: 16,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 10,
  },
  buttonDisabled: { opacity: 0.5 },
});
