import AsyncStorage from '@react-native-async-storage/async-storage';

const KEYS = {
  STORE_NAME: '@herniprint/storeName',
  STORE_CONTACT: '@herniprint/storeContact',
  PAPER_WIDTH: '@herniprint/paperWidth',
  CONTRAST: '@herniprint/contrast',
  LAST_PRINTER: '@herniprint/lastPrinter',
  LABEL_ITEMS: '@herniprint/labelItems',
};

export async function getSetting(key: string, fallback: string = ''): Promise<string> {
  try {
    const val = await AsyncStorage.getItem(key);
    return val ?? fallback;
  } catch { return fallback; }
}

export async function setSetting(key: string, value: string): Promise<void> {
  try {
    await AsyncStorage.setItem(key, value);
  } catch (e) {
    console.warn('Storage write failed:', e);
  }
}

export async function getStoreName(): Promise<string> {
  return getSetting(KEYS.STORE_NAME, 'HERNIPRINT');
}

export async function setStoreName(name: string): Promise<void> {
  return setSetting(KEYS.STORE_NAME, name);
}

export async function getStoreContact(): Promise<string> {
  return getSetting(KEYS.STORE_CONTACT, '');
}

export async function setStoreContact(contact: string): Promise<void> {
  return setSetting(KEYS.STORE_CONTACT, contact);
}

export async function getPaperWidth(): Promise<number> {
  const v = await getSetting(KEYS.PAPER_WIDTH, '58');
  return parseInt(v) || 58;
}

export async function setPaperWidth(width: number): Promise<void> {
  return setSetting(KEYS.PAPER_WIDTH, String(width));
}

export async function getContrast(): Promise<number> {
  const v = await getSetting(KEYS.CONTRAST, '120');
  return parseInt(v) || 120;
}

export async function setContrast(value: number): Promise<void> {
  return setSetting(KEYS.CONTRAST, String(value));
}

export interface LabelItem {
  id: string;
  name: string;
  price: number;
  qty: number;
}

export async function saveLabelItems(items: LabelItem[]): Promise<void> {
  return setSetting(KEYS.LABEL_ITEMS, JSON.stringify(items));
}

export async function loadLabelItems(): Promise<LabelItem[]> {
  const raw = await getSetting(KEYS.LABEL_ITEMS, '[]');
  try { return JSON.parse(raw); } catch { return []; }
}

export { KEYS };
