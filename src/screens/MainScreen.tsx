/**
 * MainScreen — Single-page layout matching the original HTML PWA exactly.
 * 4 top tabs, form area, paper preview, floating print button, connection modal.
 */
import React, { useState, useMemo, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, Image, ScrollView,
  StyleSheet, Alert, Modal, ActivityIndicator, Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import Slider from '@react-native-community/slider';
import QRCode from 'react-native-qrcode-svg';

import { useApp } from '../contexts/AppContext';
import { COLORS, PAPER } from '../constants/theme';
import { processImageForPrint } from '../utils/imageProcessor';
import {
  pixelsToEscPos, buildReceiptCommands, buildSeparator, buildTwoColumn,
  generateEscPosQR, generateEscPosBarcode, ReceiptLine,
} from '../utils/escpos';
import {
  requestBluetoothPermissions, scanForPrinters, stopScan, PrinterDevice,
} from '../utils/bluetooth';
import AdBanner from '../components/AdBanner';
import { preloadInterstitial, showInterstitial } from '../utils/ads';
import PrintProgress from '../components/PrintProgress';
import PdfConverter, { PdfConverterRef } from '../components/PdfConverter';
import StandardPrintSettingsPanel from '../components/StandardPrintSettings';
import {
  PrinterMode, StandardPrintSettings, DEFAULT_PRINT_SETTINGS,
  printImageStandard, printPdfStandard, printTextStandard, printCodeHtmlStandard,
} from '../utils/standardPrint';

type TabId = 'img' | 'pdf' | 'resi' | 'code';
type ResiMode = 'resi' | 'label';
type CodeType = 'qr' | 'barcode';

const TABS: { id: TabId; icon: string; label: string }[] = [
  { id: 'img', icon: 'image', label: 'GAMBAR' },
  { id: 'pdf', icon: 'document-text', label: 'PDF' },
  { id: 'resi', icon: 'receipt', label: 'RESI/LABEL' },
  { id: 'code', icon: 'qr-code', label: 'QR/BAR' },
];

function formatRupiah(n: number): string {
  return 'Rp ' + n.toLocaleString('id-ID');
}

export default function MainScreen() {
  const {
    isConnected, connectedDeviceName, connectDevice, disconnect,
    sendToPrinter, paperWidth, setPaperWidth, contrast, setContrast,
    storeName, setStoreName, storeContact, setStoreContact,
    labelItems, addLabelItem, updateLabelItem, removeLabelItem,
    clearLabelItems, getLabelTotal,
  } = useApp();

  // Refs

  // UI State
  const [tab, setTab] = useState<TabId>('img');
  const [resiMode, setResiMode] = useState<ResiMode>('resi');
  const [codeType, setCodeType] = useState<CodeType>('qr');
  const [printing, setPrinting] = useState(false);
  const [connModal, setConnModal] = useState(false);

  // Settings
  const [settingsOpen, setSettingsOpen] = useState(false);

  // Printer mode
  const [printerMode, setPrinterMode] = useState<PrinterMode>('thermal');
  const [stdSettings, setStdSettings] = useState<StandardPrintSettings>(DEFAULT_PRINT_SETTINGS);

  // Print progress state
  const [printProgress, setPrintProgress] = useState(0);
  const [printStatus, setPrintStatus] = useState('');
  const [printStage, setPrintStage] = useState<'prepare' | 'sending' | 'done' | 'error'>('prepare');
  const [showProgress, setShowProgress] = useState(false);

  // Pre-print settings modal
  const [showPrintSettings, setShowPrintSettings] = useState(false);
  const [printAlign, setPrintAlign] = useState<'left' | 'center' | 'right'>('center');
  const [printSharpness, setPrintSharpness] = useState(5); // 1-10

  // PDF Converter ref
  const pdfConverterRef = useRef<PdfConverterRef>(null);

  // Image/PDF
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [pdfUri, setPdfUri] = useState<string | null>(null);
  const [pdfName, setPdfName] = useState('');
  const [pdfImageUri, setPdfImageUri] = useState<string | null>(null);
  const [pdfConverting, setPdfConverting] = useState(false);
  const [pdfTotalPages, setPdfTotalPages] = useState(0);
  const [pdfCurrentPage, setPdfCurrentPage] = useState(1);
  const [pdfPageCache, setPdfPageCache] = useState<Record<number, string>>({});

  // Resi
  const [nama, setNama] = useState('');
  const [noResi, setNoResi] = useState('');
  const [alamat, setAlamat] = useState('');

  // QR/Barcode
  const [codeInput, setCodeInput] = useState('');

  // BLE scan
  const [scanning, setScanning] = useState(false);
  const [devices, setDevices] = useState<PrinterDevice[]>([]);
  const [connecting, setConnecting] = useState<string | null>(null);

  const labelTotal = getLabelTotal();

  // Preload interstitial ad on mount
  React.useEffect(() => { preloadInterstitial(); }, []);

  // ─── Preview Text ───────────────────────────────────────
  const previewText = useMemo(() => {
    if (tab !== 'resi') return '';
    const sep = '='.repeat(paperWidth === 58 ? 22 : 32);
    const dash = '-'.repeat(paperWidth === 58 ? 22 : 32);
    if (resiMode === 'resi') {
      return `RESI PENGIRIMAN\n${sep}\n\nKEPADA: ${nama || 'Nama Penerima'}\nRESI: ${noResi || 'RESI-SAMPLE-001'}\n\nALAMAT:\n${alamat || 'Alamat pengiriman lengkap...'}\n\n${sep}\nTerima kasih sudah belanja!`;
    } else {
      let t = `LABEL BARANG\n${sep}\n`;
      if (labelItems.length === 0) {
        t += '\nITEM: Nama Produk\nQTY : 1\nHARGA: Rp 0\n' + dash + '\nTOTAL: Rp 0\n' + sep;
      } else {
        labelItems.forEach((item, i) => {
          const sub = item.price * item.qty;
          t += `\nITEM: ${item.name || `Item ${i+1}`}\nQTY : ${item.qty}\nHARGA: ${formatRupiah(item.price)}\n`;
        });
        t += dash + `\nTOTAL: ${formatRupiah(labelTotal)}\n${sep}\n${storeName}`;
      }
      return t;
    }
  }, [tab, resiMode, nama, noResi, alamat, paperWidth, labelItems, labelTotal, storeName]);

  // ─── File Pickers ───────────────────────────────────────
  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') return Alert.alert('Izin Diperlukan', 'Izinkan akses galeri.');
    const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 1 });
    if (!r.canceled && r.assets[0]) setImageUri(r.assets[0].uri);
  };

  const pickPdf = async () => {
    const r = await DocumentPicker.getDocumentAsync({ type: ['application/pdf', 'image/*'], copyToCacheDirectory: true });
    if (!r.canceled && r.assets[0]) {
      const a = r.assets[0];
      const isPdf = a.mimeType?.includes('pdf') || a.name?.endsWith('.pdf');
      if (isPdf) {
        // Reset all PDF state
        setPdfImageUri(null);
        setPdfTotalPages(0);
        setPdfCurrentPage(1);
        setPdfPageCache({});
        setPdfUri(a.uri);
        setPdfName(a.name || 'dokumen.pdf');
        setPdfConverting(true);
      } else {
        // If user picks an image from PDF picker, switch to image tab
        setImageUri(a.uri);
        setTab('img');
      }
    }
  };

  const clearPdf = () => {
    setPdfUri(null);
    setPdfName('');
    setPdfImageUri(null);
    setPdfConverting(false);
    setPdfTotalPages(0);
    setPdfCurrentPage(1);
    setPdfPageCache({});
  };

  // Convert a specific PDF page using WebView + PDF.js
  const convertPdfPage = async (pageNum: number) => {
    if (pdfConverting) return; // Prevent double-tap

    // Check cache first
    if (pdfPageCache[pageNum]) {
      setPdfImageUri(pdfPageCache[pageNum]);
      setPdfCurrentPage(pageNum);
      return;
    }

    setPdfConverting(true);
    try {
      const converter = pdfConverterRef.current;
      if (!converter) throw new Error('PDF converter belum siap. Tunggu sebentar...');

      const uri = await converter.convertPage(pageNum);
      setPdfImageUri(uri);
      setPdfCurrentPage(pageNum);
      // Cache the result
      setPdfPageCache(prev => ({ ...prev, [pageNum]: uri }));
    } catch (e: any) {
      console.warn('PDF page convert failed:', e.message);
      Alert.alert('Konversi Gagal', e.message || 'Halaman tidak bisa dikonversi.');
      // Keep showing the previous page image if available
    } finally {
      setPdfConverting(false);
    }
  };

  // Auto-load PDF and convert first page when pdfUri changes
  React.useEffect(() => {
    if (!pdfUri) return;
    let cancelled = false;

    const waitForConverter = async (maxWaitMs: number = 5000): Promise<PdfConverterRef> => {
      const startTime = Date.now();
      while (Date.now() - startTime < maxWaitMs) {
        if (cancelled) throw new Error('Dibatalkan');
        if (pdfConverterRef.current) return pdfConverterRef.current;
        await new Promise(r => setTimeout(r, 500));
      }
      throw new Error('PDF converter tidak tersedia. Pastikan koneksi internet aktif dan coba lagi.');
    };

    const doLoad = async () => {
      setPdfConverting(true);
      setPdfImageUri(null);
      setPdfTotalPages(0);

      try {
        // Wait for WebView + PDF.js to be available
        const converter = await waitForConverter(5000);
        if (cancelled) return;

        // Step 1: Load PDF and get page count
        const totalPages = await converter.loadPdf(pdfUri);
        if (cancelled) return;
        setPdfTotalPages(totalPages);

        // Step 2: Convert first page
        const uri = await converter.convertPage(1);
        if (cancelled) return;
        setPdfImageUri(uri);
        setPdfCurrentPage(1);
        setPdfPageCache({ 1: uri });
      } catch (e: any) {
        if (!cancelled) {
          console.warn('PDF load failed:', e.message);
          // Don't show alert for cancellation
          if (e.message !== 'Dibatalkan') {
            Alert.alert(
              'Konversi Gagal',
              e.message || 'PDF tidak bisa dikonversi. Pastikan koneksi internet aktif dan coba lagi.'
            );
          }
        }
      } finally {
        if (!cancelled) setPdfConverting(false);
      }
    };

    doLoad();
    return () => { cancelled = true; };
  }, [pdfUri]);

  // Navigate PDF pages
  const pdfPrevPage = () => {
    if (pdfCurrentPage > 1) convertPdfPage(pdfCurrentPage - 1);
  };
  const pdfNextPage = () => {
    if (pdfCurrentPage < pdfTotalPages) convertPdfPage(pdfCurrentPage + 1);
  };

  // ─── BLE Scan ───────────────────────────────────────────
  const startBLEScan = async () => {
    const ok = await requestBluetoothPermissions();
    if (!ok) return Alert.alert('Izin Ditolak', 'Izinkan Bluetooth & Lokasi.');
    setDevices([]); setScanning(true);
    const stop = scanForPrinters(
      (d) => setDevices((prev) => prev.find((x) => x.id === d.id) ? prev : [...prev, d]),
      (e) => { Alert.alert('Error', e); setScanning(false); }
    );
    setTimeout(() => { stop(); setScanning(false); }, 15000);
  };

  const handleConnect = async (d: PrinterDevice) => {
    stopScan(); setScanning(false); setConnecting(d.id);
    try {
      await connectDevice(d);
      Alert.alert('Terhubung ✅', d.name);
      setConnModal(false);
    } catch (e: any) {
      Alert.alert('Gagal', e.message);
    } finally { setConnecting(null); }
  };

  // ─── Print progress helpers ─────────────────────────────
  const startProgress = (status: string) => {
    setPrintProgress(0);
    setPrintStatus(status);
    setPrintStage('prepare');
    setShowProgress(true);
    setPrinting(true);
  };

  const onSendProgress = (sent: number, total: number) => {
    const pct = Math.round((sent / total) * 100);
    setPrintProgress(pct);
    setPrintStage('sending');
    setPrintStatus('Mengirim ke printer...');
  };

  const finishProgress = (success: boolean, msg?: string) => {
    setPrintProgress(100);
    setPrintStage(success ? 'done' : 'error');
    setPrintStatus(success ? 'Berhasil dicetak!' : (msg || 'Gagal mencetak'));
    setTimeout(() => {
      setShowProgress(false);
      setPrinting(false);
      // Show interstitial ad after successful print (with cooldown)
      if (success) showInterstitial();
    }, success ? 1500 : 2500);
  };

  // ─── STANDARD PRINT (Color/Large Printer) ───────────────
  const handleStandardPrint = async () => {
    try {
      startProgress('Menyiapkan dokumen...');
      setPrintProgress(20);

      if (tab === 'img') {
        if (!imageUri) return Alert.alert('Pilih Gambar');
        setPrintStatus('Mencetak gambar berwarna...');
        setPrintProgress(50);
        await printImageStandard(imageUri, stdSettings);
      }
      else if (tab === 'pdf') {
        if (!pdfUri) return Alert.alert('Pilih PDF');
        setPrintStatus('Mencetak dokumen PDF...');
        setPrintProgress(50);
        if (pdfImageUri) {
          // Print the converted image (full color)
          await printImageStandard(pdfImageUri, stdSettings);
        } else {
          // Fallback: print PDF directly via system
          await printPdfStandard(pdfUri, stdSettings);
        }
      }
      else if (tab === 'resi') {
        setPrintStatus('Mencetak resi/label...');
        setPrintProgress(50);
        await printTextStandard(previewText, stdSettings, storeName);
      }
      else if (tab === 'code') {
        if (!codeInput.trim()) return Alert.alert('Input Kosong');
        setPrintStatus('Mencetak kode...');
        setPrintProgress(50);
        // Render QR/Barcode as HTML image for color printing
        await printCodeHtmlStandard(codeInput, codeType, stdSettings);
      }
      finishProgress(true);
    } catch (e: any) {
      if (!e.message?.includes('cancel')) {
        finishProgress(false, e.message);
      } else {
        setShowProgress(false);
        setPrinting(false);
      }
    }
  };

  // ─── PRINT ─────────────────────────────────────────────
  // Called when FAB is pressed — opens pre-print settings modal
  const handlePrintPress = () => {
    // Validate first
    if (printerMode === 'thermal' && !isConnected) {
      return Alert.alert('Printer Belum Terhubung', 'Hubungkan printer thermal via Bluetooth terlebih dahulu.');
    }
    if (tab === 'img' && !imageUri) return Alert.alert('Pilih Gambar', 'Unggah gambar terlebih dahulu.');
    if (tab === 'pdf' && !pdfUri) return Alert.alert('Pilih PDF', 'Unggah file PDF terlebih dahulu.');
    if (tab === 'pdf' && pdfConverting) return Alert.alert('Mohon Tunggu', 'PDF masih dikonversi. Tunggu sampai selesai.');
    if (tab === 'pdf' && !pdfImageUri && printerMode === 'thermal') return Alert.alert('Konversi Belum Siap', 'PDF belum berhasil dikonversi ke gambar. Coba muat ulang file.');
    if (tab === 'code' && !codeInput.trim()) return Alert.alert('Masukkan Data', 'Isi teks untuk QR/Barcode.');
    // Show pre-print settings popup
    setShowPrintSettings(true);
  };

  // Called after user confirms settings in the popup
  const handlePrint = async () => {
    setShowPrintSettings(false);

    // Standard printer mode — no BLE needed
    if (printerMode === 'standard') {
      setPrinting(true);
      setShowProgress(true);
      setPrintStage('prepare');
      await handleStandardPrint();
      return;
    }

    // Thermal mode — needs BLE connection
    if (!isConnected) return setConnModal(true);

    try {
      const dots = PAPER[paperWidth].dots;

      // Sharpness → contrast boost (1-10 scale → 0.6-2.0 multiplier)
      const sharpContrast = contrast * (0.6 + (printSharpness / 10) * 1.4);
      const isLandscape = stdSettings.orientation === 'landscape';

      if (tab === 'img') {
        if (!imageUri) return Alert.alert('Pilih Gambar');
        startProgress('Memproses gambar...');
        setPrintProgress(10);

        const { pixels, width, height } = await processImageForPrint(imageUri, dots, { landscape: isLandscape, sharpness: printSharpness });
        setPrintProgress(40);
        setPrintStatus('Mengkonversi untuk printer...');

        const escData = pixelsToEscPos(pixels, width, height, sharpContrast, dots, printAlign);
        setPrintProgress(50);
        setPrintStage('sending');
        setPrintStatus('Mengirim ke printer...');

        await sendToPrinter(escData, (sent, total) => {
          const pct = 50 + Math.round((sent / total) * 50);
          setPrintProgress(pct);
        });
        finishProgress(true);
      }
      else if (tab === 'pdf') {
        if (!pdfUri) {
          Alert.alert('Pilih File', 'Unggah PDF terlebih dahulu.');
          return;
        }
        startProgress('Menyiapkan PDF...');
        setPrintProgress(10);

        // Use pre-converted image of current page
        let capturedUri = pdfImageUri;
        if (!capturedUri) {
          setPrintStatus('Mengkonversi halaman ke gambar...');
          setPrintProgress(20);
          if (pdfConverterRef.current) {
            capturedUri = await pdfConverterRef.current.convertPage(pdfCurrentPage);
          } else {
            throw new Error('PDF converter belum siap');
          }
        }
        setPrintProgress(40);

        // Process image for thermal printing
        setPrintStatus('Memproses gambar untuk printer...');
        const { pixels, width, height } = await processImageForPrint(capturedUri, dots, { landscape: isLandscape, sharpness: printSharpness });
        setPrintProgress(60);

        setPrintStatus('Mengkonversi ke ESC/POS...');
        const escData = pixelsToEscPos(pixels, width, height, sharpContrast, dots, printAlign);
        setPrintProgress(70);
        setPrintStage('sending');
        setPrintStatus('Mengirim ke printer...');

        await sendToPrinter(escData, (sent, total) => {
          const pct = 70 + Math.round((sent / total) * 30);
          setPrintProgress(pct);
        });
        finishProgress(true);
      }
      else if (tab === 'resi') {
        startProgress(resiMode === 'resi' ? 'Menyiapkan resi...' : 'Menyiapkan label...');
        setPrintProgress(20);

        const lines: ReceiptLine[] = [];
        if (resiMode === 'resi') {
          lines.push(
            { text: storeName, align: 'center', bold: true, size: 'large' },
            buildSeparator(paperWidth, '='),
            { text: 'RESI PENGIRIMAN', align: 'center', bold: true },
            buildSeparator(paperWidth, '='),
            { text: '' },
            { text: `KEPADA: ${nama}`, bold: true },
            { text: `RESI  : ${noResi}` },
            { text: '' }, { text: 'ALAMAT:' },
          );
          const maxC = paperWidth === 58 ? 32 : 48;
          const addr = alamat || '-';
          for (let i = 0; i < addr.length; i += maxC) lines.push({ text: addr.substring(i, i + maxC) });
          lines.push({ text: '' }, buildSeparator(paperWidth, '='), { text: 'Terima kasih sudah belanja!', align: 'center' });
        } else {
          lines.push(
            { text: storeName, align: 'center', bold: true, size: 'large' },
            buildSeparator(paperWidth, '='),
            { text: 'LABEL BARANG', align: 'center', bold: true },
            buildSeparator(paperWidth, '='),
          );
          labelItems.forEach((item, i) => {
            lines.push(
              { text: item.name || `Item ${i+1}`, bold: true },
              buildTwoColumn(`  ${item.qty} x ${formatRupiah(item.price)}`, formatRupiah(item.price * item.qty), paperWidth),
            );
          });
          if (labelItems.length > 0) {
            lines.push(buildSeparator(paperWidth, '-'), buildTwoColumn('TOTAL', formatRupiah(labelTotal), paperWidth));
            lines.push({ text: `${labelItems.length} jenis barang`, align: 'center' });
          }
          lines.push(buildSeparator(paperWidth, '='), { text: 'Terima kasih!', align: 'center' });
        }

        setPrintProgress(40);
        const escData = buildReceiptCommands(lines);
        setPrintProgress(50);
        setPrintStage('sending');
        setPrintStatus('Mengirim ke printer...');

        await sendToPrinter(escData, (sent, total) => {
          const pct = 50 + Math.round((sent / total) * 50);
          setPrintProgress(pct);
        });
        finishProgress(true);
      }
      else if (tab === 'code') {
        if (!codeInput.trim()) return Alert.alert('Input Kosong');
        startProgress(codeType === 'qr' ? 'Membuat QR Code...' : 'Membuat Barcode...');
        setPrintProgress(30);

        const d = codeType === 'qr'
          ? generateEscPosQR(codeInput, dots)
          : generateEscPosBarcode(codeInput, dots);

        setPrintProgress(50);
        setPrintStage('sending');
        setPrintStatus('Mengirim ke printer...');

        await sendToPrinter(d, (sent, total) => {
          const pct = 50 + Math.round((sent / total) * 50);
          setPrintProgress(pct);
        });
        finishProgress(true);
      }
    } catch (e: any) {
      if (!e.message?.includes('cancel')) {
        if (showProgress) {
          finishProgress(false, e.message);
        } else {
          Alert.alert('Gagal', e.message);
          setPrinting(false);
        }
      } else {
        setShowProgress(false);
        setPrinting(false);
      }
    }
  };

  // ─── RENDER ────────────────────────────────────────────
  return (
    <LinearGradient colors={['#1e1b4b', '#0f172a']} start={{ x: 1, y: 0 }} end={{ x: 0, y: 1 }} style={s.root}>
    <SafeAreaView style={{ flex: 1 }} edges={['top']}>
      {/* ═══ HEADER ═══ */}
      <View style={s.header}>
        <View style={s.headerLeft}>
          <View style={s.logoBox}>
            <Image source={require('../../assets/logo.png')} style={s.logo} resizeMode="contain" />
          </View>
          <View>
            <Text style={s.title}>HERNI<Text style={s.titleGrad}>PRINT</Text></Text>
            <View style={s.statusRow}>
              <View style={[s.dot, isConnected ? s.dotGreen : s.dotRed]} />
              <Text style={[s.statusTxt, isConnected && { color: '#22c55e' }]}>
                {isConnected ? connectedDeviceName || 'Terhubung' : 'Terputus'}
              </Text>
            </View>
          </View>
        </View>
        <View style={s.headerRight}>
          <TouchableOpacity style={s.headerBtn} onPress={() => setConnModal(true)}>
            <Ionicons name="bluetooth" size={18} color={isConnected ? '#22c55e' : COLORS.primaryLight} />
          </TouchableOpacity>
          <TouchableOpacity style={s.headerBtn} onPress={() => setSettingsOpen(!settingsOpen)}>
            <Ionicons name="settings-sharp" size={18} color={settingsOpen ? '#f59e0b' : COLORS.primaryLight} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView style={s.main} contentContainerStyle={s.mainInner}>
        {/* ═══ TAB BAR ═══ */}
        <View style={s.tabBar}>
          {TABS.map((t) => (
            <TouchableOpacity
              key={t.id}
              style={[s.tabBtn, tab === t.id && s.tabBtnActive]}
              onPress={() => setTab(t.id)}
            >
              <Ionicons name={t.icon as any} size={14} color={tab === t.id ? COLORS.primaryLight : COLORS.textMuted} />
              <Text style={[s.tabLabel, tab === t.id && s.tabLabelActive]}>{t.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* ═══ PRINTER MODE TOGGLE ═══ */}
        <View style={s.printerModeCard}>
          <View style={s.modeRow}>
            <TouchableOpacity
              style={[s.printerModeBtn, printerMode === 'thermal' && s.printerModeBtnActive]}
              onPress={() => setPrinterMode('thermal')}
            >
              <Ionicons name="bluetooth" size={14} color={printerMode === 'thermal' ? '#fff' : COLORS.textMuted} />
              <Text style={[s.printerModeTxt, printerMode === 'thermal' && s.printerModeTxtActive]}>THERMAL</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.printerModeBtn, printerMode === 'standard' && s.printerModeBtnActiveGreen]}
              onPress={() => setPrinterMode('standard')}
            >
              <Ionicons name="print" size={14} color={printerMode === 'standard' ? '#fff' : COLORS.textMuted} />
              <Text style={[s.printerModeTxt, printerMode === 'standard' && s.printerModeTxtActive]}>PRINTER BESAR</Text>
            </TouchableOpacity>
          </View>
          <Text style={s.printerModeHint}>
            {printerMode === 'thermal'
              ? '🔵 Cetak hitam-putih via Bluetooth (struk, label, resi)'
              : '🟢 Cetak warna via WiFi/USB (Epson, Canon, HP, dll)'}
          </Text>
        </View>

        {/* ═══ STANDARD PRINT SETTINGS ═══ */}
        {printerMode === 'standard' && (
          <StandardPrintSettingsPanel
            settings={stdSettings}
            onChange={setStdSettings}
          />
        )}

        {/* ═══ FORM AREA ═══ */}
        {tab === 'img' && (
          <TouchableOpacity style={s.uploadBox} onPress={pickImage} activeOpacity={0.8}>
            <Ionicons name="cloud-upload" size={36} color={COLORS.primaryLight} />
            <Text style={s.uploadTitle}>Pilih atau Seret Gambar</Text>
            <Text style={s.uploadSub}>PNG, JPG, WEBP (Max 5MB)</Text>
          </TouchableOpacity>
        )}

        {tab === 'pdf' && (
          <View style={{ gap: 10 }}>
            {/* Upload / Change button */}
            <TouchableOpacity style={[s.uploadBox, { borderColor: pdfUri ? 'rgba(16,185,129,0.4)' : 'rgba(239,68,68,0.3)' }]} onPress={pickPdf} activeOpacity={0.8}>
              <Ionicons name={pdfUri ? 'swap-horizontal' : 'document-text'} size={pdfUri ? 24 : 36} color={pdfUri ? '#10b981' : '#ef4444'} />
              <Text style={s.uploadTitle}>{pdfUri ? 'Ganti File PDF' : 'Unggah Dokumen PDF'}</Text>
              <Text style={s.uploadSub}>{pdfUri ? pdfName : 'Halaman pertama otomatis dikonversi ke gambar'}</Text>
            </TouchableOpacity>

            {/* PDF conversion status */}
            {pdfUri && (
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 4 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 }}>
                  {pdfConverting ? (
                    <>
                      <ActivityIndicator size="small" color="#f59e0b" />
                      <Text style={{ fontSize: 10, color: '#f59e0b', fontWeight: '600' }}>
                        {pdfTotalPages > 0
                          ? `Mengkonversi halaman ${pdfCurrentPage} dari ${pdfTotalPages}...`
                          : 'Memuat PDF...'}
                      </Text>
                    </>
                  ) : pdfImageUri ? (
                    <>
                      <Ionicons name="checkmark-circle" size={14} color="#10b981" />
                      <Text style={{ fontSize: 10, color: '#10b981', fontWeight: '600' }}>
                        ✅ Halaman {pdfCurrentPage}{pdfTotalPages > 1 ? `/${pdfTotalPages}` : ''} siap cetak
                      </Text>
                    </>
                  ) : (
                    <>
                      <Ionicons name="alert-circle" size={14} color="#ef4444" />
                      <Text style={{ fontSize: 10, color: '#ef4444', fontWeight: '600' }}>Konversi gagal — periksa internet</Text>
                    </>
                  )}
                </View>
                <TouchableOpacity onPress={clearPdf}>
                  <Ionicons name="close-circle" size={20} color="rgba(255,255,255,0.3)" />
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}

        {tab === 'resi' && (
          <View style={s.formCard}>
            {/* Mode switcher */}
            <View style={s.modeRow}>
              <TouchableOpacity style={[s.modeBtn, resiMode === 'resi' && s.modeBtnActive]} onPress={() => setResiMode('resi')}>
                <Text style={[s.modeTxt, resiMode === 'resi' && s.modeTxtActive]}>RESI</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.modeBtn, resiMode === 'label' && s.modeBtnActive]} onPress={() => setResiMode('label')}>
                <Text style={[s.modeTxt, resiMode === 'label' && s.modeTxtActive]}>LABEL BARANG</Text>
              </TouchableOpacity>
            </View>

            {resiMode === 'resi' ? (
              <View style={s.fields}>
                <View style={s.row}>
                  <TextInput style={[s.input, s.flex1]} placeholder="Nama Penerima" placeholderTextColor="#64748b" value={nama} onChangeText={setNama} />
                  <TextInput style={[s.input, s.flex1]} placeholder="No. Resi" placeholderTextColor="#64748b" value={noResi} onChangeText={setNoResi} />
                </View>
                <TextInput style={[s.input, { height: 70, textAlignVertical: 'top' }]} placeholder="Alamat Pengiriman Lengkap..." placeholderTextColor="#64748b" multiline value={alamat} onChangeText={setAlamat} />
              </View>
            ) : (
              <View style={s.fields}>
                <View style={s.labelHead}>
                  <Text style={s.labelCount}>{labelItems.length}/100 item</Text>
                  <TouchableOpacity style={s.addBtn} onPress={addLabelItem} disabled={labelItems.length >= 100}>
                    <Ionicons name="add" size={14} color="#fff" />
                    <Text style={s.addTxt}>Tambah</Text>
                  </TouchableOpacity>
                </View>
                {labelItems.map((item, idx) => (
                  <View key={item.id} style={s.labelItem}>
                    <View style={s.labelItemHead}>
                      <Text style={{ fontSize: 10, fontWeight: '700', color: COLORS.primaryLight }}>#{idx+1}</Text>
                      <TouchableOpacity onPress={() => removeLabelItem(item.id)}>
                        <Ionicons name="close-circle" size={16} color={COLORS.error} />
                      </TouchableOpacity>
                    </View>
                    <TextInput style={s.input} placeholder="Nama Barang" placeholderTextColor="#64748b" value={item.name} onChangeText={(v) => updateLabelItem(item.id, 'name', v)} />
                    <View style={s.row}>
                      <TextInput style={[s.input, s.flex1]} placeholder="Harga Satuan" placeholderTextColor="#64748b" keyboardType="numeric" value={item.price ? String(item.price) : ''} onChangeText={(v) => updateLabelItem(item.id, 'price', parseInt(v) || 0)} />
                      <TextInput style={[s.input, { width: 70 }]} placeholder="Qty" placeholderTextColor="#64748b" keyboardType="numeric" value={item.qty ? String(item.qty) : ''} onChangeText={(v) => updateLabelItem(item.id, 'qty', parseInt(v) || 1)} />
                    </View>
                  </View>
                ))}
                <View style={s.totalBox}>
                  <Text style={{ fontSize: 10, fontWeight: '700', color: COLORS.primaryLight }}>ESTIMASI TOTAL</Text>
                  <Text style={{ fontSize: 13, fontWeight: '900', color: '#fff' }}>{formatRupiah(labelTotal)}</Text>
                </View>
              </View>
            )}
          </View>
        )}

        {tab === 'code' && (
          <View style={s.formCard}>
            <View style={s.modeRow}>
              <TouchableOpacity style={[s.modeBtn, codeType === 'qr' && s.modeBtnActive]} onPress={() => setCodeType('qr')}>
                <Text style={[s.modeTxt, codeType === 'qr' && s.modeTxtActive]}>QR CODE</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.modeBtn, codeType === 'barcode' && s.modeBtnActive]} onPress={() => setCodeType('barcode')}>
                <Text style={[s.modeTxt, codeType === 'barcode' && s.modeTxtActive]}>BARCODE</Text>
              </TouchableOpacity>
            </View>
            <TextInput style={[s.input, { textAlign: 'center', paddingVertical: 12 }]} placeholder="Masukkan Teks atau URL" placeholderTextColor="#64748b" value={codeInput} onChangeText={setCodeInput} />
          </View>
        )}

        {/* ═══ PREVIEW AREA ═══ */}
        <View style={s.previewArea}>
          <View style={[s.paper, paperWidth === 80 && s.paper80]}>
            {/* Image preview */}
            {tab === 'img' && imageUri && (
              <Image source={{ uri: imageUri }} style={{ width: '100%', height: 180 }} resizeMode="contain" />
            )}
            {/* PDF preview — shows converted image with page navigation */}
            {tab === 'pdf' && pdfUri && (
              <View style={{ alignItems: 'center', gap: 8 }}>
                {pdfConverting ? (
                  <View style={{ alignItems: 'center', paddingVertical: 40, gap: 10 }}>
                    <ActivityIndicator size="large" color="#f59e0b" />
                    <Text style={{ fontSize: 11, color: '#f59e0b', fontWeight: '600' }}>
                      {pdfTotalPages > 0 ? `Mengkonversi halaman ${pdfCurrentPage}...` : 'Memuat PDF...'}
                    </Text>
                    <Text style={{ fontSize: 9, color: '#888' }}>Memerlukan koneksi internet</Text>
                  </View>
                ) : pdfImageUri ? (
                  <View style={{ width: '100%', alignItems: 'center' }}>
                    <Image source={{ uri: pdfImageUri }} style={{ width: '100%', height: 300 }} resizeMode="contain" />

                    {/* Page navigation */}
                    {pdfTotalPages > 1 && (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 10, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 20, paddingHorizontal: 6, paddingVertical: 4 }}>
                        <TouchableOpacity
                          onPress={pdfPrevPage}
                          disabled={pdfCurrentPage <= 1}
                          style={{ opacity: pdfCurrentPage <= 1 ? 0.3 : 1, padding: 6 }}
                        >
                          <Ionicons name="chevron-back" size={18} color="#fff" />
                        </TouchableOpacity>
                        <Text style={{ fontSize: 11, fontWeight: '800', color: '#fff', minWidth: 60, textAlign: 'center' }}>
                          {pdfCurrentPage} / {pdfTotalPages}
                        </Text>
                        <TouchableOpacity
                          onPress={pdfNextPage}
                          disabled={pdfCurrentPage >= pdfTotalPages}
                          style={{ opacity: pdfCurrentPage >= pdfTotalPages ? 0.3 : 1, padding: 6 }}
                        >
                          <Ionicons name="chevron-forward" size={18} color="#fff" />
                        </TouchableOpacity>
                      </View>
                    )}

                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6 }}>
                      <Ionicons name="checkmark-circle" size={12} color="#10b981" />
                      <Text style={{ fontSize: 9, color: '#10b981', fontWeight: '700' }}>
                        SIAP CETAK{pdfTotalPages > 1 ? ` • HALAMAN ${pdfCurrentPage}` : ''}
                      </Text>
                    </View>
                  </View>
                ) : (
                  <View style={{ alignItems: 'center', paddingVertical: 30, gap: 8 }}>
                    <Ionicons name="alert-circle" size={36} color="#ef4444" />
                    <Text style={{ fontSize: 10, color: '#ef4444', fontWeight: '600' }}>Konversi gagal</Text>
                    <Text style={{ fontSize: 9, color: '#888', textAlign: 'center', paddingHorizontal: 10 }}>
                      Pastikan koneksi internet aktif
                    </Text>
                    <TouchableOpacity
                      style={{ backgroundColor: 'rgba(239,68,68,0.15)', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8 }}
                      onPress={() => { const uri = pdfUri; const name = pdfName; clearPdf(); setTimeout(() => { setPdfUri(uri); setPdfName(name); setPdfConverting(true); }, 300); }}
                    >
                      <Text style={{ fontSize: 10, color: '#ef4444', fontWeight: '700' }}>Coba Lagi</Text>
                    </TouchableOpacity>
                  </View>
                )}
                <Text style={{ fontSize: 9, fontWeight: '600', color: '#888', textAlign: 'center' }}>
                  {pdfName}{pdfTotalPages > 0 ? ` • ${pdfTotalPages} halaman` : ''}
                </Text>
              </View>
            )}
            {/* Resi/Label preview */}
            {tab === 'resi' && (
              <Text style={s.monoText}>{previewText}</Text>
            )}
            {/* QR/Barcode preview */}
            {tab === 'code' && codeInput.trim() ? (
              <View style={{ alignItems: 'center', paddingVertical: 16 }}>
                {codeType === 'qr' ? (
                  <QRCode value={codeInput} size={140} backgroundColor="white" color="black" />
                ) : (
                  <View style={{ alignItems: 'center', gap: 6 }}>
                    <View style={{ flexDirection: 'row', height: 50, gap: 1 }}>
                      {codeInput.split('').map((c, i) => (
                        <View key={i} style={{ width: (c.charCodeAt(0) % 3) + 1, backgroundColor: '#000', marginRight: 1 }} />
                      ))}
                    </View>
                    <Text style={{ fontSize: 10, fontWeight: '600', color: '#000' }}>{codeInput}</Text>
                  </View>
                )}
              </View>
            ) : null}
            {/* Empty state */}
            {((tab === 'img' && !imageUri) || (tab === 'pdf' && !pdfUri) || (tab === 'code' && !codeInput.trim())) && (tab as string) !== 'resi' && (
              <View style={s.empty}>
                <Ionicons name="print" size={32} color="rgba(0,0,0,0.15)" />
                <Text style={s.emptyTxt}>Siap Mencetak</Text>
              </View>
            )}
            <View style={s.paperEdge} />
          </View>

          {/* Paper & Contrast Controls (thermal only) */}
          {printerMode === 'thermal' && <View style={s.ctrlRow}>
            <View style={s.ctrlCard}>
              <Text style={s.ctrlLabel}>KERTAS</Text>
              <View style={s.ctrlBtns}>
                <TouchableOpacity style={[s.ctrlBtn, paperWidth === 58 && s.ctrlBtnActive]} onPress={() => setPaperWidth(58)}>
                  <Text style={[s.ctrlBtnTxt, paperWidth === 58 && { color: '#fff' }]}>58mm</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[s.ctrlBtn, paperWidth === 80 && s.ctrlBtnActive]} onPress={() => setPaperWidth(80)}>
                  <Text style={[s.ctrlBtnTxt, paperWidth === 80 && { color: '#fff' }]}>80mm</Text>
                </TouchableOpacity>
              </View>
            </View>
            <View style={s.ctrlCard}>
              <Text style={s.ctrlLabel}>KONTRAS</Text>
              <Slider
                style={{ width: 90, height: 28 }}
                minimumValue={0.5} maximumValue={2.0} value={contrast}
                onValueChange={setContrast}
                minimumTrackTintColor={COLORS.primary}
                maximumTrackTintColor="rgba(255,255,255,0.2)"
                thumbTintColor={COLORS.primaryLight}
              />
            </View>
          </View>}
        </View>

        {/* ═══ SETTINGS PANEL ═══ */}
        {settingsOpen && (
          <View style={s.settingsCard}>
            {/* ── Pengaturan Toko ── */}
            <View style={s.settingsHeader}>
              <Ionicons name="storefront" size={16} color={COLORS.primaryLight} />
              <Text style={s.settingsTitle}>PENGATURAN TOKO</Text>
            </View>
            <Text style={s.settingsLabel}>Nama Toko (muncul di struk)</Text>
            <TextInput style={s.input} value={storeName} onChangeText={setStoreName} placeholder="Nama toko Anda" placeholderTextColor="#64748b" />
            <Text style={s.settingsLabel}>Kontak Toko</Text>
            <TextInput style={s.input} value={storeContact} onChangeText={setStoreContact} placeholder="No. HP / Email" placeholderTextColor="#64748b" />

            {/* ── Divider ── */}
            <View style={s.settingsDivider} />

            {/* ── Pengaturan Cetak Default ── */}
            <View style={s.settingsHeader}>
              <Ionicons name="print" size={16} color="#10b981" />
              <Text style={[s.settingsTitle, { color: '#10b981' }]}>PENGATURAN CETAK</Text>
            </View>
            <Text style={s.settingsLabel}>Kertas Default</Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {[58, 80].map((pw) => (
                <TouchableOpacity
                  key={pw}
                  style={[s.settingsChip, paperWidth === pw && s.settingsChipActive]}
                  onPress={() => setPaperWidth(pw as 58 | 80)}
                >
                  <Text style={[s.settingsChipTxt, paperWidth === pw && { color: '#fff' }]}>{pw}mm</Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={s.settingsLabel}>Ketajaman Default</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Slider
                minimumValue={1} maximumValue={10} step={1}
                value={printSharpness} onValueChange={setPrintSharpness}
                minimumTrackTintColor={COLORS.primary}
                maximumTrackTintColor="rgba(255,255,255,0.15)"
                thumbTintColor={COLORS.primaryLight}
                style={{ flex: 1, height: 36 }}
              />
              <Text style={{ fontSize: 12, fontWeight: '800', color: COLORS.primaryLight }}>{printSharpness}/10</Text>
            </View>

            {/* ── Divider ── */}
            <View style={s.settingsDivider} />

            {/* ── Hubungi Kami ── */}
            <View style={s.settingsHeader}>
              <Ionicons name="chatbubbles" size={16} color="#38bdf8" />
              <Text style={[s.settingsTitle, { color: '#38bdf8' }]}>HUBUNGI KAMI</Text>
            </View>
            <TouchableOpacity
              style={s.settingsLink}
              onPress={() => {
                Linking.openURL('https://t.me/altomediaindonesia');
              }}
            >
              <View style={[s.settingsLinkIcon, { backgroundColor: 'rgba(0,136,204,0.15)' }]}>
                <Ionicons name="paper-plane" size={16} color="#0088cc" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.settingsLinkTitle}>Telegram</Text>
                <Text style={s.settingsLinkSub}>@altomediaindonesia</Text>
              </View>
              <Ionicons name="open-outline" size={14} color={COLORS.textMuted} />
            </TouchableOpacity>
            <TouchableOpacity
              style={s.settingsLink}
              onPress={() => {
                Linking.openURL('https://instagram.com/altomediaindonesia');
              }}
            >
              <View style={[s.settingsLinkIcon, { backgroundColor: 'rgba(225,48,108,0.15)' }]}>
                <Ionicons name="logo-instagram" size={16} color="#E1306C" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.settingsLinkTitle}>Instagram</Text>
                <Text style={s.settingsLinkSub}>@altomediaindonesia</Text>
              </View>
              <Ionicons name="open-outline" size={14} color={COLORS.textMuted} />
            </TouchableOpacity>

            {/* ── Divider ── */}
            <View style={s.settingsDivider} />

            {/* ── Tentang Aplikasi ── */}
            <View style={s.settingsHeader}>
              <Ionicons name="information-circle" size={16} color="#a78bfa" />
              <Text style={[s.settingsTitle, { color: '#a78bfa' }]}>TENTANG APLIKASI</Text>
            </View>
            <View style={s.settingsAboutBox}>
              <Text style={{ fontSize: 18, fontWeight: '900', color: '#fff', textAlign: 'center' }}>🖨️ HERNIPRINT</Text>
              <Text style={{ fontSize: 10, color: COLORS.textMuted, textAlign: 'center', marginTop: 4 }}>
                Versi 2.1.0 (Build 3)
              </Text>
              <Text style={{ fontSize: 10, color: COLORS.textSecondary, textAlign: 'center', marginTop: 8, lineHeight: 16 }}>
                Aplikasi pencetakan profesional untuk printer thermal (Bluetooth) dan printer besar (WiFi/USB).{'\n'}
                Mendukung cetak gambar, PDF, struk/resi, label, QR Code, dan Barcode.
              </Text>
              <Text style={{ fontSize: 10, color: COLORS.primaryLight, textAlign: 'center', marginTop: 8, fontWeight: '700' }}>
                © 2026 Alto Media Indonesia
              </Text>
            </View>

            {/* ── Divider ── */}
            <View style={s.settingsDivider} />

            {/* ── Kebijakan Privasi ── */}
            <View style={s.settingsHeader}>
              <Ionicons name="shield-checkmark" size={16} color="#22c55e" />
              <Text style={[s.settingsTitle, { color: '#22c55e' }]}>KEBIJAKAN PRIVASI</Text>
            </View>
            <View style={s.settingsTextBox}>
              <Text style={s.settingsBodyTxt}>
                HERNIPRINT menghormati privasi pengguna. Kami mengumpulkan data minimal yang diperlukan untuk fungsi aplikasi:{'\n\n'}
                • <Text style={{ fontWeight: '700' }}>Bluetooth & Lokasi</Text> — Diperlukan untuk mendeteksi dan menghubungkan printer thermal.{'\n'}
                • <Text style={{ fontWeight: '700' }}>Penyimpanan</Text> — Untuk mengakses file gambar dan PDF yang akan dicetak.{'\n'}
                • <Text style={{ fontWeight: '700' }}>Kamera</Text> — Untuk mengambil foto langsung dan memindai QR Code.{'\n'}
                • <Text style={{ fontWeight: '700' }}>Iklan</Text> — Kami menggunakan Google AdMob untuk menampilkan iklan. Google mungkin mengumpulkan data sesuai kebijakan mereka.{'\n\n'}
                Kami <Text style={{ fontWeight: '700' }}>tidak</Text> menyimpan, mengirim, atau membagikan dokumen/gambar yang Anda cetak ke server manapun. Semua pemrosesan dilakukan di perangkat Anda.
              </Text>
            </View>

            {/* ── Divider ── */}
            <View style={s.settingsDivider} />

            {/* ── Disclaimer ── */}
            <View style={s.settingsHeader}>
              <Ionicons name="alert-circle" size={16} color="#f59e0b" />
              <Text style={[s.settingsTitle, { color: '#f59e0b' }]}>DISCLAIMER</Text>
            </View>
            <View style={s.settingsTextBox}>
              <Text style={s.settingsBodyTxt}>
                Aplikasi ini disediakan "apa adanya" tanpa jaminan apapun. Alto Media Indonesia tidak bertanggung jawab atas:{'\n\n'}
                • Kerusakan printer akibat penggunaan aplikasi.{'\n'}
                • Kegagalan cetak karena masalah koneksi atau kompatibilitas printer.{'\n'}
                • Hasil cetak yang tidak sesuai ekspektasi.{'\n'}
                • Kerugian bisnis akibat penggunaan aplikasi.{'\n\n'}
                Pengguna bertanggung jawab penuh atas penggunaan aplikasi ini. Dengan menggunakan HERNIPRINT, Anda menyetujui syarat dan ketentuan ini.
              </Text>
            </View>

            {/* ── Versi & Lisensi ── */}
            <View style={s.settingsFooter}>
              <Text style={{ fontSize: 9, color: 'rgba(255,255,255,0.25)', textAlign: 'center', lineHeight: 14 }}>
                HERNIPRINT v2.0.0 • Dibuat dengan ❤️ di Indonesia{'\n'}
                © 2026 Alto Media Indonesia • Seluruh hak cipta dilindungi{'\n'}
                Powered by React Native & Expo
              </Text>
            </View>
          </View>
        )}
      </ScrollView>

      {/* ═══ FLOATING PRINT BUTTON ═══ */}
      <TouchableOpacity
        style={[s.fab, printing && { opacity: 0.5 }]}
        onPress={handlePrintPress} disabled={printing} activeOpacity={0.8}
      >
        <LinearGradient
          colors={printerMode === 'standard'
            ? ['#059669', '#10b981', '#34d399']
            : ['#4f46e5', '#6366f1', '#ec4899']}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={s.fabGradient}
        >
          <Ionicons name={printing ? 'sync' : printerMode === 'standard' ? 'color-palette' : 'flash'} size={30} color="#fff" />
        </LinearGradient>
      </TouchableOpacity>

      <AdBanner />

      {/* ═══ HIDDEN PDF CONVERTER (WebView + PDF.js) ═══ */}
      <PdfConverter ref={pdfConverterRef} defaultScale={2.0} />

      {/* ═══ PRE-PRINT SETTINGS POPUP ═══ */}
      <Modal visible={showPrintSettings} transparent animationType="slide" onRequestClose={() => setShowPrintSettings(false)}>
        <View style={s.modalOv}>
          <View style={[s.modalCard, { maxHeight: '80%' }]}>
            {/* Header */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Ionicons name="options" size={20} color={COLORS.primaryLight} />
                <Text style={{ fontSize: 16, fontWeight: '800', color: '#fff' }}>Pengaturan Cetak</Text>
              </View>
              <TouchableOpacity onPress={() => setShowPrintSettings(false)}>
                <Ionicons name="close" size={24} color="rgba(255,255,255,0.5)" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={{ gap: 16 }}>
              {/* Paper Size (thermal only) */}
              {printerMode === 'thermal' && (
                <View style={{ marginBottom: 16 }}>
                  <Text style={s.psLabel}>📄 Ukuran Kertas</Text>
                  <View style={{ flexDirection: 'row', gap: 10, marginTop: 8 }}>
                    {[58, 80].map((pw) => (
                      <TouchableOpacity
                        key={pw}
                        style={[s.psChip, paperWidth === pw && s.psChipActive]}
                        onPress={() => setPaperWidth(pw as 58 | 80)}
                      >
                        <Ionicons name="document-outline" size={16} color={paperWidth === pw ? '#fff' : COLORS.textMuted} />
                        <View>
                          <Text style={[s.psChipTxt, paperWidth === pw && s.psChipTxtActive]}>{pw}mm</Text>
                          <Text style={[s.psChipDesc, paperWidth === pw && { color: 'rgba(255,255,255,0.7)' }]}>
                            {pw === 58 ? '384 dots • 32 char' : '576 dots • 48 char'}
                          </Text>
                        </View>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              )}

              {/* Orientation */}
              <View style={{ marginBottom: 16 }}>
                <Text style={s.psLabel}>📐 Orientasi</Text>
                <View style={{ flexDirection: 'row', gap: 10, marginTop: 8 }}>
                  {([['portrait', 'Portrait', 'phone-portrait-outline'], ['landscape', 'Landscape', 'phone-landscape-outline']] as const).map(([val, lbl, ico]) => (
                    <TouchableOpacity
                      key={val}
                      style={[s.psChip, stdSettings.orientation === val && s.psChipActive, { flex: 1 }]}
                      onPress={() => setStdSettings(p => ({ ...p, orientation: val }))}
                    >
                      <Ionicons name={ico} size={18} color={stdSettings.orientation === val ? '#fff' : COLORS.textMuted} />
                      <Text style={[s.psChipTxt, stdSettings.orientation === val && s.psChipTxtActive]}>{lbl}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Alignment (thermal only — for image positioning) */}
              {printerMode === 'thermal' && (tab === 'img' || tab === 'pdf') && (
                <View style={{ marginBottom: 16 }}>
                  <Text style={s.psLabel}>↔️ Posisi Cetak</Text>
                  <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                    {([['left', 'Kiri', 'arrow-back'], ['center', 'Tengah', 'remove-outline'], ['right', 'Kanan', 'arrow-forward']] as const).map(([val, lbl, ico]) => (
                      <TouchableOpacity
                        key={val}
                        style={[s.psChip, printAlign === val && s.psChipActive, { flex: 1 }]}
                        onPress={() => setPrintAlign(val)}
                      >
                        <Ionicons name={ico} size={16} color={printAlign === val ? '#fff' : COLORS.textMuted} />
                        <Text style={[s.psChipTxt, printAlign === val && s.psChipTxtActive]}>{lbl}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              )}

              {/* Sharpness */}
              <View style={{ marginBottom: 16 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={s.psLabel}>🔆 Ketajaman</Text>
                  <Text style={{ fontSize: 14, fontWeight: '900', color: COLORS.primaryLight }}>{printSharpness}/10</Text>
                </View>
                <Slider
                  minimumValue={1}
                  maximumValue={10}
                  step={1}
                  value={printSharpness}
                  onValueChange={setPrintSharpness}
                  minimumTrackTintColor={COLORS.primary}
                  maximumTrackTintColor="rgba(255,255,255,0.15)"
                  thumbTintColor={COLORS.primaryLight}
                  style={{ marginTop: 8, height: 40 }}
                />
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text style={{ fontSize: 9, color: COLORS.textMuted }}>Lembut</Text>
                  <Text style={{ fontSize: 9, color: COLORS.textMuted }}>Tajam</Text>
                </View>
              </View>

              {/* Contrast (thermal only) */}
              {printerMode === 'thermal' && (
                <View style={{ marginBottom: 16 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text style={s.psLabel}>🌗 Kontras</Text>
                    <Text style={{ fontSize: 14, fontWeight: '900', color: COLORS.primaryLight }}>{Math.round(contrast * 100)}%</Text>
                  </View>
                  <Slider
                    minimumValue={0.5}
                    maximumValue={2.0}
                    step={0.1}
                    value={contrast}
                    onValueChange={setContrast}
                    minimumTrackTintColor={COLORS.primary}
                    maximumTrackTintColor="rgba(255,255,255,0.15)"
                    thumbTintColor={COLORS.primaryLight}
                    style={{ marginTop: 8, height: 40 }}
                  />
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <Text style={{ fontSize: 9, color: COLORS.textMuted }}>Terang</Text>
                    <Text style={{ fontSize: 9, color: COLORS.textMuted }}>Gelap</Text>
                  </View>
                </View>
              )}

              {/* Summary */}
              <View style={{ backgroundColor: 'rgba(0,0,0,0.3)', borderRadius: 12, padding: 12, marginBottom: 12 }}>
                <Text style={{ fontSize: 10, fontWeight: '700', color: COLORS.textMuted, marginBottom: 6 }}>RINGKASAN</Text>
                <Text style={{ fontSize: 11, color: '#fff', lineHeight: 18 }}>
                  {printerMode === 'thermal' ? `🖨️ Thermal ${paperWidth}mm` : '🖨️ Printer Besar'} • {stdSettings.orientation === 'portrait' ? '📱 Portrait' : '📱 Landscape'}
                  {printerMode === 'thermal' ? ` • ↔️ ${printAlign === 'center' ? 'Tengah' : printAlign === 'left' ? 'Kiri' : 'Kanan'}` : ''}
                  {' '}• 🔆 {printSharpness}/10{printerMode === 'thermal' ? ` • 🌗 ${Math.round(contrast * 100)}%` : ''}
                </Text>
              </View>
            </ScrollView>

            {/* Print Button */}
            <TouchableOpacity
              style={{ backgroundColor: COLORS.primary, borderRadius: 16, paddingVertical: 14, alignItems: 'center', marginTop: 8 }}
              onPress={handlePrint}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={printerMode === 'thermal' ? ['#7c3aed', '#6d28d9'] : ['#059669', '#047857']}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, borderRadius: 16 }}
              />
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Ionicons name="print" size={20} color="#fff" />
                <Text style={{ fontSize: 14, fontWeight: '900', color: '#fff', letterSpacing: 1 }}>CETAK SEKARANG</Text>
              </View>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ═══ PRINT PROGRESS ═══ */}
      <PrintProgress
        visible={showProgress}
        progress={printProgress}
        status={printStatus}
        stage={printStage}
      />

      {/* ═══ CONNECTION MODAL ═══ */}
      <Modal visible={connModal} transparent animationType="fade" onRequestClose={() => setConnModal(false)}>
        <View style={s.modalOv}>
          <View style={s.modalCard}>
            <TouchableOpacity style={s.modalClose} onPress={() => { setConnModal(false); stopScan(); setScanning(false); }}>
              <Ionicons name="close" size={18} color="#9ca3af" />
            </TouchableOpacity>
            <Text style={s.modalTitle}>Hubungkan <Text style={{ color: COLORS.primaryLight }}>Printer</Text></Text>
            <Text style={s.modalSub}>Pilih jenis koneksi printer thermal Anda.</Text>

            {isConnected && (
              <View style={s.connCard}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Ionicons name="checkmark-circle" size={18} color="#22c55e" />
                  <Text style={{ fontSize: 12, fontWeight: '700', color: '#22c55e' }}>{connectedDeviceName}</Text>
                </View>
                <TouchableOpacity onPress={() => disconnect()} style={{ backgroundColor: 'rgba(239,68,68,0.2)', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 }}>
                  <Text style={{ fontSize: 9, fontWeight: '800', color: COLORS.error }}>PUTUS</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Bluetooth */}
            <TouchableOpacity style={s.btBtn} onPress={startBLEScan} activeOpacity={0.8}>
              <View style={s.btIcon}><Ionicons name="bluetooth" size={20} color="#fff" /></View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 12, fontWeight: '700', color: '#fff' }}>Bluetooth</Text>
                <Text style={{ fontSize: 9, color: 'rgba(255,255,255,0.6)' }}>Direkomendasikan untuk Mobile</Text>
              </View>
              {scanning ? <ActivityIndicator size="small" color="#fff" /> : <Ionicons name="chevron-forward" size={12} color="rgba(255,255,255,0.4)" />}
            </TouchableOpacity>

            {/* USB */}
            <TouchableOpacity style={s.usbBtn} onPress={() => Alert.alert('USB/OTG', 'Hubungkan printer via kabel USB OTG.')} activeOpacity={0.8}>
              <View style={s.usbIcon}><Ionicons name="flash" size={20} color="#fff" /></View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 12, fontWeight: '700', color: '#fff' }}>USB / OTG</Text>
                <Text style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)' }}>Sangat Stabil untuk PC/Laptop</Text>
              </View>
              <Ionicons name="chevron-forward" size={12} color="rgba(255,255,255,0.2)" />
            </TouchableOpacity>

            {/* Device List */}
            {devices.length > 0 && (
              <View style={s.devList}>
                <Text style={s.devTitle}>Perangkat Terdeteksi</Text>
                {devices.map((d) => (
                  <TouchableOpacity key={d.id} style={s.devItem} onPress={() => handleConnect(d)} disabled={connecting !== null}>
                    <Ionicons name="print" size={14} color={COLORS.primaryLight} />
                    <Text style={{ flex: 1, fontSize: 12, fontWeight: '700', color: '#fff' }}>{d.name}</Text>
                    {connecting === d.id ? <ActivityIndicator size="small" color={COLORS.primaryLight} /> :
                      <Text style={s.devConnTxt}>HUBUNGKAN</Text>}
                  </TouchableOpacity>
                ))}
              </View>
            )}
            {scanning && devices.length === 0 && (
              <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 8, marginTop: 14 }}>
                <ActivityIndicator size="small" color={COLORS.primaryLight} />
                <Text style={{ fontSize: 11, color: COLORS.textSecondary }}>Mencari printer...</Text>
              </View>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
    </LinearGradient>
  );
}

// ─── STYLES ───────────────────────────────────────────────
const s = StyleSheet.create({
  root: { flex: 1 },
  // Header
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10 },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  logoBox: { width: 50, height: 50, backgroundColor: '#fff', borderRadius: 16, padding: 4, elevation: 8 },
  logo: { width: '100%', height: '100%' },
  title: { fontSize: 22, fontWeight: '900', color: '#fff', letterSpacing: -0.5 },
  titleGrad: { color: COLORS.primaryLight },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 1 },
  dot: { width: 7, height: 7, borderRadius: 4 },
  dotRed: { backgroundColor: '#ef4444' },
  dotGreen: { backgroundColor: '#22c55e' },
  statusTxt: { fontSize: 9, fontWeight: '700', color: COLORS.primaryLight, textTransform: 'uppercase', letterSpacing: 2 },
  headerRight: { flexDirection: 'row', gap: 8 },
  headerBtn: { width: 44, height: 44, borderRadius: 16, backgroundColor: COLORS.bgCard, borderWidth: 1, borderColor: COLORS.bgCardBorder, alignItems: 'center', justifyContent: 'center' },

  main: { flex: 1 },
  mainInner: { paddingHorizontal: 16, paddingBottom: 160, gap: 16 },

  // Tabs
  tabBar: { flexDirection: 'row', backgroundColor: COLORS.bgCard, borderRadius: 16, borderWidth: 1, borderColor: COLORS.bgCardBorder, padding: 5, gap: 4 },
  tabBtn: { flex: 1, alignItems: 'center', gap: 3, paddingVertical: 10, borderRadius: 12, borderWidth: 1, borderColor: 'transparent' },
  tabBtnActive: { backgroundColor: 'rgba(79,70,229,0.2)', borderColor: 'rgba(129,140,248,0.3)' },
  tabLabel: { fontSize: 9, fontWeight: '700', color: COLORS.textMuted },
  tabLabelActive: { color: COLORS.primaryLight },

  // Upload boxes
  uploadBox: { backgroundColor: COLORS.bgCard, borderRadius: 24, borderWidth: 2, borderStyle: 'dashed', borderColor: 'rgba(129,140,248,0.3)', padding: 28, alignItems: 'center', gap: 6 },
  uploadTitle: { fontSize: 13, fontWeight: '700', color: '#fff' },
  uploadSub: { fontSize: 10, color: 'rgba(255,255,255,0.4)' },

  // Form card
  formCard: { backgroundColor: COLORS.bgCard, borderRadius: 24, borderWidth: 1, borderColor: COLORS.bgCardBorder, padding: 16, gap: 10 },
  modeRow: { flexDirection: 'row', backgroundColor: 'rgba(0,0,0,0.4)', borderRadius: 12, padding: 3, gap: 3 },
  modeBtn: { flex: 1, paddingVertical: 7, borderRadius: 10, alignItems: 'center' },
  modeBtnActive: { backgroundColor: COLORS.primary, elevation: 4 },
  modeTxt: { fontSize: 10, fontWeight: '700', color: COLORS.textMuted },
  modeTxtActive: { color: '#fff' },
  fields: { gap: 10 },
  row: { flexDirection: 'row', gap: 10 },
  flex1: { flex: 1 },
  input: { backgroundColor: 'rgba(0,0,0,0.3)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, color: '#fff', fontSize: 12 },

  // Label
  labelHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  labelCount: { fontSize: 10, fontWeight: '600', color: COLORS.textSecondary },
  addBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: COLORS.primary, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 6 },
  addTxt: { fontSize: 10, fontWeight: '700', color: '#fff' },
  labelItem: { backgroundColor: 'rgba(0,0,0,0.2)', borderRadius: 14, padding: 10, gap: 8 },
  labelItemHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  totalBox: { backgroundColor: 'rgba(79,70,229,0.2)', borderRadius: 12, borderWidth: 1, borderColor: 'rgba(79,70,229,0.3)', padding: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },

  // Settings panel
  settingsCard: { backgroundColor: COLORS.bgCard, borderRadius: 20, borderWidth: 1, borderColor: COLORS.bgCardBorder, padding: 16, gap: 10, marginBottom: 16 },
  settingsDivider: { height: 1, backgroundColor: 'rgba(255,255,255,0.08)', marginVertical: 4 },
  settingsChip: { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: 10, backgroundColor: 'rgba(0,0,0,0.3)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' },
  settingsChipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primaryLight },
  settingsChipTxt: { fontSize: 12, fontWeight: '700', color: COLORS.textMuted },
  settingsLink: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, paddingHorizontal: 4 },
  settingsLinkIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  settingsLinkTitle: { fontSize: 12, fontWeight: '700', color: '#fff' },
  settingsLinkSub: { fontSize: 10, color: COLORS.textMuted, marginTop: 1 },
  settingsAboutBox: { backgroundColor: 'rgba(0,0,0,0.3)', borderRadius: 14, padding: 16, alignItems: 'center' },
  settingsTextBox: { backgroundColor: 'rgba(0,0,0,0.2)', borderRadius: 12, padding: 14 },
  settingsBodyTxt: { fontSize: 10, color: COLORS.textSecondary, lineHeight: 16 },
  settingsFooter: { paddingVertical: 8 },
  settingsHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  settingsTitle: { fontSize: 10, fontWeight: '800', color: COLORS.primaryLight, letterSpacing: 1 },
  settingsLabel: { fontSize: 10, fontWeight: '700', color: COLORS.textSecondary, marginTop: 4 },
  settingsAbout: { backgroundColor: 'rgba(0,0,0,0.2)', borderRadius: 12, padding: 12, marginTop: 6 },

  // Printer mode toggle
  printerModeCard: { backgroundColor: COLORS.bgCard, borderRadius: 20, borderWidth: 1, borderColor: COLORS.bgCardBorder, padding: 12, gap: 8 },
  printerModeBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: 12 },
  printerModeBtnActive: { backgroundColor: COLORS.primary, elevation: 4 },
  printerModeBtnActiveGreen: { backgroundColor: '#059669', elevation: 4 },
  printerModeTxt: { fontSize: 10, fontWeight: '800', color: COLORS.textMuted },
  printerModeTxtActive: { color: '#fff' },
  printerModeHint: { fontSize: 9, color: COLORS.textSecondary, textAlign: 'center' },

  // Preview
  previewArea: { backgroundColor: 'rgba(0,0,0,0.3)', borderRadius: 28, padding: 24, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
  paper: { width: 220, backgroundColor: '#fff', borderRadius: 2, padding: 16, minHeight: 150, elevation: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.5, shadowRadius: 20 },
  paper80: { width: 300 },
  monoText: { fontFamily: 'monospace', fontSize: 8, color: '#000', lineHeight: 11 },
  paperEdge: { position: 'absolute', bottom: -8, left: 0, right: 0, height: 8, backgroundColor: '#fff', borderBottomLeftRadius: 2, borderBottomRightRadius: 2 },
  empty: { alignItems: 'center', paddingVertical: 36, gap: 8 },
  emptyTxt: { fontSize: 9, fontWeight: '700', color: 'rgba(0,0,0,0.2)', textTransform: 'uppercase', letterSpacing: 2 },

  // Controls
  ctrlRow: { flexDirection: 'row', gap: 10, marginTop: 16, width: '100%' },
  ctrlCard: { flex: 1, backgroundColor: COLORS.bgCard, borderRadius: 14, borderWidth: 1, borderColor: COLORS.bgCardBorder, paddingHorizontal: 12, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  ctrlLabel: { fontSize: 9, fontWeight: '700', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase' },
  ctrlBtns: { flexDirection: 'row', gap: 4 },
  ctrlBtn: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  ctrlBtnActive: { backgroundColor: COLORS.primary },
  ctrlBtnTxt: { fontSize: 11, fontWeight: '700', color: COLORS.textMuted },

  // Pre-print settings popup
  psLabel: { fontSize: 12, fontWeight: '700', color: '#fff' },
  psChip: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingVertical: 12, borderRadius: 12, backgroundColor: 'rgba(0,0,0,0.3)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  psChipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primaryLight },
  psChipTxt: { fontSize: 12, fontWeight: '700', color: COLORS.textMuted },
  psChipTxtActive: { color: '#fff' },
  psChipDesc: { fontSize: 9, color: 'rgba(255,255,255,0.25)', marginTop: 1 },

  // FAB — positioned above banner ad (~60px banner height)
  fab: { position: 'absolute', bottom: 75, alignSelf: 'center', width: 72, height: 72, borderRadius: 36, overflow: 'hidden', elevation: 20, shadowColor: COLORS.primary, shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.5, shadowRadius: 24, zIndex: 20 },
  fabGradient: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center' },

  // Modal
  modalOv: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', alignItems: 'center', justifyContent: 'center', padding: 20 },
  modalCard: { width: '100%', maxWidth: 380, backgroundColor: COLORS.bgCard, borderRadius: 32, borderWidth: 1, borderColor: COLORS.bgCardBorder, padding: 28 },
  modalClose: { position: 'absolute', top: 20, right: 20, zIndex: 1 },
  modalTitle: { fontSize: 20, fontWeight: '700', color: '#fff', marginBottom: 4 },
  modalSub: { fontSize: 11, color: '#9ca3af', marginBottom: 20 },
  connCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: 'rgba(34,197,94,0.12)', borderRadius: 14, borderWidth: 1, borderColor: 'rgba(34,197,94,0.3)', padding: 12, marginBottom: 14 },
  btBtn: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: COLORS.primary, borderRadius: 20, padding: 14, marginBottom: 10 },
  btIcon: { width: 38, height: 38, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  usbBtn: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', borderRadius: 20, padding: 14, marginBottom: 10 },
  usbIcon: { width: 38, height: 38, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center' },
  devList: { backgroundColor: 'rgba(0,0,0,0.4)', borderRadius: 16, padding: 12, marginTop: 10 },
  devTitle: { fontSize: 9, fontWeight: '800', color: COLORS.primaryLight, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 },
  devItem: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' },
  devConnTxt: { fontSize: 9, fontWeight: '800', color: '#fff', backgroundColor: 'rgba(255,255,255,0.12)', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 6, overflow: 'hidden' },
});
