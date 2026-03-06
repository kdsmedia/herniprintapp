import React, { useEffect, useState, useCallback } from 'react';
import { StatusBar, LogBox } from 'react-native';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as SplashScreen from 'expo-splash-screen';
import mobileAds from 'react-native-google-mobile-ads';

import { AppProvider } from './src/contexts/AppContext';
import { COLORS } from './src/constants/theme';

import ImageScreen from './src/screens/ImageScreen';
import PdfScreen from './src/screens/PdfScreen';
import ResiLabelScreen from './src/screens/ResiLabelScreen';
import QRBarcodeScreen from './src/screens/QRBarcodeScreen';
import SettingsScreen from './src/screens/SettingsScreen';

LogBox.ignoreLogs(['new NativeEventEmitter']);

SplashScreen.preventAutoHideAsync();

const Tab = createBottomTabNavigator();

const DarkTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: COLORS.primary,
    background: COLORS.bgDark,
    card: COLORS.bgDarker,
    text: COLORS.text,
    border: COLORS.bgCardBorder,
  },
};

export default function App() {
  const onReady = useCallback(async () => {
    await SplashScreen.hideAsync();
  }, []);

  useEffect(() => {
    mobileAds()
      .initialize()
      .then(() => console.log('AdMob initialized'))
      .catch((e: any) => console.warn('AdMob init error:', e));
  }, []);

  return (
    <SafeAreaProvider>
      <AppProvider>
        <NavigationContainer theme={DarkTheme} onReady={onReady}>
          <StatusBar barStyle="light-content" backgroundColor={COLORS.bgDark} />
          <Tab.Navigator
            screenOptions={({ route }) => ({
              headerShown: false,
              tabBarActiveTintColor: COLORS.primaryLight,
              tabBarInactiveTintColor: COLORS.textMuted,
              tabBarStyle: {
                backgroundColor: 'rgba(15, 23, 42, 0.98)',
                borderTopColor: 'rgba(255,255,255,0.15)',
                borderTopWidth: 1,
                height: 60,
                paddingBottom: 6,
                paddingTop: 6,
              },
              tabBarLabelStyle: {
                fontSize: 9,
                fontWeight: '700',
                textTransform: 'uppercase',
                letterSpacing: 1,
              },
              tabBarIcon: ({ color, size }) => {
                let iconName: keyof typeof Ionicons.glyphMap = 'image';
                if (route.name === 'Gambar') iconName = 'image';
                else if (route.name === 'PDF') iconName = 'document-text';
                else if (route.name === 'Resi/Label') iconName = 'receipt';
                else if (route.name === 'QR/Bar') iconName = 'qr-code';
                else if (route.name === 'Setelan') iconName = 'settings';
                return <Ionicons name={iconName} size={size - 4} color={color} />;
              },
            })}
          >
            <Tab.Screen name="Gambar" component={ImageScreen} />
            <Tab.Screen name="PDF" component={PdfScreen} />
            <Tab.Screen name="Resi/Label" component={ResiLabelScreen} />
            <Tab.Screen name="QR/Bar" component={QRBarcodeScreen} />
            <Tab.Screen name="Setelan" component={SettingsScreen} />
          </Tab.Navigator>
        </NavigationContainer>
      </AppProvider>
    </SafeAreaProvider>
  );
}
