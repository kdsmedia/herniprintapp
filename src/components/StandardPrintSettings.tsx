/**
 * StandardPrintSettings — Professional settings panel for standard/color printers
 * Paper size, quality, orientation, paper type, border mode, color mode, copies
 */
import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../constants/theme';
import {
  getPaperDimensions,
} from '../utils/standardPrint';
import type {
  StandardPrintSettings as Settings,
  PaperSize, PrintQuality, Orientation, PaperType, BorderMode, ColorMode,
} from '../utils/standardPrint';

interface Props {
  settings: Settings;
  onChange: (settings: Settings) => void;
}

// ─── Option Data ──────────────────────────────────────────
interface Option<T> { value: T; label: string; icon?: string; desc?: string }

const PAPER_SIZES: Option<PaperSize>[] = [
  { value: 'A4', label: 'A4', desc: '210×297' },
  { value: 'A3', label: 'A3', desc: '297×420' },
  { value: 'A5', label: 'A5', desc: '148×210' },
  { value: 'B5', label: 'B5', desc: '176×250' },
  { value: 'Letter', label: 'Letter', desc: '8.5×11"' },
  { value: 'Legal', label: 'Legal', desc: '8.5×14"' },
  { value: '4x6', label: '4×6"', desc: 'Foto' },
  { value: '5x7', label: '5×7"', desc: 'Foto' },
  { value: '10x15', label: '10×15', desc: 'cm' },
  { value: '13x18', label: '13×18', desc: 'cm' },
];

const QUALITIES: Option<PrintQuality>[] = [
  { value: 'draft', label: 'Draft', icon: 'flash-outline', desc: '150 DPI' },
  { value: 'standard', label: 'Standard', icon: 'checkmark-circle-outline', desc: '300 DPI' },
  { value: 'high', label: 'High', icon: 'star', desc: '600 DPI' },
];

const ORIENTATIONS: Option<Orientation>[] = [
  { value: 'portrait', label: 'Portrait', icon: 'phone-portrait-outline' },
  { value: 'landscape', label: 'Landscape', icon: 'phone-landscape-outline' },
];

const PAPER_TYPES: Option<PaperType>[] = [
  { value: 'plain', label: 'Plain', desc: 'HVS Biasa' },
  { value: 'matte', label: 'Matte', desc: 'Doff' },
  { value: 'glossy', label: 'Glossy', desc: 'Mengkilap' },
  { value: 'photo', label: 'Photo', desc: 'Foto Premium' },
  { value: 'cardstock', label: 'Karton', desc: 'Tebal' },
  { value: 'envelope', label: 'Amplop', desc: 'Surat' },
  { value: 'label', label: 'Stiker', desc: 'Label' },
];

const BORDER_MODES: Option<BorderMode>[] = [
  { value: 'bordered', label: 'Border 8mm', icon: 'square-outline' },
  { value: 'borderless', label: 'Tanpa Border', icon: 'expand-outline' },
];

const COLOR_MODES: Option<ColorMode>[] = [
  { value: 'color', label: 'Warna', icon: 'color-palette' },
  { value: 'grayscale', label: 'Hitam Putih', icon: 'contrast' },
];

