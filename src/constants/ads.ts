import { Platform } from 'react-native';

// AdMob Unit IDs
export const AD_IDS = {
  BANNER: 'ca-app-pub-6881903056221433/8151836929',
  INTERSTITIAL: 'ca-app-pub-6881903056221433/4583628593',
  NATIVE: 'ca-app-pub-6881903056221433/6255802918',
  REWARDED: 'ca-app-pub-6881903056221433/5792768487',
  APP_OPEN: 'ca-app-pub-6881903056221433/6607156703',
} as const;

// Test IDs for development
export const TEST_AD_IDS = {
  BANNER: 'ca-app-pub-3940256099942544/6300978111',
  INTERSTITIAL: 'ca-app-pub-3940256099942544/1033173712',
  NATIVE: 'ca-app-pub-3940256099942544/2247696110',
  REWARDED: 'ca-app-pub-3940256099942544/5224354917',
  APP_OPEN: 'ca-app-pub-3940256099942544/9257395921',
} as const;

export const IS_DEV = __DEV__;

export function getAdId(type: keyof typeof AD_IDS): string {
  return IS_DEV ? TEST_AD_IDS[type] : AD_IDS[type];
}
