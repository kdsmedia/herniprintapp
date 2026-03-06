/**
 * StandardPrintSettings — Professional Printer Dialog
 * Mimics HP/Canon/Epson printer software UI
 * Grouped tabs: Tata Letak | Kertas | Kualitas | Lanjutan
 */
import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Slider from '@react-native-community/slider';
import { COLORS } from '../constants/theme';
import { getPaperDimensions } from '../utils/standardPrint';
import type {
  StandardPrintSettings as Settings,
  PaperSize, PrintQuality, Orientation, PaperType, BorderMode, ColorMode, ScaleMode, DuplexMode,
} from '../utils/standardPrint';

interface Props {
  settings: Settings;
  onChange: (s: Settings) => void;
}

type DialogTab = 'layout' | 'paper' | 'quality' | 'advanced';

// ─── Option chip data ────────────────────────────────────
interface Opt<T> { value: T; label: string; icon?: string; sub?: string }

const PAPER_SIZES: Opt<PaperSize>[] = [
  { value: 'A4', label: 'A4', sub: '210×297mm' },
  { value: 'A3', label: 'A3', sub: '297×420mm' },
  { value: 'A5', label: 'A5', sub: '148×210mm' },
  { value: 'B5', label: 'B5', sub: '176×250mm' },
  { value: 'Letter', label: 'Letter', sub: '8.5×11"' },
  { value: 'Legal', label: 'Legal', sub: '8.5×14"' },
  { value: '4x6', label: '4×6"', sub: 'Foto' },
  { value: '5x7', label: '5×7"', sub: 'Foto' },
  { value: '10x15', label: '10×15cm', sub: 'Foto' },
  { value: '13x18', label: '13×18cm', sub: 'Foto' },
];

const QUALITIES: Opt<PrintQuality>[] = [
  { value: 'draft', label: 'Draft', icon: 'flash-outline', sub: '150 DPI • Cepat' },
  { value: 'standard', label: 'Normal', icon: 'checkmark-circle-outline', sub: '300 DPI • Standar' },
  { value: 'high', label: 'Tinggi', icon: 'star-outline', sub: '600 DPI • Detail' },
  { value: 'photo', label: 'Foto', icon: 'image-outline', sub: '1200 DPI • Premium' },
];

const PAPER_TYPES: Opt<PaperType>[] = [
  { value: 'plain', label: 'HVS Biasa', sub: 'Plain Paper' },
  { value: 'matte', label: 'Matte/Doff', sub: 'Matte Paper' },
  { value: 'glossy', label: 'Glossy', sub: 'Mengkilap' },
  { value: 'photo', label: 'Kertas Foto', sub: 'Photo Paper' },
  { value: 'cardstock', label: 'Karton', sub: 'Cardstock' },
  { value: 'envelope', label: 'Amplop', sub: 'Envelope' },
  { value: 'label', label: 'Label/Stiker', sub: 'Label Paper' },
];

const BORDER_MODES: Opt<BorderMode>[] = [
  { value: 'bordered', label: 'Normal', icon: 'square-outline', sub: 'Margin 10mm' },
  { value: 'narrow', label: 'Sempit', icon: 'contract-outline', sub: 'Margin 5mm' },
  { value: 'borderless', label: 'Tanpa Batas', icon: 'expand-outline', sub: 'Margin 0' },
];

const SCALE_MODES: Opt<ScaleMode>[] = [
  { value: 'fit', label: 'Pas Halaman', icon: 'resize-outline', sub: 'Fit to Page' },
  { value: 'fill', label: 'Isi Penuh', icon: 'scan-outline', sub: 'Fill Page' },
  { value: 'actual', label: 'Ukuran Asli', icon: 'analytics-outline', sub: 'Actual Size' },
  { value: 'custom', label: 'Kustom %', icon: 'options-outline', sub: 'Custom Scale' },
];

const DUPLEX_MODES: Opt<DuplexMode>[] = [
  { value: 'simplex', label: 'Satu Sisi', icon: 'document-outline', sub: 'Single-sided' },
  { value: 'long-edge', label: 'Dua Sisi (Panjang)', icon: 'documents-outline', sub: 'Flip long edge' },
  { value: 'short-edge', label: 'Dua Sisi (Pendek)', icon: 'documents-outline', sub: 'Flip short edge' },
];

