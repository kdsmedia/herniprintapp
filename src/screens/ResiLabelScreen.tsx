import React, { useState, useMemo } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';

import Header from '../components/Header';
import PrintButton from '../components/PrintButton';
import PaperSettings from '../components/PaperSettings';
import AdBanner from '../components/AdBanner';
import { useApp } from '../contexts/AppContext';
import { COLORS, PAPER, PaperWidth } from '../constants/theme';
import {
  buildReceiptCommands,
  buildSeparator,
  buildTwoColumn,
  ReceiptLine,
} from '../utils/escpos';

type Mode = 'resi' | 'label';

export default function ResiLabelScreen() {
  const {
    sendToPrinter, paperWidth, storeName,
    labelItems, addLabelItem, updateLabelItem, removeLabelItem, clearLabelItems, getLabelTotal,
  } = useApp();

  const [mode, setMode] = useState<Mode>('resi');

  // Resi fields
  const [nama, setNama] = useState('');
  const [noResi, setNoResi] = useState('');
  const [alamat, setAlamat] = useState('');

  const labelTotal = useMemo(() => getLabelTotal(), [labelItems, getLabelTotal]);

  const formatRupiah = (n: number) => `Rp ${n.toLocaleString('id-ID')}`;

  // ─── Build Resi receipt lines ──────────────────────────
  const buildResiLines = (): ReceiptLine[] => {
    const lines: ReceiptLine[] = [
      { text: storeName, align: 'center', bold: true, size: 'large' },
      { text: 'RESI PENGIRIMAN', align: 'center', bold: true },
      buildSeparator(paperWidth, '='),
      { text: '' },
      { text: `KEPADA : ${nama || 'Nama Penerima'}` },
      { text: `RESI   : ${noResi || 'RESI-XXXX-XXX'}` },
      { text: '' },
      { text: 'ALAMAT :' },
    ];

    // Word-wrap alamat
    const maxChars = paperWidth === 58 ? 32 : 48;
    const addr = alamat || 'Alamat pengiriman lengkap...';
    for (let i = 0; i < addr.length; i += maxChars) {
      lines.push({ text: addr.substring(i, i + maxChars) });
    }

    lines.push({ text: '' });
    lines.push(buildSeparator(paperWidth, '='));
    lines.push({ text: 'Terima kasih sudah belanja!', align: 'center' });
    lines.push({ text: storeName, align: 'center', bold: true });

    return lines;
  };

  // ─── Build Label receipt lines ─────────────────────────
  const buildLabelLines = (): ReceiptLine[] => {
    const lines: ReceiptLine[] = [
      { text: storeName, align: 'center', bold: true, size: 'large' },
      { text: 'LABEL BARANG', align: 'center', bold: true },
      buildSeparator(paperWidth, '='),
      { text: '' },
    ];

    if (labelItems.length === 0) {
      lines.push({ text: '(Belum ada item)', align: 'center' });
    } else {
      labelItems.forEach((item, idx) => {
        const subtotal = item.price * item.qty;
        lines.push({ text: `${idx + 1}. ${item.name || 'Item'}`, bold: true });
        lines.push(
          buildTwoColumn(
            `   ${item.qty} x ${formatRupiah(item.price)}`,
            formatRupiah(subtotal),
            paperWidth
          )
        );
      });
    }

    lines.push({ text: '' });
    lines.push(buildSeparator(paperWidth, '-'));
    lines.push(
      buildTwoColumn('TOTAL', formatRupiah(labelTotal), paperWidth)
    );
    lines.push({ text: `${labelItems.length} jenis barang`, align: 'center' });
    lines.push(buildSeparator(paperWidth, '='));
    lines.push({ text: storeName, align: 'center', bold: true });

    return lines;
  };

  // Preview text (for display only)
  const previewText = useMemo(() => {
    const lines = mode === 'resi' ? buildResiLines() : buildLabelLines();
    return lines.map((l) => l.text).join('\n');
  }, [mode, nama, noResi, alamat, storeName, paperWidth, labelItems, labelTotal]);

  const handlePrint = async () => {
    const lines = mode === 'resi' ? buildResiLines() : buildLabelLines();
    const escposData = buildReceiptCommands(lines);
    await sendToPrinter(escposData);
  };

  const renderLabelItem = (item: typeof labelItems[0], index: number) => (
    <View style={styles.itemRow} key={item.id}>
      <Text style={styles.itemNum}>{index + 1}</Text>
      <View style={styles.itemFields}>
        <TextInput
          style={styles.itemInput}
          placeholder="Nama barang"
          placeholderTextColor={COLORS.textMuted}
          value={item.name}
          onChangeText={(v) => updateLabelItem(item.id, 'name', v)}
        />
        <View style={styles.itemRow2}>
          <TextInput
            style={[styles.itemInput, styles.itemInputSmall]}
            placeholder="Harga"
            placeholderTextColor={COLORS.textMuted}
            keyboardType="numeric"
            value={item.price > 0 ? String(item.price) : ''}
            onChangeText={(v) => updateLabelItem(item.id, 'price', parseInt(v) || 0)}
          />
          <TextInput
            style={[styles.itemInput, styles.itemInputTiny]}
            placeholder="Qty"
            placeholderTextColor={COLORS.textMuted}
            keyboardType="numeric"
            value={item.qty > 0 ? String(item.qty) : ''}
            onChangeText={(v) => updateLabelItem(item.id, 'qty', parseInt(v) || 0)}
          />
          <Text style={styles.itemSubtotal}>
            {formatRupiah(item.price * item.qty)}
          </Text>
        </View>
      </View>
      <TouchableOpacity onPress={() => removeLabelItem(item.id)} style={styles.itemDelete}>
        <Ionicons name="close-circle" size={20} color={COLORS.error} />
      </TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Header />
      <ScrollView style={styles.content} contentContainerStyle={styles.contentInner}>
        {/* Mode switcher */}
        <View style={styles.modeSwitch}>
          <TouchableOpacity
            style={[styles.modeBtn, mode === 'resi' && styles.modeBtnActive]}
            onPress={() => setMode('resi')}
          >
            <Text style={[styles.modeBtnText, mode === 'resi' && styles.modeBtnTextActive]}>RESI</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.modeBtn, mode === 'label' && styles.modeBtnActive]}
            onPress={() => setMode('label')}
          >
            <Text style={[styles.modeBtnText, mode === 'label' && styles.modeBtnTextActive]}>LABEL BARANG</Text>
          </TouchableOpacity>
        </View>

        {/* Resi Form */}
        {mode === 'resi' && (
          <View style={styles.form}>
            <View style={styles.rowInputs}>
              <TextInput
                style={[styles.input, { flex: 1 }]}
                placeholder="Nama Penerima"
                placeholderTextColor={COLORS.textMuted}
                value={nama}
                onChangeText={setNama}
              />
              <TextInput
                style={[styles.input, { flex: 1 }]}
                placeholder="No. Resi"
                placeholderTextColor={COLORS.textMuted}
                value={noResi}
                onChangeText={setNoResi}
              />
            </View>
            <TextInput
              style={[styles.input, styles.inputMultiline]}
              placeholder="Alamat Pengiriman Lengkap..."
              placeholderTextColor={COLORS.textMuted}
              value={alamat}
              onChangeText={setAlamat}
              multiline
              numberOfLines={3}
            />
          </View>
        )}

        {/* Label Form — Up to 100 items */}
        {mode === 'label' && (
          <View style={styles.form}>
            <View style={styles.labelHeader}>
              <Text style={styles.labelCount}>{labelItems.length}/100 item</Text>
              <View style={styles.labelActions}>
                {labelItems.length > 0 && (
                  <TouchableOpacity
                    onPress={() =>
                      Alert.alert('Hapus Semua', 'Hapus semua item?', [
                        { text: 'Batal' },
                        { text: 'Hapus', style: 'destructive', onPress: clearLabelItems },
                      ])
                    }
                    style={styles.clearBtn}
                  >
                    <Text style={styles.clearBtnText}>Hapus Semua</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  onPress={addLabelItem}
                  style={[styles.addBtn, labelItems.length >= 100 && { opacity: 0.3 }]}
                  disabled={labelItems.length >= 100}
                >
                  <Ionicons name="add" size={18} color={COLORS.white} />
                  <Text style={styles.addBtnText}>Tambah</Text>
                </TouchableOpacity>
              </View>
            </View>

            {labelItems.map((item, index) => renderLabelItem(item, index))}

            {labelItems.length > 0 && (
              <View style={styles.totalBox}>
                <Text style={styles.totalLabel}>TOTAL ({labelItems.length} item)</Text>
                <Text style={styles.totalValue}>{formatRupiah(labelTotal)}</Text>
              </View>
            )}

            {labelItems.length === 0 && (
              <TouchableOpacity style={styles.emptyAdd} onPress={addLabelItem}>
                <Ionicons name="add-circle-outline" size={40} color={COLORS.textMuted} />
                <Text style={styles.emptyAddText}>Tambah Item Pertama</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Preview */}
        <View style={styles.previewContainer}>
          <Text style={styles.previewTitle}>Preview Cetak</Text>
          <View style={[styles.previewBox, { width: paperWidth === 58 ? 220 : 300 }]}>
            <Text style={styles.previewText}>{previewText}</Text>
          </View>
        </View>

        <PaperSettings />
        <PrintButton onPrint={handlePrint} />
      </ScrollView>
      <AdBanner />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bgDark },
  content: { flex: 1 },
  contentInner: { paddingBottom: 20 },
  modeSwitch: {
    flexDirection: 'row',
    marginHorizontal: 20,
    marginTop: 12,
    marginBottom: 12,
    backgroundColor: 'rgba(0,0,0,0.4)',
    borderRadius: 12,
    padding: 4,
    gap: 4,
  },
  modeBtn: { flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center' },
  modeBtnActive: { backgroundColor: COLORS.primary },
  modeBtnText: { fontSize: 11, fontWeight: '700', color: COLORS.textMuted },
  modeBtnTextActive: { color: COLORS.white },
  form: { marginHorizontal: 20, marginBottom: 16, gap: 10 },
  rowInputs: { flexDirection: 'row', gap: 10 },
  input: {
    backgroundColor: COLORS.bgInput,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    padding: 12,
    color: COLORS.white,
    fontSize: 13,
  },
  inputMultiline: { height: 80, textAlignVertical: 'top' },

  // Label items
  labelHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  labelCount: { fontSize: 11, fontWeight: '700', color: COLORS.textSecondary },
  labelActions: { flexDirection: 'row', gap: 8 },
  clearBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, backgroundColor: 'rgba(239,68,68,0.2)' },
  clearBtnText: { fontSize: 10, fontWeight: '700', color: COLORS.error },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: COLORS.primary,
  },
  addBtnText: { fontSize: 10, fontWeight: '700', color: COLORS.white },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: COLORS.bgCard,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.bgCardBorder,
    padding: 10,
    gap: 8,
  },
  itemNum: { fontSize: 11, fontWeight: '700', color: COLORS.textMuted, marginTop: 10, width: 20 },
  itemFields: { flex: 1, gap: 6 },
  itemRow2: { flexDirection: 'row', gap: 6, alignItems: 'center' },
  itemInput: {
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderRadius: 8,
    padding: 8,
    color: COLORS.white,
    fontSize: 12,
  },
  itemInputSmall: { flex: 1 },
  itemInputTiny: { width: 55 },
  itemSubtotal: { fontSize: 10, fontWeight: '700', color: COLORS.primaryLight, flex: 1, textAlign: 'right' },
  itemDelete: { marginTop: 8 },
  totalBox: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'rgba(79,70,229,0.2)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(129,140,248,0.3)',
    padding: 14,
  },
  totalLabel: { fontSize: 11, fontWeight: '700', color: COLORS.primaryLight },
  totalValue: { fontSize: 16, fontWeight: '900', color: COLORS.white },
  emptyAdd: { alignItems: 'center', paddingVertical: 24, gap: 8 },
  emptyAddText: { fontSize: 12, color: COLORS.textMuted },

  // Preview
  previewContainer: { marginHorizontal: 20, marginBottom: 16, alignItems: 'center' },
  previewTitle: { fontSize: 12, fontWeight: '700', color: COLORS.textSecondary, marginBottom: 8, textTransform: 'uppercase', alignSelf: 'flex-start' },
  previewBox: {
    backgroundColor: COLORS.white,
    borderRadius: 4,
    padding: 16,
    minHeight: 150,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  previewText: {
    fontFamily: 'monospace',
    fontSize: 11,
    color: COLORS.black,
    lineHeight: 16,
  },
});
