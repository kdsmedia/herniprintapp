import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
// Using native Slider from @react-native-community/slider
import Slider from '@react-native-community/slider';
import { useApp } from '../contexts/AppContext';
import { COLORS, PaperWidth } from '../constants/theme';

export default function PaperSettings() {
  const { paperWidth, setPaperWidth, contrast, setContrast } = useApp();

  return (
    <View style={styles.container}>
      <View style={styles.row}>
        <Text style={styles.label}>Kertas</Text>
        <View style={styles.toggleGroup}>
          <TouchableOpacity
            style={[styles.toggleBtn, paperWidth === 58 && styles.toggleActive]}
            onPress={() => setPaperWidth(58)}
          >
            <Text style={[styles.toggleText, paperWidth === 58 && styles.toggleTextActive]}>
              58mm
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.toggleBtn, paperWidth === 80 && styles.toggleActive]}
            onPress={() => setPaperWidth(80)}
          >
            <Text style={[styles.toggleText, paperWidth === 80 && styles.toggleTextActive]}>
              80mm
            </Text>
          </TouchableOpacity>
        </View>
      </View>
      
      <View style={styles.row}>
        <Text style={styles.label}>Kontras</Text>
        <View style={styles.sliderRow}>
          <Slider
            style={styles.slider}
            minimumValue={50}
            maximumValue={200}
            step={10}
            value={contrast}
            onSlidingComplete={(v) => setContrast(v)}
            minimumTrackTintColor={COLORS.primaryLight}
            maximumTrackTintColor={COLORS.textMuted}
            thumbTintColor={COLORS.primaryLight}
          />
          <Text style={styles.sliderValue}>{contrast}%</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.bgCard,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.bgCardBorder,
    padding: 16,
    marginHorizontal: 20,
    marginBottom: 12,
    gap: 12,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  label: { fontSize: 11, fontWeight: '700', color: COLORS.textSecondary, textTransform: 'uppercase' },
  toggleGroup: { flexDirection: 'row', gap: 8 },
  toggleBtn: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  toggleActive: { backgroundColor: COLORS.primary },
  toggleText: { fontSize: 12, fontWeight: '700', color: COLORS.textMuted },
  toggleTextActive: { color: COLORS.white },
  sliderRow: { flexDirection: 'row', alignItems: 'center', flex: 1, marginLeft: 12 },
  slider: { flex: 1, height: 30 },
  sliderValue: { fontSize: 11, fontWeight: '700', color: COLORS.primaryLight, width: 40, textAlign: 'right' },
});
