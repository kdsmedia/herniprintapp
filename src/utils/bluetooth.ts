/**
 * Bluetooth printer connection manager.
 * Uses react-native-ble-plx for BLE thermal printer communication.
 * Handles scanning, connecting, service discovery, and data transmission.
 */

import { BleManager, Device, Characteristic, State } from 'react-native-ble-plx';
import { PermissionsAndroid, Platform } from 'react-native';
import { Buffer } from 'buffer';

// Known BLE service UUIDs for thermal printers
const PRINTER_SERVICE_UUIDS = [
  '000018f0-0000-1000-8000-00805f9b34fb',
  '0000ff00-0000-1000-8000-00805f9b34fb',
  '0000ffe0-0000-1000-8000-00805f9b34fb',
  '49535343-fe7d-4ae5-8fa9-9fafd205e455',
  'e7810a71-73ae-499d-8c15-faa9aef0c3f2',
  '0000fee7-0000-1000-8000-00805f9b34fb',
  '00001800-0000-1000-8000-00805f9b34fb',
];

// Known writable characteristic UUIDs
const WRITE_CHAR_UUIDS = [
  '00002af1-0000-1000-8000-00805f9b34fb',
  '0000ff02-0000-1000-8000-00805f9b34fb',
  '0000ffe1-0000-1000-8000-00805f9b34fb',
  '49535343-8841-43f4-a8d4-ecbe34729bb3',
  'e7810a71-73ae-499d-8c15-faa9aef0c3f2',
  '0000fee7-0000-1000-8000-00805f9b34fb',
];

export interface PrinterDevice {
  id: string;
  name: string;
  rssi: number | null;
  type: 'ble';
}

export interface ConnectedPrinter {
  device: Device;
  serviceUUID: string;
  characteristicUUID: string;
  mtu: number;
}

class BluetoothPrinterManager {
  private manager: BleManager;
  private connectedPrinter: ConnectedPrinter | null = null;
  private isScanning = false;

  constructor() {
    this.manager = new BleManager();
  }

