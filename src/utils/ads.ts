/**
 * AdMob ad management utilities.
 * Handles interstitial, rewarded, and app-open ads.
 */

import {
  InterstitialAd,
  RewardedAd,
  AppOpenAd,
  AdEventType,
  RewardedAdEventType,
} from 'react-native-google-mobile-ads';
import { getAdId } from '../constants/ads';

// Track ad frequency
let lastInterstitialTime = 0;
const INTERSTITIAL_COOLDOWN_MS = 60000; // 1 minute between interstitials

let interstitialAd: InterstitialAd | null = null;
let rewardedAd: RewardedAd | null = null;
let appOpenAd: AppOpenAd | null = null;

/**
 * Preload an interstitial ad.
 */
export function preloadInterstitial(): void {
  interstitialAd = InterstitialAd.createForAdRequest(getAdId('INTERSTITIAL'), {
    requestNonPersonalizedAdsOnly: false,
  });
  interstitialAd.load();
}

/**
 * Show interstitial ad with cooldown.
 * Returns true if ad was shown.
 */
export function showInterstitial(): Promise<boolean> {
  return new Promise((resolve) => {
    const now = Date.now();
    if (now - lastInterstitialTime < INTERSTITIAL_COOLDOWN_MS) {
      resolve(false);
      return;
    }

    if (!interstitialAd) {
      preloadInterstitial();
      resolve(false);
      return;
    }

    const unsubLoaded = interstitialAd.addAdEventListener(AdEventType.LOADED, () => {
      interstitialAd?.show();
    });

    const unsubClosed = interstitialAd.addAdEventListener(AdEventType.CLOSED, () => {
      lastInterstitialTime = Date.now();
      unsubLoaded();
      unsubClosed();
      // Preload next
      preloadInterstitial();
      resolve(true);
    });

    const unsubError = interstitialAd.addAdEventListener(AdEventType.ERROR, () => {
      unsubLoaded();
      unsubClosed();
      unsubError();
      preloadInterstitial();
      resolve(false);
    });

    interstitialAd.load();
  });
}

/**
 * Show rewarded ad.
 * Returns true if reward was earned.
 */
export function showRewarded(): Promise<boolean> {
  return new Promise((resolve) => {
    rewardedAd = RewardedAd.createForAdRequest(getAdId('REWARDED'), {
      requestNonPersonalizedAdsOnly: false,
    });

    const unsubEarned = rewardedAd.addAdEventListener(
      RewardedAdEventType.EARNED_REWARD,
      () => {
        resolve(true);
      }
    );

    const unsubLoaded = rewardedAd.addAdEventListener(AdEventType.LOADED, () => {
      rewardedAd?.show();
    });

    const unsubClosed = rewardedAd.addAdEventListener(AdEventType.CLOSED, () => {
      unsubEarned();
      unsubLoaded();
      unsubClosed();
    });

    rewardedAd.load();

    // Timeout
    setTimeout(() => {
      resolve(false);
    }, 15000);
  });
}

/**
 * Show app-open ad.
 */
export function showAppOpenAd(): void {
  appOpenAd = AppOpenAd.createForAdRequest(getAdId('APP_OPEN'), {
    requestNonPersonalizedAdsOnly: false,
  });

  appOpenAd.addAdEventListener(AdEventType.LOADED, () => {
    appOpenAd?.show();
  });

  appOpenAd.load();
}
