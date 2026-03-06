/**
 * StandardPrintSettings — Settings panel for standard/color printers
 * Paper size, quality, orientation, paper type, border mode
 */
import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../constants/theme';
import type {
  StandardPrintSettings as Settings,
  PaperSize, PrintQuality, Orientation, PaperType, BorderMode,
} from '../utils/standardPrint';

interface Props {
  settings: Settings;
  onChange: (settings: Settings) => void;
}

interface OptionItem<T> {
  value: T;
  label: string;
  icon?: string;
}

const PAPER_SIZES: OptionItem<PaperSize>[] = [
  { value: 'A4', label: 'A4', icon: 'document' },
  { value: 'A3', label: 'A3', icon: 'document' },
  { value: 'A5', label: 'A5', icon: 'document' },
  { value: 'Letter', label: 'Letter', icon: 'document' },
  { value: 'Legal', label: 'Legal', icon: 'document' },
  { value: '4x6', label: '4×6"', icon: 'image' },
  { value: '5x7', label: '5×7"', icon: 'image' },
  { value: '10x15', label: '10×15cm', icon: 'image' },
];

const QUALITIES: OptionItem<PrintQuality>[] = [
  { value: 'draft', label: 'Draft', icon: 'flash' },
  { value: 'standard', label: 'Standard', icon: 'checkmark-circle' },
  { value: 'high', label: 'High Quality', icon: 'star' },
];

const ORIENTATIONS: OptionItem<Orientation>[] = [
  { value: 'portrait', label: 'Portrait', icon: 'phone-portrait' },
  { value: 'landscape', label: 'Landscape', icon: 'phone-landscape' },
];

const PAPER_TYPES: OptionItem<PaperType>[] = [
  { value: 'plain', label: 'Plain' },
  { value: 'matte', label: 'Matte' },
  { value: 'glossy', label: 'Glossy' },
  { value: 'photo', label: 'Photo Paper' },
  { value: 'cardstock', label: 'Cardstock' },
];

const BORDER_MODES: OptionItem<BorderMode>[] = [
  { value: 'bordered', label: 'Dengan Border', icon: 'square' },
  { value: 'borderless', label: 'Borderless', icon: 'expand' },
];

function OptionRow<T extends string>({
  label,
  options,
  selected,
  onSelect,
}: {
  label: string;
  options: OptionItem<T>[];
  selected: T;
  onSelect: (val: T) => void;
}) {
  return (
    <View style={s.optionRow}>
      <Text style={s.optionLabel}>{label}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.optionScroll}>
        <View style={s.optionList}>
          {options.map((opt) => (
            <TouchableOpacity
              key={opt.value}
              style={[s.optionBtn, selected === opt.value && s.optionBtnActive]}
              onPress={() => onSelect(opt.value)}
              activeOpacity={0.7}
            >
              {opt.icon && (
                <Ionicons
                  name={opt.icon as any}
                  size={12}
                  color={selected === opt.value ? '#fff' : COLORS.textMuted}
                />
              )}
              <Text style={[s.optionTxt, selected === opt.value && s.optionTxtActive]}>
                {opt.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

export default function StandardPrintSettingsPanel({ settings, onChange }: Props) {
  const update = <K extends keyof Settings>(key: K, value: Settings[K]) => {
    onChange({ ...settings, [key]: value });
  };

  return (
    <View style={s.container}>
      <View style={s.header}>
        <Ionicons name="settings" size={14} color={COLORS.primaryLight} />
        <Text style={s.headerTxt}>PENGATURAN CETAK</Text>
      </View>

      <OptionRow
        label="📄 Ukuran Kertas"
        options={PAPER_SIZES}
        selected={settings.paperSize}
        onSelect={(v) => update('paperSize', v)}
      />

      <OptionRow
        label="✨ Kualitas"
        options={QUALITIES}
        selected={settings.quality}
        onSelect={(v) => update('quality', v)}
      />

      <OptionRow
        label="📐 Orientasi"
        options={ORIENTATIONS}
        selected={settings.orientation}
        onSelect={(v) => update('orientation', v)}
      />

      <OptionRow
        label="📋 Tipe Kertas"
        options={PAPER_TYPES}
        selected={settings.paperType}
        onSelect={(v) => update('paperType', v)}
      />

      <OptionRow
        label="🖼️ Border"
        options={BORDER_MODES}
        selected={settings.borderMode}
        onSelect={(v) => update('borderMode', v)}
      />

      {/* Copies */}
      <View style={s.copiesRow}>
        <Text style={s.optionLabel}>📑 Jumlah Copy</Text>
        <View style={s.copiesBtns}>
          <TouchableOpacity
            style={s.copyBtn}
            onPress={() => update('copies', Math.max(1, settings.copies - 1))}
          >
            <Ionicons name="remove" size={14} color="#fff" />
          </TouchableOpacity>
          <Text style={s.copyCount}>{settings.copies}</Text>
          <TouchableOpacity
            style={s.copyBtn}
            onPress={() => update('copies', Math.min(99, settings.copies + 1))}
          >
            <Ionicons name="add" size={14} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    backgroundColor: COLORS.bgCard,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.bgCardBorder,
    padding: 14,
    gap: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 2,
  },
  headerTxt: {
    fontSize: 10,
    fontWeight: '800',
    color: COLORS.primaryLight,
    letterSpacing: 1,
  },
  optionRow: {
    gap: 6,
  },
  optionLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.textSecondary,
  },
  optionScroll: {
    flexGrow: 0,
  },
  optionList: {
    flexDirection: 'row',
    gap: 6,
  },
  optionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  optionBtnActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primaryLight,
  },
  optionTxt: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.textMuted,
  },
  optionTxtActive: {
    color: '#fff',
  },
  copiesRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  copiesBtns: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  copyBtn: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  copyCount: {
    fontSize: 16,
    fontWeight: '900',
    color: '#fff',
    minWidth: 24,
    textAlign: 'center',
  },
});
