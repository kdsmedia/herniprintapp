/**
 * Bluetooth & USB Printing Engine
 * Handles BLE scanning, connection, and data transmission to thermal printers
 */

import { Platform, PermissionsAndroid, Alert, NativeModules } from 'react-native';
import { BleManager, Device, Characteristic } from 'react-native-ble-plx';

// Common thermal printer BLE service UUIDs
const PRINTER_SERVICE_UUIDS = [
  '000018f0-0000-1000-8000-00805f9b34fb',
  '0000ff00-0000-1000-8000-00805f9b34fb',
  '0000ffe0-0000-1000-8000-00805f9b34fb',
  '49535343-fe7d-4ae5-8fa9-9fafd205e455',
  'e7810a71-73ae-499d-8c15-faa9aef0c3f2',
  '0000fee7-0000-1000-8000-00805f9b34fb',
];

// Common writable characteristic UUIDs
const WRITABLE_CHAR_UUIDS = [
  '00002af1-0000-1000-8000-00805f9b34fb',
  '0000ff02-0000-1000-8000-00805f9b34fb',
  '0000ffe1-0000-1000-8000-00805f9b34fb',
  '49535343-8841-43f4-a8d4-ecbe34729bb3',
  'bef8d6c9-9c21-4c9e-b632-bd58c1009f9f',
];

let bleManager: BleManager | null = null;

function getManager(): BleManager {
  if (!bleManager) {
    bleManager = new BleManager();
  }
  return bleManager;
}

export interface PrinterDevice {
  id: string;
  name: string;
  type: 'bluetooth' | 'usb';
  device?: Device;
}

export interface PrinterConnection {
  device: PrinterDevice;
  characteristic?: Characteristic;
  isConnected: boolean;
}

let currentConnection: PrinterConnection | null = null;

// ─── Request Permissions ──────────────────────────────────
export async function requestBluetoothPermissions(): Promise<boolean> {
  if (Platform.OS !== 'android') return true;

  try {
    const apiLevel = Platform.Version;

    if (apiLevel >= 31) {
      const results = await PermissionsAndroid.requestMultiple([
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
      ]);
      return Object.values(results).every(
        (r) => r === PermissionsAndroid.RESULTS.GRANTED
      );
    } else {
      const result = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION
      );
      return result === PermissionsAndroid.RESULTS.GRANTED;
    }
  } catch (e) {
    console.error('Permission error:', e);
    return false;
  }
}

// ─── Scan for BLE Printers ────────────────────────────────
export function scanForPrinters(
  onFound: (device: PrinterDevice) => void,
  onError: (error: string) => void
): () => void {
  const manager = getManager();
  const found = new Set<string>();

  const subscription = manager.onStateChange((state) => {
    if (state === 'PoweredOn') {
      subscription.remove();
      startScan();
    } else if (state === 'PoweredOff') {
      onError('Bluetooth tidak aktif. Nyalakan Bluetooth terlebih dahulu.');
    }
  }, true);

  function startScan() {
    manager.startDeviceScan(null, { allowDuplicates: false }, (error, device) => {
      if (error) {
        console.error('Scan error:', error);
        return;
      }
      if (device && device.name && !found.has(device.id)) {
        found.add(device.id);
        onFound({
          id: device.id,
          name: device.name || 'Unknown Device',
          type: 'bluetooth',
          device,
        });
      }
    });
  }

  // Auto-stop after 15 seconds
  const timeout = setTimeout(() => {
    manager.stopDeviceScan();
  }, 15000);

  return () => {
    clearTimeout(timeout);
    manager.stopDeviceScan();
  };
}

export function stopScan() {
  try {
    getManager().stopDeviceScan();
  } catch (_) {}
}

// ─── Connect to BLE Printer ──────────────────────────────
export async function connectToPrinter(printer: PrinterDevice): Promise<PrinterConnection> {
  if (!printer.device) throw new Error('Device object missing');

  const manager = getManager();
  const device = await manager.connectToDevice(printer.device.id, {
    requestMTU: 512,
    timeout: 10000,
  });

  await device.discoverAllServicesAndCharacteristics();
  const services = await device.services();

  let writableChar: Characteristic | null = null;

  // Search through all services for writable characteristics
  for (const service of services) {
    const chars = await service.characteristics();
    for (const char of chars) {
      if (char.isWritableWithResponse || char.isWritableWithoutResponse) {
        // Prefer known printer characteristic UUIDs
        const uuid = char.uuid.toLowerCase();
        if (WRITABLE_CHAR_UUIDS.some((u) => uuid.includes(u.replace(/-/g, '').substring(4, 8)))) {
          writableChar = char;
          break;
        }
        // Fallback to first writable characteristic
        if (!writableChar) {
          writableChar = char;
        }
      }
    }
    if (writableChar && WRITABLE_CHAR_UUIDS.some((u) =>
      writableChar!.uuid.toLowerCase().includes(u.replace(/-/g, '').substring(4, 8))
    )) {
      break;
    }
  }

  if (!writableChar) {
    await device.cancelConnection();
    throw new Error('Tidak ditemukan karakteristik yang bisa ditulis pada printer ini.');
  }

  currentConnection = {
    device: { ...printer, device },
    characteristic: writableChar,
    isConnected: true,
  };

  // Monitor disconnection
  device.onDisconnected(() => {
    if (currentConnection?.device.id === printer.id) {
      currentConnection = { ...currentConnection, isConnected: false };
    }
  });

  return currentConnection;
}

// ─── Disconnect ───────────────────────────────────────────
export async function disconnectPrinter(): Promise<void> {
  if (currentConnection?.device.device) {
    try {
      await (currentConnection.device.device as Device).cancelConnection();
    } catch (_) {}
  }
  currentConnection = null;
}

// ─── Send Data to Printer ─────────────────────────────────
export async function sendToPrinter(data: Uint8Array): Promise<void> {
  if (!currentConnection?.isConnected || !currentConnection.characteristic) {
    throw new Error('Printer tidak terhubung. Hubungkan printer terlebih dahulu.');
  }

  const char = currentConnection.characteristic;
  const chunkSize = 128; // Safe BLE MTU chunk size
  const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

  for (let i = 0; i < data.length; i += chunkSize) {
    const chunk = data.slice(i, i + chunkSize);

    // Convert to base64 for BLE write
    const base64 = uint8ToBase64(chunk);

    if (char.isWritableWithoutResponse) {
      await char.writeWithoutResponse(base64);
    } else {
      await char.writeWithResponse(base64);
    }

    // Small delay between chunks to prevent buffer overflow
    await delay(20);
  }
}

// ─── Get Current Connection ───────────────────────────────
export function getCurrentConnection(): PrinterConnection | null {
  return currentConnection;
}

export function isConnected(): boolean {
  return currentConnection?.isConnected === true;
}

// ─── Utility ──────────────────────────────────────────────
function uint8ToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}
