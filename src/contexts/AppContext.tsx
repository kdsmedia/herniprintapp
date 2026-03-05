import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { Alert } from 'react-native';
import { btManager, PrinterDevice, ConnectedPrinter } from '../utils/bluetooth';
import * as Storage from '../utils/storage';
import { PaperWidth } from '../constants/theme';

interface AppState {
  // Printer connection
  isConnected: boolean;
  printerName: string;
  connectedPrinter: ConnectedPrinter | null;
  isScanning: boolean;
  foundDevices: PrinterDevice[];
  
  // Settings
  paperWidth: PaperWidth;
  contrast: number;
  storeName: string;
  storeContact: string;
  
  // Label items
  labelItems: Storage.LabelItem[];
  
  // Actions
  scanForPrinters: () => Promise<void>;
  stopScan: () => void;
  connectToPrinter: (deviceId: string) => Promise<void>;
  disconnectPrinter: () => Promise<void>;
  sendToPrinter: (data: Uint8Array) => Promise<void>;
  setPaperWidth: (width: PaperWidth) => void;
  setContrast: (value: number) => void;
  setStoreName: (name: string) => void;
  setStoreContact: (contact: string) => void;
  addLabelItem: () => void;
  updateLabelItem: (id: string, field: keyof Storage.LabelItem, value: string | number) => void;
  removeLabelItem: (id: string) => void;
  clearLabelItems: () => void;
  getLabelTotal: () => number;
}

const AppContext = createContext<AppState | null>(null);

export function useApp(): AppState {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [isConnected, setIsConnected] = useState(false);
  const [printerName, setPrinterName] = useState('');
  const [connectedPrinter, setConnectedPrinter] = useState<ConnectedPrinter | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [foundDevices, setFoundDevices] = useState<PrinterDevice[]>([]);
  const [paperWidth, _setPaperWidth] = useState<PaperWidth>(58);
  const [contrast, _setContrast] = useState(120);
  const [storeName, _setStoreName] = useState('HERNIPRINT');
  const [storeContact, _setStoreContact] = useState('');
  const [labelItems, setLabelItems] = useState<Storage.LabelItem[]>([]);

  // Load settings on mount
  useEffect(() => {
    (async () => {
      const pw = await Storage.getPaperWidth();
      _setPaperWidth(pw as PaperWidth);
      const ct = await Storage.getContrast();
      _setContrast(ct);
      const sn = await Storage.getStoreName();
      _setStoreName(sn);
      const sc = await Storage.getStoreContact();
      _setStoreContact(sc);
      const items = await Storage.loadLabelItems();
      if (items.length > 0) setLabelItems(items);
    })();
  }, []);

  // Save label items when changed
  useEffect(() => {
    Storage.saveLabelItems(labelItems);
  }, [labelItems]);

  const scanForPrinters = useCallback(async () => {
    setFoundDevices([]);
    setIsScanning(true);
    try {
      await btManager.scanForPrinters((device) => {
        setFoundDevices((prev) => {
          if (prev.find((d) => d.id === device.id)) return prev;
          return [...prev, device];
        });
      }, 12000);
    } catch (e: any) {
      Alert.alert('Scan Error', e.message);
    } finally {
      setIsScanning(false);
    }
  }, []);

  const stopScan = useCallback(() => {
    btManager.stopScan();
    setIsScanning(false);
  }, []);

  const connectToPrinter = useCallback(async (deviceId: string) => {
    try {
      const printer = await btManager.connect(deviceId);
      setConnectedPrinter(printer);
      setIsConnected(true);
      setPrinterName(printer.device.name || 'Printer');
      
      btManager.onDisconnect(() => {
        setIsConnected(false);
        setConnectedPrinter(null);
        setPrinterName('');
      });
    } catch (e: any) {
      Alert.alert('Koneksi Gagal', e.message);
      throw e;
    }
  }, []);

  const disconnectPrinter = useCallback(async () => {
    await btManager.disconnect();
    setIsConnected(false);
    setConnectedPrinter(null);
    setPrinterName('');
  }, []);

  const sendToPrinter = useCallback(async (data: Uint8Array) => {
    if (!isConnected) throw new Error('Printer tidak terhubung');
    await btManager.sendData(data);
  }, [isConnected]);

  const setPaperWidth = useCallback((width: PaperWidth) => {
    _setPaperWidth(width);
    Storage.setPaperWidth(width);
  }, []);

  const setContrast = useCallback((value: number) => {
    _setContrast(value);
    Storage.setContrast(value);
  }, []);

  const setStoreName = useCallback((name: string) => {
    _setStoreName(name);
    Storage.setStoreName(name);
  }, []);

  const setStoreContact = useCallback((contact: string) => {
    _setStoreContact(contact);
    Storage.setStoreContact(contact);
  }, []);

  // Label item management
  const addLabelItem = useCallback(() => {
    if (labelItems.length >= 100) {
      Alert.alert('Batas Maksimal', 'Maksimal 100 item per label.');
      return;
    }
    setLabelItems((prev) => [
      ...prev,
      {
        id: Date.now().toString() + Math.random().toString(36).slice(2, 6),
        name: '',
        price: 0,
        qty: 1,
      },
    ]);
  }, [labelItems.length]);

  const updateLabelItem = useCallback(
    (id: string, field: keyof Storage.LabelItem, value: string | number) => {
      setLabelItems((prev) =>
        prev.map((item) => (item.id === id ? { ...item, [field]: value } : item))
      );
    },
    []
  );

  const removeLabelItem = useCallback((id: string) => {
    setLabelItems((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const clearLabelItems = useCallback(() => {
    setLabelItems([]);
  }, []);

  const getLabelTotal = useCallback(() => {
    return labelItems.reduce((sum, item) => sum + item.price * item.qty, 0);
  }, [labelItems]);

  return (
    <AppContext.Provider
      value={{
        isConnected, printerName, connectedPrinter, isScanning, foundDevices,
        paperWidth, contrast, storeName, storeContact,
        labelItems,
        scanForPrinters, stopScan, connectToPrinter, disconnectPrinter, sendToPrinter,
        setPaperWidth, setContrast, setStoreName, setStoreContact,
        addLabelItem, updateLabelItem, removeLabelItem, clearLabelItems, getLabelTotal,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}
