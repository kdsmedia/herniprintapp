import React, { useEffect } from 'react';
import { StatusBar, LogBox, View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as SplashScreen from 'expo-splash-screen';
import mobileAds from 'react-native-google-mobile-ads';
import { AppProvider } from './src/contexts/AppContext';
import MainScreen from './src/screens/MainScreen';
import { COLORS } from './src/constants/theme';

LogBox.ignoreLogs(['new NativeEventEmitter']);
SplashScreen.preventAutoHideAsync();

// ─── Error Boundary ───────────────────────────────────────
class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: string }
> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, error: '' };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error: error.message };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('App Error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <View style={eb.container}>
          <Text style={eb.emoji}>😵</Text>
          <Text style={eb.title}>Oops! Terjadi Kesalahan</Text>
          <Text style={eb.message}>{this.state.error}</Text>
          <TouchableOpacity
            style={eb.button}
            onPress={() => this.setState({ hasError: false, error: '' })}
          >
            <Text style={eb.buttonText}>COBA LAGI</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return this.props.children;
  }
}

const eb = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bgDark, alignItems: 'center', justifyContent: 'center', padding: 32 },
  emoji: { fontSize: 48, marginBottom: 16 },
  title: { fontSize: 18, fontWeight: '700', color: '#fff', marginBottom: 8 },
  message: { fontSize: 12, color: COLORS.textSecondary, textAlign: 'center', marginBottom: 24 },
  button: { backgroundColor: COLORS.primary, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12 },
  buttonText: { fontSize: 12, fontWeight: '800', color: '#fff' },
});

// ─── App ──────────────────────────────────────────────────
export default function App() {
  useEffect(() => {
    SplashScreen.hideAsync();
    mobileAds().initialize().catch((error) => {
      console.error("AdMob initialization failed:", error);
    });
  }, []);

  return (
    <ErrorBoundary>
      <SafeAreaProvider>
        <AppProvider>
          <StatusBar barStyle="light-content" backgroundColor={COLORS.bgDark} />
          <MainScreen />
        </AppProvider>
      </SafeAreaProvider>
    </ErrorBoundary>
  );
}