// ─── Generic Chip ────────────────────────────────────────
function Chip<T extends string>({ opt, sel, onPress }: { opt: Opt<T>; sel: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity style={[st.chip, sel && st.chipSel]} onPress={onPress} activeOpacity={0.7}>
      {opt.icon && <Ionicons name={opt.icon as any} size={14} color={sel ? '#fff' : COLORS.textMuted} />}
      <View style={{ flex: 1 }}>
        <Text style={[st.chipTxt, sel && st.chipTxtSel]}>{opt.label}</Text>
        {opt.sub && <Text style={[st.chipSub, sel && { color: 'rgba(255,255,255,0.65)' }]}>{opt.sub}</Text>}
      </View>
      {sel && <Ionicons name="checkmark-circle" size={14} color="#fff" />}
    </TouchableOpacity>
  );
}

// ─── Section with label ──────────────────────────────────
function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={st.section}>
      <Text style={st.sectionLabel}>{label}</Text>
      {children}
    </View>
  );
}

// ─── Main Component ──────────────────────────────────────
export default function StandardPrintSettingsPanel({ settings, onChange }: Props) {
  const [dialogTab, setDialogTab] = useState<DialogTab>('layout');

  const upd = <K extends keyof Settings>(key: K, val: Settings[K]) => onChange({ ...settings, [key]: val });

  const paper = getPaperDimensions(settings.paperSize);
  const isL = settings.orientation === 'landscape';
  const dW = isL ? paper.h : paper.w;
  const dH = isL ? paper.w : paper.h;

  // ─── Tab: Tata Letak ───────
  const renderLayout = () => (
    <View style={{ gap: 14 }}>
      <Section label="Orientasi">
        <View style={st.row}>
          {([['portrait', 'Portrait', 'phone-portrait-outline'], ['landscape', 'Landscape', 'phone-landscape-outline']] as const).map(([v, l, i]) => (
            <TouchableOpacity key={v} style={[st.bigChip, settings.orientation === v && st.bigChipSel]} onPress={() => upd('orientation', v)}>
              <Ionicons name={i} size={24} color={settings.orientation === v ? '#fff' : COLORS.textMuted} />
              <Text style={[st.bigChipTxt, settings.orientation === v && st.bigChipTxtSel]}>{l}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </Section>

      <Section label="Margin / Border">
        <View style={st.chipList}>
          {BORDER_MODES.map(o => <Chip key={o.value} opt={o} sel={settings.borderMode === o.value} onPress={() => upd('borderMode', o.value)} />)}
        </View>
      </Section>

      <Section label="Skala Cetak">
        <View style={st.chipList}>
          {SCALE_MODES.map(o => <Chip key={o.value} opt={o} sel={settings.scaleMode === o.value} onPress={() => upd('scaleMode', o.value)} />)}
        </View>
        {settings.scaleMode === 'custom' && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 8 }}>
            <Slider
              minimumValue={10} maximumValue={400} step={5}
              value={settings.customScale}
              onValueChange={(v) => upd('customScale', v)}
              minimumTrackTintColor="#10b981" maximumTrackTintColor="rgba(255,255,255,0.15)"
              thumbTintColor="#10b981"
              style={{ flex: 1, height: 36 }}
            />
            <Text style={{ fontSize: 14, fontWeight: '900', color: '#10b981', minWidth: 48, textAlign: 'right' }}>{settings.customScale}%</Text>
          </View>
        )}
      </Section>

      <Section label="Salinan / Copies">
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View style={st.copiesCtrl}>
            <TouchableOpacity style={[st.copyBtn, settings.copies <= 1 && { opacity: 0.3 }]} onPress={() => upd('copies', Math.max(1, settings.copies - 1))} disabled={settings.copies <= 1}>
              <Ionicons name="remove" size={16} color="#fff" />
            </TouchableOpacity>
            <Text style={st.copyNum}>{settings.copies}</Text>
            <TouchableOpacity style={st.copyBtn} onPress={() => upd('copies', Math.min(99, settings.copies + 1))}>
              <Ionicons name="add" size={16} color="#fff" />
            </TouchableOpacity>
          </View>
          {settings.copies > 1 && (
            <TouchableOpacity style={[st.miniChip, settings.collate && st.miniChipSel]} onPress={() => upd('collate', !settings.collate)}>
              <Ionicons name={settings.collate ? 'checkbox' : 'square-outline'} size={14} color={settings.collate ? '#10b981' : COLORS.textMuted} />
              <Text style={[st.miniChipTxt, settings.collate && { color: '#10b981' }]}>Collate (Urut per set)</Text>
            </TouchableOpacity>
          )}
        </View>
      </Section>
    </View>
  );

  // ─── Tab: Kertas ────────────
  const renderPaper = () => (
    <View style={{ gap: 14 }}>
      <Section label="Ukuran Kertas">
        <View style={st.chipList}>
          {PAPER_SIZES.map(o => <Chip key={o.value} opt={o} sel={settings.paperSize === o.value} onPress={() => upd('paperSize', o.value)} />)}
        </View>
      </Section>

      <Section label="Jenis Kertas / Media">
        <View style={st.chipList}>
          {PAPER_TYPES.map(o => <Chip key={o.value} opt={o} sel={settings.paperType === o.value} onPress={() => upd('paperType', o.value)} />)}
        </View>
      </Section>
    </View>
  );

  // ─── Tab: Kualitas ─────────
  const renderQuality = () => (
    <View style={{ gap: 14 }}>
      <Section label="Kualitas Cetak">
        <View style={st.chipList}>
          {QUALITIES.map(o => <Chip key={o.value} opt={o} sel={settings.quality === o.value} onPress={() => upd('quality', o.value)} />)}
        </View>
      </Section>

      <Section label="Mode Warna">
        <View style={st.row}>
          {([['color', 'Warna (Color)', 'color-palette'], ['grayscale', 'Hitam Putih (B/W)', 'contrast']] as const).map(([v, l, i]) => (
            <TouchableOpacity key={v} style={[st.bigChip, settings.colorMode === v && st.bigChipSel]} onPress={() => upd('colorMode', v)}>
              <Ionicons name={i} size={22} color={settings.colorMode === v ? '#fff' : COLORS.textMuted} />
              <Text style={[st.bigChipTxt, settings.colorMode === v && st.bigChipTxtSel]}>{l}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </Section>
    </View>
  );

  // ─── Tab: Lanjutan ─────────
  const renderAdvanced = () => (
    <View style={{ gap: 14 }}>
      <Section label="Cetak Dua Sisi (Duplex)">
        <View style={st.chipList}>
          {DUPLEX_MODES.map(o => <Chip key={o.value} opt={o} sel={settings.duplex === o.value} onPress={() => upd('duplex', o.value)} />)}
        </View>
      </Section>

      {/* Info box */}
      <View style={st.infoBox}>
        <Ionicons name="information-circle" size={16} color="#60a5fa" />
        <Text style={st.infoTxt}>
          Pengaturan dua sisi dan collate bergantung pada kemampuan printer Anda.
          Fitur ini akan diteruskan ke Android Print Framework.
        </Text>
      </View>
    </View>
  );

  return (
    <View style={st.container}>
      {/* Header with paper info */}
      <View style={st.header}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Ionicons name="print" size={18} color="#10b981" />
          <Text style={st.headerTxt}>PENGATURAN PRINTER</Text>
        </View>
        <View style={st.infoBadge}>
          <Text style={st.infoBadgeTxt}>{settings.paperSize} • {dW}×{dH}mm</Text>
        </View>
      </View>

      {/* Tab bar — like printer software */}
      <View style={st.tabBar}>
        {([
          ['layout', 'Tata Letak', 'grid-outline'],
          ['paper', 'Kertas', 'document-outline'],
          ['quality', 'Kualitas', 'sparkles-outline'],
          ['advanced', 'Lanjutan', 'settings-outline'],
        ] as const).map(([id, lbl, ico]) => (
          <TouchableOpacity
            key={id}
            style={[st.tab, dialogTab === id && st.tabActive]}
            onPress={() => setDialogTab(id)}
          >
            <Ionicons name={ico} size={14} color={dialogTab === id ? '#10b981' : COLORS.textMuted} />
            <Text style={[st.tabTxt, dialogTab === id && st.tabTxtActive]}>{lbl}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Tab content */}
      <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 280 }}>
        {dialogTab === 'layout' && renderLayout()}
        {dialogTab === 'paper' && renderPaper()}
        {dialogTab === 'quality' && renderQuality()}
        {dialogTab === 'advanced' && renderAdvanced()}
      </ScrollView>

      {/* Bottom summary bar */}
      <View style={st.summary}>
        <Text style={st.summaryTxt}>
          {settings.paperSize} {settings.orientation === 'portrait' ? '↕' : '↔'} • {settings.quality === 'photo' ? '1200' : settings.quality === 'high' ? '600' : settings.quality === 'standard' ? '300' : '150'} DPI • {settings.colorMode === 'color' ? '🎨' : '⚫'} • {settings.borderMode === 'borderless' ? 'Borderless' : settings.borderMode === 'narrow' ? '5mm' : '10mm'} • {settings.scaleMode === 'custom' ? `${settings.customScale}%` : settings.scaleMode === 'fit' ? 'Fit' : settings.scaleMode === 'fill' ? 'Fill' : '1:1'} • {settings.copies}×{settings.copies > 1 && settings.collate ? ' Collate' : ''}
        </Text>
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
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headerTxt: { fontSize: 11, fontWeight: '800', color: '#10b981', letterSpacing: 0.5 },
  infoBadge: { backgroundColor: 'rgba(16,185,129,0.15)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  infoBadgeTxt: { fontSize: 9, fontWeight: '700', color: '#10b981' },

  // Tab bar
  tabBar: { flexDirection: 'row', backgroundColor: 'rgba(0,0,0,0.3)', borderRadius: 12, padding: 3 },
  tab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: 8, borderRadius: 10 },
  tabActive: { backgroundColor: 'rgba(16,185,129,0.2)' },
  tabTxt: { fontSize: 9, fontWeight: '700', color: COLORS.textMuted },
  tabTxtActive: { color: '#10b981' },

  // Sections
  section: { gap: 8 },
  sectionLabel: { fontSize: 11, fontWeight: '700', color: 'rgba(255,255,255,0.7)' },

  // Chips — list (vertical)
  chipList: { gap: 6 },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 12, paddingVertical: 10,
    borderRadius: 10, backgroundColor: 'rgba(0,0,0,0.25)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
  },
  chipSel: { backgroundColor: '#059669', borderColor: '#10b981' },
  chipTxt: { fontSize: 11, fontWeight: '700', color: COLORS.textMuted },
  chipTxtSel: { color: '#fff' },
  chipSub: { fontSize: 8, color: 'rgba(255,255,255,0.2)', marginTop: 1 },

  // Big chips (row, for orientation/color)
  row: { flexDirection: 'row', gap: 10 },
  bigChip: {
    flex: 1, alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 16, borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.25)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
  },
  bigChipSel: { backgroundColor: '#059669', borderColor: '#10b981' },
  bigChipTxt: { fontSize: 11, fontWeight: '700', color: COLORS.textMuted },
  bigChipTxtSel: { color: '#fff' },

  // Mini chip (collate)
  miniChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
  miniChipSel: {},
  miniChipTxt: { fontSize: 10, fontWeight: '600', color: COLORS.textMuted },

  // Copies
  copiesCtrl: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  copyBtn: { width: 34, height: 34, borderRadius: 10, backgroundColor: '#059669', alignItems: 'center', justifyContent: 'center' },
  copyNum: { fontSize: 20, fontWeight: '900', color: '#fff', minWidth: 30, textAlign: 'center' },

  // Info box
  infoBox: { flexDirection: 'row', gap: 8, backgroundColor: 'rgba(96,165,250,0.1)', borderRadius: 10, padding: 12, borderWidth: 1, borderColor: 'rgba(96,165,250,0.2)' },
  infoTxt: { flex: 1, fontSize: 10, color: 'rgba(96,165,250,0.8)', lineHeight: 16 },

  // Summary bar
  summary: { backgroundColor: 'rgba(0,0,0,0.3)', borderRadius: 10, padding: 8 },
  summaryTxt: { fontSize: 9, fontWeight: '600', color: COLORS.textMuted, textAlign: 'center' },
});
