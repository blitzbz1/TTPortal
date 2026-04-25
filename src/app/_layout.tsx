import 'react-native-reanimated';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useFonts } from 'expo-font';
import {
  Syne_400Regular,
  Syne_700Bold,
} from '@expo-google-fonts/syne';
import {
  DMSans_400Regular,
  DMSans_500Medium,
} from '@expo-google-fonts/dm-sans';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo } from 'react';
import { ActivityIndicator, LogBox, Platform, StyleSheet, View } from 'react-native';
import { SessionProvider } from '../contexts/SessionProvider';
import { NotificationProvider } from '../contexts/NotificationProvider';
import { I18nProvider } from '../contexts/I18nProvider';
import { ThemeProvider } from '../contexts/ThemeProvider';
import { useSession } from '../hooks/useSession';
import { useTheme } from '../hooks/useTheme';
import type { ThemeColors } from '../theme';

// Suppress LogBox in development to prevent overlay from blocking tab bar during E2E tests
if (__DEV__) {
  LogBox.ignoreAllLogs(true);
}

export { ErrorBoundary } from 'expo-router';

export const unstable_settings = {
  initialRouteName: '(tabs)',
};

SplashScreen.preventAutoHideAsync();

/**
 * Root layout — wraps the app in SessionProvider → I18nProvider,
 * loads Syne + DM Sans fonts, and renders the navigation stack.
 * While session or fonts are loading, a splash view is shown to prevent auth flicker.
 */
export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SessionProvider>
        <I18nProvider>
          <ThemeProvider>
            <NotificationProvider>
              <RootNavigator />
            </NotificationProvider>
          </ThemeProvider>
        </I18nProvider>
      </SessionProvider>
    </GestureHandlerRootView>
  );
}

/**
 * Inner navigator that handles font loading, auth loading state,
 * and renders the Stack navigator once ready.
 */
function RootNavigator() {
  const { isLoading } = useSession();
  const { isDark, colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [fontsLoaded, fontError] = useFonts({
    Syne_400Regular,
    Syne_700Bold,
    DMSans_400Regular,
    DMSans_500Medium,
  });

  useEffect(() => {
    if (fontError) throw fontError;
  }, [fontError]);

  useEffect(() => {
    if (fontsLoaded && !isLoading) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, isLoading]);

  // On web, RN's <Modal> portals to a fixed-position [role="dialog"] outside
  // the phone-frame (webFrame), so sheets stretch across the full viewport.
  // Cap the sheet to the same width and center it, while keeping the dim
  // overlay full-screen.
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const id = 'rnw-modal-phone-frame';
    if (typeof document === 'undefined' || document.getElementById(id)) return;
    const style = document.createElement('style');
    style.id = id;
    style.textContent = `
      [role="dialog"][aria-modal="true"] > div { align-items: center !important; }
      [role="dialog"][aria-modal="true"] > div > * {
        width: 100% !important;
        max-width: 430px !important;
      }
    `;
    document.head.appendChild(style);
  }, []);

  if (!fontsLoaded || isLoading) {
    return (
      <View style={styles.splash} testID="splash-loading">
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  const nav = (
    <>
      <Stack screenOptions={{ animation: 'fade' }}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="sign-in" options={{ headerShown: false, animation: 'fade' }} />
        <Stack.Screen name="auth/callback" options={{ headerShown: false, animation: 'fade' }} />
        <Stack.Screen name="onboarding" options={{ headerShown: false, animation: 'fade' }} />
        <Stack.Screen name="forgot-password" options={{ headerShown: false, animation: 'slide_from_bottom' }} />
        <Stack.Screen name="reset-password" options={{ headerShown: false, animation: 'slide_from_bottom' }} />
        <Stack.Screen name="venue/[id]" options={{ headerShown: false, animation: 'slide_from_right' }} />
        <Stack.Screen name="(protected)" options={{ headerShown: false, animation: 'slide_from_right' }} />
      </Stack>
      <StatusBar style={isDark ? 'light' : 'dark'} />
    </>
  );

  if (Platform.OS !== 'web') return nav;

  return (
    <View style={styles.webOuter}>
      <View style={styles.webFrame}>
        {nav}
      </View>
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    splash: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: colors.bg,
    },
    webOuter: {
      flex: 1,
      alignItems: 'center',
      backgroundColor: colors.webOuterBg,
    },
    webFrame: {
      width: '100%',
      maxWidth: 430,
      flex: 1,
      backgroundColor: colors.bg,
      // @ts-ignore web-only shadow
      boxShadow: '0 0 40px rgba(0,0,0,0.12)',
      overflow: 'hidden',
    },
  });
}
