/**
 * AdMob Configuration — HERNIPRINT
 * App ID: ca-app-pub-6881903056221433~9544311237
 * All production ad unit IDs active
 */

// Production Ad Unit IDs
export const AD_IDS = {
  BANNER:       'ca-app-pub-6881903056221433/8151836929',
  INTERSTITIAL: 'ca-app-pub-6881903056221433/4583628593',
  NATIVE:       'ca-app-pub-6881903056221433/6255802918',
  REWARDED:     'ca-app-pub-6881903056221433/5792768487',
  APP_OPEN:     'ca-app-pub-6881903056221433/6607156703',
} as const;

/**
 * Always return production ad IDs.
 * AdMob akan otomatis menampilkan test ads jika device
 * terdaftar sebagai test device di AdMob console.
 */
export function getAdId(type: keyof typeof AD_IDS): string {
  return AD_IDS[type];
}