  /**
   * Request Bluetooth permissions for Android.
   */
  async requestPermissions(): Promise<boolean> {
    if (Platform.OS !== 'android') return true;

    try {
      const apiLevel = Platform.Version;
      
      if (apiLevel >= 31) {
        // Android 12+ (API 31+)
        const results = await PermissionsAndroid.requestMultiple([
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
        ]);
        return Object.values(results).every(
          (r) => r === PermissionsAndroid.RESULTS.GRANTED
        );
      } else {
        // Android 8-11
        const result = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION
        );
        return result === PermissionsAndroid.RESULTS.GRANTED;
      }
    } catch (e) {
      console.error('Permission request failed:', e);
      return false;
    }
  }

  /**
   * Check if Bluetooth is powered on.
   */
  async isBluetoothEnabled(): Promise<boolean> {
    const state = await this.manager.state();
    return state === State.PoweredOn;
  }

  /**
   * Wait for Bluetooth to be enabled.
   */
  waitForBluetooth(): Promise<void> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Bluetooth timeout')), 10000);
      const sub = this.manager.onStateChange((state) => {
        if (state === State.PoweredOn) {
          clearTimeout(timeout);
          sub.remove();
          resolve();
        }
      }, true);
    });
  }

  /**
   * Scan for BLE printers.
   */
  async scanForPrinters(
    onDeviceFound: (device: PrinterDevice) => void,
    durationMs: number = 10000
  ): Promise<void> {
    if (this.isScanning) return;
    
    const granted = await this.requestPermissions();
    if (!granted) throw new Error('Izin Bluetooth tidak diberikan');

    const enabled = await this.isBluetoothEnabled();
    if (!enabled) {
      await this.waitForBluetooth();
    }

    this.isScanning = true;
    const seen = new Set<string>();

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.manager.stopDeviceScan();
        this.isScanning = false;
        resolve();
      }, durationMs);

      this.manager.startDeviceScan(
        null, // Scan all (not filtered by service UUID — many printers don't advertise)
        { allowDuplicates: false },
        (error, device) => {
          if (error) {
            clearTimeout(timer);
            this.isScanning = false;
            reject(new Error('Scan gagal: ' + error.message));
            return;
          }
          if (device && device.name && !seen.has(device.id)) {
            seen.add(device.id);
            onDeviceFound({
              id: device.id,
              name: device.name || device.localName || 'Unknown',
              rssi: device.rssi,
              type: 'ble',
            });
          }
        }
      );
    });
  }

  /**
   * Stop scanning.
   */
  stopScan(): void {
    if (this.isScanning) {
      this.manager.stopDeviceScan();
      this.isScanning = false;
    }
  }

  /**
   * Connect to a BLE printer.
   */
  async connect(deviceId: string): Promise<ConnectedPrinter> {
    // Disconnect existing
    if (this.connectedPrinter) {
      await this.disconnect();
    }

    // Connect with timeout
    const device = await this.manager.connectToDevice(deviceId, {
      timeout: 15000,
      requestMTU: 512, // Request larger MTU
    });

    // Discover all services and characteristics
    await device.discoverAllServicesAndCharacteristics();
    const services = await device.services();

    let writeServiceUUID = '';
    let writeCharUUID = '';
    let foundWriteWithoutResponse = false;

    // Search for writable characteristic
    for (const service of services) {
      const chars = await service.characteristics();
      for (const char of chars) {
        const isWritable = char.isWritableWithResponse || char.isWritableWithoutResponse;
        if (!isWritable) continue;

        // Prefer write-without-response for speed
        if (char.isWritableWithoutResponse && !foundWriteWithoutResponse) {
          writeServiceUUID = service.uuid;
          writeCharUUID = char.uuid;
          foundWriteWithoutResponse = true;
        }
        
        // Fallback to write-with-response
        if (!writeCharUUID) {
          writeServiceUUID = service.uuid;
          writeCharUUID = char.uuid;
        }
      }
      if (foundWriteWithoutResponse) break;
    }

    if (!writeCharUUID) {
      await this.manager.cancelDeviceConnection(deviceId);
      throw new Error('Tidak ditemukan characteristic yang bisa ditulis pada printer.');
    }

    // Get actual MTU
    const mtu = device.mtu || 23;
    const effectiveChunk = Math.max(20, mtu - 3); // MTU - 3 for ATT header

    this.connectedPrinter = {
      device,
      serviceUUID: writeServiceUUID,
      characteristicUUID: writeCharUUID,
      mtu: effectiveChunk,
    };

    console.log(`Connected: service=${writeServiceUUID}, char=${writeCharUUID}, mtu=${effectiveChunk}`);

    // Monitor disconnect
    device.onDisconnected(() => {
      console.log('Printer disconnected');
      this.connectedPrinter = null;
    });

    return this.connectedPrinter;
  }

  /**
   * Disconnect from current printer.
   */
  async disconnect(): Promise<void> {
    if (this.connectedPrinter) {
      try {
        await this.manager.cancelDeviceConnection(this.connectedPrinter.device.id);
      } catch (e) {
        console.warn('Disconnect error:', e);
      }
      this.connectedPrinter = null;
    }
  }

  /**
   * Send data to connected printer.
   * Handles chunking and pacing for reliable transmission.
   */
  async sendData(data: Uint8Array): Promise<void> {
    if (!this.connectedPrinter) throw new Error('Printer tidak terhubung');

    const { device, serviceUUID, characteristicUUID, mtu } = this.connectedPrinter;
    const chunkSize = Math.min(mtu, 200); // Cap at 200 even with high MTU
    const totalChunks = Math.ceil(data.length / chunkSize);
    let retries = 0;
    const MAX_RETRIES = 3;

    for (let i = 0; i < data.length; i += chunkSize) {
      const chunk = data.slice(i, i + chunkSize);
      const b64 = Buffer.from(chunk).toString('base64');

      try {
        await device.writeCharacteristicWithoutResponseForService(
          serviceUUID,
          characteristicUUID,
          b64
        );
        retries = 0;
      } catch (e: any) {
        // Retry with write-with-response
        try {
          await device.writeCharacteristicWithResponseForService(
            serviceUUID,
            characteristicUUID,
            b64
          );
          retries = 0;
        } catch (e2: any) {
          if (retries < MAX_RETRIES) {
            retries++;
            await new Promise((r) => setTimeout(r, 100 * retries));
            i -= chunkSize; // Retry same chunk
            continue;
          }
          throw new Error(`Gagal mengirim data: ${e2.message}`);
        }
      }

      // Pace: small delay every 10 chunks
      if ((i / chunkSize) % 10 === 9) {
        await new Promise((r) => setTimeout(r, 30));
      }
    }
  }

  /**
   * Check if a printer is connected.
   */
  isConnected(): boolean {
    return this.connectedPrinter !== null;
  }

  /**
   * Get connected printer info.
   */
  getConnectedPrinter(): ConnectedPrinter | null {
    return this.connectedPrinter;
  }

  /**
   * Set disconnect callback.
   */
  onDisconnect(callback: () => void): void {
    if (this.connectedPrinter) {
      this.connectedPrinter.device.onDisconnected(() => {
        this.connectedPrinter = null;
        callback();
      });
    }
  }

  /**
   * Destroy manager (cleanup).
   */
  destroy(): void {
    this.stopScan();
    this.manager.destroy();
  }
}

// Singleton
export const btManager = new BluetoothPrinterManager();
