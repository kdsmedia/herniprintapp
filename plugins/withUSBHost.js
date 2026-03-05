const { withAndroidManifest } = require('@expo/config-plugins');

/**
 * Config plugin: USB Host support for thermal printers.
 * Adds <uses-feature> for USB host to AndroidManifest.xml.
 * 
 * NOTE: We do NOT add meta-data/@xml/usb_device_filter because
 * generating res/xml/ via withDangerousMod has timing issues with AAPT2
 * on EAS Build. The app can still enumerate and communicate with USB
 * printers via the Android USB Host API without a device filter.
 * The filter only controls auto-launch when a USB device is plugged in.
 */
module.exports = function withUSBHost(config) {
  return withAndroidManifest(config, (config) => {
    const manifest = config.modResults.manifest;

    // Add <uses-feature android:name="android.hardware.usb.host" android:required="false" />
    if (!manifest['uses-feature']) manifest['uses-feature'] = [];
    if (!manifest['uses-feature'].some(f => f.$?.['android:name'] === 'android.hardware.usb.host')) {
      manifest['uses-feature'].push({
        $: {
          'android:name': 'android.hardware.usb.host',
          'android:required': 'false',
        },
      });
    }

    // Add intent-filter for USB_DEVICE_ATTACHED (without meta-data/xml reference)
    const mainActivity = manifest.application?.[0]?.activity?.[0];
    if (mainActivity) {
      if (!mainActivity['intent-filter']) mainActivity['intent-filter'] = [];
      
      const hasUSBFilter = mainActivity['intent-filter'].some(f =>
        f.action?.some(a => a.$?.['android:name'] === 'android.hardware.usb.action.USB_DEVICE_ATTACHED')
      );

      if (!hasUSBFilter) {
        mainActivity['intent-filter'].push({
          action: [{ $: { 'android:name': 'android.hardware.usb.action.USB_DEVICE_ATTACHED' } }],
          category: [{ $: { 'android:name': 'android.intent.category.DEFAULT' } }],
        });
      }
    }

    return config;
  });
};
