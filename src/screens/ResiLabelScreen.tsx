import React, { useState, useMemo } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';

import Header from '../components/Header';
import ConnectionModal from '../components/ConnectionModal';
import AdBanner from '../components/AdBanner';
import { useApp } from '../contexts/AppContext';
import { COLORS, PAPER } from '../constants/theme';
import {
  buildReceiptCommands, buildSeparator, buildTwoColumn,
  ReceiptLine,
} from '../utils/escpos';

type Mode = 'resi' | 'label';

function formatRupiah(n: number): string {
  return 'Rp ' + n.toLocaleString('id-ID');
}

export default function ResiLabelScreen() {
  const {
    sendToPrinter, paperWidth, isConnected, storeName,
    labelItems, addLabelItem, updateLabelItem, removeLabelItem, clearLabelItems, getLabelTotal,
  } = useApp();
  const [mode, setMode] = useState<Mode>('resi');
  const [nama, setNama] = useState('');
  const [noResi, setNoResi] = useState('');
  const [alamat, setAlamat] = useState('');
  const [printing, setPrinting] = useState(false);
  const [connModal, setConnModal] = useState(false);

  const labelTotal = getLabelTotal();

  // Build preview text
  const previewText = useMemo(() => {
    if (mode === 'resi') {
      const sep = '='.repeat(paperWidth === 58 ? 32 : 48);
      return `RESI PENGIRIMAN\n${sep}\n\nKEPADA: ${nama || 'Nama Penerima'}\nRESI: ${noResi || 'RESI-SAMPLE-001'}\n\nALAMAT:\n${alamat || 'Alamat pengiriman lengkap...'}\n\n${sep}\nTerima kasih sudah belanja!`;
    } else {
      const sep = '='.repeat(paperWidth === 58 ? 32 : 48);
      const dash = '-'.repeat(paperWidth === 58 ? 32 : 48);
      let text = `LABEL BARANG\n${sep}\n`;
      if (labelItems.length === 0) {
        text += '\n(Belum ada item)\n';
      } else {
        labelItems.forEach((item, i) => {
          const name = item.name || `Item ${i + 1}`;
          const subtotal = item.price * item.qty;
          text += `\n${name}\n  ${item.qty} x ${formatRupiah(item.price)} = ${formatRupiah(subtotal)}`;
        });
        text += `\n${dash}\nTOTAL: ${formatRupiah(labelTotal)}\n${labelItems.length} jenis barang`;
      }
      text += `\n${sep}\n${storeName}`;
      return text;
    }
  }, [mode, nama, noResi, alamat, paperWidth, labelItems, labelTotal, storeName]);

  const handlePrint = async () => {
    if (!isConnected) return setConnModal(true);

    setPrinting(true);
    try {
      const lines: ReceiptLine[] = [];

      if (mode === 'resi') {
        lines.push(
          { text: storeName, align: 'center', bold: true, size: 'large' },
          buildSeparator(paperWidth, '='),
          { text: 'RESI PENGIRIMAN', align: 'center', bold: true },
          buildSeparator(paperWidth, '='),
          { text: '' },
          { text: `KEPADA: ${nama}`, bold: true },
          { text: `RESI  : ${noResi}` },
          { text: '' },
          { text: 'ALAMAT:' },
        );
        const maxChars = paperWidth === 58 ? 32 : 48;
        const addr = alamat || '-';
        for (let i = 0; i < addr.length; i += maxChars) {
          lines.push({ text: addr.substring(i, i + maxChars) });
        }
        lines.push(
          { text: '' },
          buildSeparator(paperWidth, '='),
          { text: 'Terima kasih sudah belanja!', align: 'center' },
        );
      } else {
        lines.push(
          { text: storeName, align: 'center', bold: true, size: 'large' },
          buildSeparator(paperWidth, '='),
          { text: 'LABEL BARANG', align: 'center', bold: true },
          buildSeparator(paperWidth, '='),
        );

        if (labelItems.length === 0) {
          lines.push({ text: '(Belum ada item)', align: 'center' });
        } else {
          labelItems.forEach((item, i) => {
            const name = item.name || `Item ${i + 1}`;
            const subtotal = item.price * item.qty;
            lines.push(
              { text: name, bold: true },
              buildTwoColumn(`  ${item.qty} x ${formatRupiah(item.price)}`, formatRupiah(subtotal), paperWidth),
            );
          });
          lines.push(
            buildSeparator(paperWidth, '-'),
            buildTwoColumn('TOTAL', formatRupiah(labelTotal), paperWidth),
          );
          lines.push({ text: `${labelItems.length} jenis barang`, align: 'center' });
        }

        lines.push(
          buildSeparator(paperWidth, '='),
          { text: 'Terima kasih!', align: 'center' },
        );
      }

      const data = buildReceiptCommands(lines);
      await sendToPrinter(data);
      Alert.alert('Berhasil ✅', `${mode === 'resi' ? 'Resi' : 'Label'} berhasil dicetak!`);
    } catch (e: any) {
      Alert.alert('Gagal Cetak', e.message);
    } finally {
      setPrinting(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Header onConnectionPress={() => setConnModal(true)} />
      <ScrollView style={styles.content} contentContainerStyle={styles.contentInner}>
        {/* Form Card */}
        <View style={styles.formCard}>
          {/* Mode Switcher */}
          <View style={styles.modeRow}>
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

          {mode === 'resi' ? (
            <View style={styles.fields}>
              <View style={styles.row}>
                <TextInput style={[styles.input, styles.flex1]} placeholder="Nama Penerima" placeholderTextColor="#64748b" value={nama} onChangeText={setNama} />
                <TextInput style={[styles.input, styles.flex1]} placeholder="No. Resi" placeholderTextColor="#64748b" value={noResi} onChangeText={setNoResi} />
              </View>
              <TextInput
                style={[styles.input, styles.textarea]}
                placeholder="Alamat Pengiriman Lengkap..."
                placeholderTextColor="#64748b"
                multiline numberOfLines={3}
                value={alamat} onChangeText={setAlamat}
              />
            </View>
          ) : (
            <View style={styles.fields}>
              <View style={styles.labelHeader}>
                <Text style={styles.labelCount}>{labelItems.length}/100 item</Text>
                <View style={styles.labelActions}>
                  {labelItems.length > 0 && (
                    <TouchableOpacity onPress={clearLabelItems}>
                      <Text style={styles.clearText}>Hapus Semua</Text>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity
                    style={[styles.addBtn, labelItems.length >= 100 && { opacity: 0.3 }]}
                    onPress={addLabelItem}
                    disabled={labelItems.length >= 100}
                  >
                    <Ionicons name="add" size={16} color={COLORS.white} />
                    <Text style={styles.addBtnText}>Tambah</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {labelItems.map((item, idx) => (
                <View key={item.id} style={styles.labelItem}>
                  <View style={styles.labelItemHeader}>
                    <Text style={styles.labelItemNum}>#{idx + 1}</Text>
                    <TouchableOpacity onPress={() => removeLabelItem(item.id)}>
                      <Ionicons name="close-circle" size={18} color={COLORS.error} />
                    </TouchableOpacity>
                  </View>
                  <TextInput
                    style={styles.input} placeholder="Nama Barang"
                    placeholderTextColor="#64748b"
                    value={item.name}
                    onChangeText={(v) => updateLabelItem(item.id, 'name', v)}
                  />
                  <View style={styles.row}>
                    <TextInput
                      style={[styles.input, styles.flex1]} placeholder="Harga Satuan"
                      placeholderTextColor="#64748b" keyboardType="numeric"
                      value={item.price ? String(item.price) : ''}
                      onChangeText={(v) => updateLabelItem(item.id, 'price', parseInt(v) || 0)}
                    />
                    <TextInput
                      style={[styles.input, { width: 80 }]} placeholder="Qty"
                      placeholderTextColor="#64748b" keyboardType="numeric"
                      value={item.qty ? String(item.qty) : ''}
                      onChangeText={(v) => updateLabelItem(item.id, 'qty', parseInt(v) || 1)}
                    />
                  </View>
                </View>
              ))}

              {labelItems.length > 0 && (
                <View style={styles.totalBox}>
                  <Text style={styles.totalLabel}>ESTIMASI TOTAL</Text>
                  <Text style={styles.totalValue}>{formatRupiah(labelTotal)}</Text>
                </View>
              )}
            </View>
          )}
        </View>

        {/* Preview */}
        <View style={styles.previewArea}>
          <View style={[styles.paper, paperWidth === 80 && styles.paper80]}>
            <Text style={styles.previewText}>{previewText}</Text>
            <View style={styles.paperEdge} />
          </View>
        </View>
      </ScrollView>

      <TouchableOpacity
        style={[styles.printFab, printing && styles.printFabDisabled]}
        onPress={handlePrint} disabled={printing} activeOpacity={0.8}
      >
        <Ionicons name={printing ? 'sync' : 'flash'} size={28} color={COLORS.white} />
      </TouchableOpacity>

      <AdBanner />
      <ConnectionModal visible={connModal} onClose={() => setConnModal(false)} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bgDark },
  content: { flex: 1 },
  contentInner: { paddingBottom: 100 },

  formCard: {
    marginHorizontal: 16, marginTop: 8,
    backgroundColor: COLORS.bgCard, borderRadius: 24,
    borderWidth: 1, borderColor: COLORS.bgCardBorder, padding: 16,
  },
  modeRow: {
    flexDirection: 'row', backgroundColor: 'rgba(0,0,0,0.4)',
    borderRadius: 12, padding: 4, marginBottom: 12, gap: 4,
  },
  modeBtn: { flex: 1, paddingVertical: 8, borderRadius: 10, alignItems: 'center' },
  modeBtnActive: { backgroundColor: COLORS.primary, elevation: 4 },
  modeBtnText: { fontSize: 10, fontWeight: '700', color: COLORS.textMuted },
  modeBtnTextActive: { color: COLORS.white },

  fields: { gap: 10 },
  row: { flexDirection: 'row', gap: 10 },
  flex1: { flex: 1 },
  input: {
    backgroundColor: 'rgba(0,0,0,0.3)', borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)', borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 10,
    color: COLORS.white, fontSize: 12,
  },
  textarea: { height: 70, textAlignVertical: 'top' },

  labelHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  labelCount: { fontSize: 11, fontWeight: '600', color: COLORS.textSecondary },
  labelActions: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  clearText: { fontSize: 10, color: COLORS.error, fontWeight: '600' },
  addBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: COLORS.primary, borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 6,
  },
  addBtnText: { fontSize: 10, fontWeight: '700', color: COLORS.white },

  labelItem: {
    backgroundColor: 'rgba(0,0,0,0.2)', borderRadius: 14,
    padding: 12, gap: 8,
  },
  labelItemHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  labelItemNum: { fontSize: 10, fontWeight: '700', color: COLORS.primaryLight },

  totalBox: {
    backgroundColor: 'rgba(79,70,229,0.2)', borderRadius: 12,
    borderWidth: 1, borderColor: 'rgba(79,70,229,0.3)',
    padding: 14, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  totalLabel: { fontSize: 10, fontWeight: '700', color: COLORS.primaryLight },
  totalValue: { fontSize: 14, fontWeight: '900', color: COLORS.white },

  previewArea: {
    alignItems: 'center', marginTop: 20,
    backgroundColor: 'rgba(0,0,0,0.3)', borderRadius: 28,
    marginHorizontal: 16, padding: 24,
  },
  paper: {
    width: 220, backgroundColor: COLORS.white,
    borderRadius: 2, padding: 12, minHeight: 150,
    elevation: 10,
  },
  paper80: { width: 300 },
  previewText: {
    fontFamily: 'monospace', fontSize: 8, color: '#000',
    lineHeight: 12,
  },
  paperEdge: {
    position: 'absolute', bottom: -6, left: 0, right: 0, height: 6,
    backgroundColor: COLORS.white,
  },

  printFab: {
    position: 'absolute', bottom: 60, alignSelf: 'center',
    width: 70, height: 70, borderRadius: 35,
    backgroundColor: COLORS.primary,
    alignItems: 'center', justifyContent: 'center',
    elevation: 15,
    shadowColor: COLORS.primary, shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.4, shadowRadius: 20,
  },
  printFabDisabled: { opacity: 0.5 },
});
