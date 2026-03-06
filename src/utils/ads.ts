/**
 * AdMob Ad Management
 * Handles all ad types: interstitial, rewarded, app-open
 * Banner is handled by AdBanner component
 * 
 * Ad IDs:
 * - Banner: ca-app-pub-6881903056221433/8151836929
 * - Interstitial: ca-app-pub-6881903056221433/4583628593
 * - Native: ca-app-pub-6881903056221433/6255802918
 * - Rewarded: ca-app-pub-6881903056221433/5792768487
 * - App Open: ca-app-pub-6881903056221433/6607156703
 */

import {
  InterstitialAd,
  RewardedAd,
  AppOpenAd,
  AdEventType,
  RewardedAdEventType,
} from 'react-native-google-mobile-ads';
import { getAdId } from '../constants/ads';

// ─── Cooldowns ────────────────────────────────────────────
let lastInterstitialTime = 0;
let lastAppOpenTime = 0;
const INTERSTITIAL_COOLDOWN = 60_000;  // 1 min between interstitials
const APP_OPEN_COOLDOWN = 300_000;     // 5 min between app-open ads

// ─── Ad Instances ─────────────────────────────────────────
let interstitialAd: InterstitialAd | null = null;
let interstitialLoaded = false;

// ─── Interstitial ─────────────────────────────────────────
export function preloadInterstitial(): void {
  try {
    interstitialLoaded = false;
    interstitialAd = InterstitialAd.createForAdRequest(getAdId('INTERSTITIAL'), {
      requestNonPersonalizedAdsOnly: false,
    });

    interstitialAd.addAdEventListener(AdEventType.LOADED, () => {
      interstitialLoaded = true;
    });

    interstitialAd.addAdEventListener(AdEventType.ERROR, () => {
      interstitialLoaded = false;
      // Retry after 30s
      setTimeout(preloadInterstitial, 30_000);
    });

    interstitialAd.addAdEventListener(AdEventType.CLOSED, () => {
      lastInterstitialTime = Date.now();
      interstitialLoaded = false;
      // Preload next ad
      setTimeout(preloadInterstitial, 5_000);
    });

    interstitialAd.load();
  } catch (e) {
    console.warn('Interstitial preload error:', e);
  }
}

export async function showInterstitial(): Promise<boolean> {
  try {
    const now = Date.now();
    if (now - lastInterstitialTime < INTERSTITIAL_COOLDOWN) return false;
    if (!interstitialAd || !interstitialLoaded) {
      preloadInterstitial();
      return false;
    }
    await interstitialAd.show();
    return true;
  } catch (e) {
    console.warn('Interstitial show error:', e);
    preloadInterstitial();
    return false;
  }
}

// ─── Rewarded ─────────────────────────────────────────────
export function showRewarded(): Promise<boolean> {
  return new Promise((resolve) => {
    try {
      const ad = RewardedAd.createForAdRequest(getAdId('REWARDED'), {
        requestNonPersonalizedAdsOnly: false,
      });

      let earned = false;
      const cleanup: (() => void)[] = [];

      const unsub1 = ad.addAdEventListener(RewardedAdEventType.EARNED_REWARD, () => {
        earned = true;
      });
      cleanup.push(unsub1);

      const unsub2 = ad.addAdEventListener(AdEventType.LOADED, () => {
        ad.show();
      });
      cleanup.push(unsub2);

      const unsub3 = ad.addAdEventListener(AdEventType.CLOSED, () => {
        cleanup.forEach(fn => fn());
        resolve(earned);
      });
      cleanup.push(unsub3);

      const unsub4 = ad.addAdEventListener(AdEventType.ERROR, () => {
        cleanup.forEach(fn => fn());
        resolve(false);
      });
      cleanup.push(unsub4);

      ad.load();

      // Timeout safety
      setTimeout(() => {
        cleanup.forEach(fn => fn());
        resolve(false);
      }, 20_000);
    } catch (e) {
      console.warn('Rewarded error:', e);
      resolve(false);
    }
  });
}

// ─── App Open Ad ──────────────────────────────────────────
export function showAppOpenAd(): Promise<boolean> {
  return new Promise((resolve) => {
    try {
      const now = Date.now();
      if (now - lastAppOpenTime < APP_OPEN_COOLDOWN) {
        resolve(false);
        return;
      }

      const ad = AppOpenAd.createForAdRequest(getAdId('APP_OPEN'), {
        requestNonPersonalizedAdsOnly: false,
      });

      const cleanup: (() => void)[] = [];

      const unsub1 = ad.addAdEventListener(AdEventType.LOADED, () => {
        ad.show();
      });
      cleanup.push(unsub1);

      const unsub2 = ad.addAdEventListener(AdEventType.CLOSED, () => {
        lastAppOpenTime = Date.now();
        cleanup.forEach(fn => fn());
        resolve(true);
      });
      cleanup.push(unsub2);

      const unsub3 = ad.addAdEventListener(AdEventType.ERROR, () => {
        cleanup.forEach(fn => fn());
        resolve(false);
      });
      cleanup.push(unsub3);

      ad.load();

      // Timeout safety
      setTimeout(() => {
        cleanup.forEach(fn => fn());
        resolve(false);
      }, 15_000);
    } catch (e) {
      console.warn('App open ad error:', e);
      resolve(false);
    }
  });
}
