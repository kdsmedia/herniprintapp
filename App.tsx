import React, { useEffect } from 'react';
import { StatusBar, LogBox } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as SplashScreen from 'expo-splash-screen';
import mobileAds from 'react-native-google-mobile-ads';
import { AppProvider } from './src/contexts/AppContext';
import MainScreen from './src/screens/MainScreen';
import { COLORS } from './src/constants/theme';

LogBox.ignoreLogs(['new NativeEventEmitter']);
SplashScreen.preventAutoHideAsync();

export default function App() {
  useEffect(() => {
    SplashScreen.hideAsync();
    mobileAds().initialize().catch((error) => {
      console.error("AdMob initialization failed:", error);
    });
  }, []);

  return (
    <SafeAreaProvider>
      <AppProvider>
        <StatusBar barStyle="light-content" backgroundColor={COLORS.bgDark} />
        <MainScreen />
      </AppProvider>
    </SafeAreaProvider>
  );
}