// ─── Chip Component ──────────────────────────────────────
function Chip<T extends string>({
  opt,
  selected,
  onPress,
  compact,
}: {
  opt: Option<T>;
  selected: boolean;
  onPress: () => void;
  compact?: boolean;
}) {
  return (
    <TouchableOpacity
      style={[st.chip, selected && st.chipActive, compact && { paddingHorizontal: 8 }]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      {opt.icon && (
        <Ionicons name={opt.icon as any} size={compact ? 11 : 13} color={selected ? '#fff' : COLORS.textMuted} />
      )}
      <View>
        <Text style={[st.chipTxt, selected && st.chipTxtActive, compact && { fontSize: 9 }]}>
          {opt.label}
        </Text>
        {opt.desc && !compact && (
          <Text style={[st.chipDesc, selected && { color: 'rgba(255,255,255,0.7)' }]}>
            {opt.desc}
          </Text>
        )}
      </View>
    </TouchableOpacity>
  );
}

// ─── Section Row ─────────────────────────────────────────
function Section<T extends string>({
  label,
  options,
  selected,
  onSelect,
  compact,
}: {
  label: string;
  options: Option<T>[];
  selected: T;
  onSelect: (v: T) => void;
  compact?: boolean;
}) {
  return (
    <View style={st.section}>
      <Text style={st.sectionLabel}>{label}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={st.chipRow}>
          {options.map((opt) => (
            <Chip
              key={opt.value}
              opt={opt}
              selected={selected === opt.value}
              onPress={() => onSelect(opt.value)}
              compact={compact}
            />
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

// ─── Main Component ──────────────────────────────────────
export default function StandardPrintSettingsPanel({ settings, onChange }: Props) {
  const update = <K extends keyof Settings>(key: K, value: Settings[K]) => {
    onChange({ ...settings, [key]: value });
  };

  const paper = getPaperDimensions(settings.paperSize);
  const isLandscape = settings.orientation === 'landscape';
  const displayW = isLandscape ? paper.h : paper.w;
  const displayH = isLandscape ? paper.w : paper.h;

  return (
    <View style={st.container}>
      {/* Header with info summary */}
      <View style={st.header}>
        <View style={st.headerLeft}>
          <Ionicons name="print" size={16} color="#10b981" />
          <Text style={st.headerTxt}>PENGATURAN PRINTER BESAR</Text>
        </View>
      </View>

      {/* Live settings summary */}
      <View style={st.summary}>
        <View style={st.summaryItem}>
          <Ionicons name="document-outline" size={12} color={COLORS.primaryLight} />
          <Text style={st.summaryTxt}>{settings.paperSize} {displayW}×{displayH}mm</Text>
        </View>
        <View style={st.summaryItem}>
          <Ionicons name="sparkles-outline" size={12} color={COLORS.primaryLight} />
          <Text style={st.summaryTxt}>{settings.quality === 'high' ? '600' : settings.quality === 'standard' ? '300' : '150'} DPI</Text>
        </View>
        <View style={st.summaryItem}>
          <Ionicons name={settings.colorMode === 'color' ? 'color-palette' : 'contrast'} size={12} color={COLORS.primaryLight} />
          <Text style={st.summaryTxt}>{settings.colorMode === 'color' ? 'Warna' : 'B/W'}</Text>
        </View>
        <View style={st.summaryItem}>
          <Ionicons name="copy-outline" size={12} color={COLORS.primaryLight} />
          <Text style={st.summaryTxt}>{settings.copies}×</Text>
        </View>
      </View>

      {/* Settings */}
      <Section label="📄 Ukuran Kertas" options={PAPER_SIZES} selected={settings.paperSize} onSelect={(v) => update('paperSize', v)} compact />
      <Section label="🎨 Mode Warna" options={COLOR_MODES} selected={settings.colorMode} onSelect={(v) => update('colorMode', v)} />
      <Section label="✨ Kualitas Cetak" options={QUALITIES} selected={settings.quality} onSelect={(v) => update('quality', v)} />
      <Section label="📐 Orientasi" options={ORIENTATIONS} selected={settings.orientation} onSelect={(v) => update('orientation', v)} />
      <Section label="📋 Tipe Kertas" options={PAPER_TYPES} selected={settings.paperType} onSelect={(v) => update('paperType', v)} compact />
      <Section label="🖼️ Border" options={BORDER_MODES} selected={settings.borderMode} onSelect={(v) => update('borderMode', v)} />

      {/* Copies */}
      <View style={st.copiesSection}>
        <Text style={st.sectionLabel}>📑 Jumlah Copy</Text>
        <View style={st.copiesControls}>
          <TouchableOpacity
            style={[st.copyBtn, settings.copies <= 1 && { opacity: 0.3 }]}
            onPress={() => update('copies', Math.max(1, settings.copies - 1))}
            disabled={settings.copies <= 1}
          >
            <Ionicons name="remove" size={16} color="#fff" />
          </TouchableOpacity>
          <Text style={st.copyCount}>{settings.copies}</Text>
          <TouchableOpacity
            style={st.copyBtn}
            onPress={() => update('copies', Math.min(99, settings.copies + 1))}
          >
            <Ionicons name="add" size={16} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────
const st = StyleSheet.create({
  container: {
    backgroundColor: COLORS.bgCard,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(16,185,129,0.3)',
    padding: 14,
    gap: 10,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  headerTxt: {
    fontSize: 10,
    fontWeight: '800',
    color: '#10b981',
    letterSpacing: 0.5,
  },
  // Summary bar
  summary: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderRadius: 10,
    padding: 8,
  },
  summaryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  summaryTxt: {
    fontSize: 9,
    fontWeight: '700',
    color: COLORS.textSecondary,
  },
  // Sections
  section: { gap: 6 },
  sectionLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.textSecondary,
  },
  chipRow: {
    flexDirection: 'row',
    gap: 6,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 10,
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  chipActive: {
    backgroundColor: '#059669',
    borderColor: '#10b981',
  },
  chipTxt: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.textMuted,
  },
  chipTxtActive: { color: '#fff' },
  chipDesc: {
    fontSize: 8,
    color: 'rgba(255,255,255,0.25)',
    marginTop: 1,
  },
  // Copies
  copiesSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  copiesControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  copyBtn: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: '#059669',
    alignItems: 'center',
    justifyContent: 'center',
  },
  copyCount: {
    fontSize: 18,
    fontWeight: '900',
    color: '#fff',
    minWidth: 28,
    textAlign: 'center',
  },
});
