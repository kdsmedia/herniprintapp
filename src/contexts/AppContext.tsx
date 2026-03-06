import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { PaperWidth } from '../constants/theme';
import {
  sendToPrinter as btSend,
  isConnected as btIsConnected,
  PrinterDevice,
  connectToPrinter,
  disconnectPrinter,
} from '../utils/bluetooth';

export interface LabelItem {
  id: string;
  name: string;
  price: number;
  qty: number;
}

interface AppState {
  // Connection
  isConnected: boolean;
  connectedDeviceName: string;
  connectDevice: (device: PrinterDevice) => Promise<void>;
  disconnect: () => Promise<void>;

  // Paper settings
  paperWidth: PaperWidth;
  setPaperWidth: (w: PaperWidth) => void;
  contrast: number;
  setContrast: (c: number) => void;

  // Printing
  sendToPrinter: (data: Uint8Array) => Promise<void>;

  // Label items
  labelItems: LabelItem[];
  addLabelItem: () => void;
  updateLabelItem: (id: string, field: keyof LabelItem, value: string | number) => void;
  removeLabelItem: (id: string) => void;
  clearLabelItems: () => void;
  getLabelTotal: () => number;

  // Settings
  storeName: string;
  setStoreName: (n: string) => void;
  storeContact: string;
  setStoreContact: (c: string) => void;
}

const AppContext = createContext<AppState>({} as AppState);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [isConnected, setIsConnected] = useState(false);
  const [connectedDeviceName, setConnectedDeviceName] = useState('');
  const [paperWidth, setPaperWidth] = useState<PaperWidth>(58);
  const [contrast, setContrast] = useState(1.0);
  const [labelItems, setLabelItems] = useState<LabelItem[]>([]);
  const [storeName, setStoreName] = useState('HERNIPRINT');
  const [storeContact, setStoreContact] = useState('');

  // Load saved settings
  useEffect(() => {
    AsyncStorage.multiGet(['storeName', 'storeContact', 'paperWidth']).then((pairs) => {
      pairs.forEach(([key, val]) => {
        if (!val) return;
        if (key === 'storeName') setStoreName(val);
        if (key === 'storeContact') setStoreContact(val);
        if (key === 'paperWidth') setPaperWidth(parseInt(val) as PaperWidth);
      });
    });
  }, []);

  // Save settings
  useEffect(() => {
    AsyncStorage.setItem('storeName', storeName);
  }, [storeName]);

  useEffect(() => {
    AsyncStorage.setItem('storeContact', storeContact);
  }, [storeContact]);

  useEffect(() => {
    AsyncStorage.setItem('paperWidth', String(paperWidth));
  }, [paperWidth]);

  const connectDevice = useCallback(async (device: PrinterDevice) => {
    try {
      await connectToPrinter(device);
      setIsConnected(true);
      setConnectedDeviceName(device.name);
    } catch (e: any) {
      throw e;
    }
  }, []);

  const disconnect = useCallback(async () => {
    await disconnectPrinter();
    setIsConnected(false);
    setConnectedDeviceName('');
  }, []);

  const sendData = useCallback(async (data: Uint8Array) => {
    if (!btIsConnected()) {
      throw new Error('Printer tidak terhubung');
    }
    await btSend(data);
  }, []);

  const addLabelItem = useCallback(() => {
    if (labelItems.length >= 100) {
      Alert.alert('Batas Maksimal', 'Maksimal 100 item per label.');
      return;
    }
    setLabelItems((prev) => [
      ...prev,
      { id: Date.now().toString(), name: '', price: 0, qty: 1 },
    ]);
  }, [labelItems.length]);

  const updateLabelItem = useCallback(
    (id: string, field: keyof LabelItem, value: string | number) => {
      setLabelItems((prev) =>
        prev.map((item) => (item.id === id ? { ...item, [field]: value } : item))
      );
    },
    []
  );

  const removeLabelItem = useCallback((id: string) => {
    setLabelItems((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const clearLabelItems = useCallback(() => setLabelItems([]), []);

  const getLabelTotal = useCallback(
    () => labelItems.reduce((sum, i) => sum + i.price * i.qty, 0),
    [labelItems]
  );

  return (
    <AppContext.Provider
      value={{
        isConnected,
        connectedDeviceName,
        connectDevice,
        disconnect,
        paperWidth,
        setPaperWidth,
        contrast,
        setContrast,
        sendToPrinter: sendData,
        labelItems,
        addLabelItem,
        updateLabelItem,
        removeLabelItem,
        clearLabelItems,
        getLabelTotal,
        storeName,
        setStoreName,
        storeContact,
        setStoreContact,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export const useApp = () => useContext(AppContext);
