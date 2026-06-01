import 'react-native-reanimated';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '../lib/queryClient';
import { useFonts } from 'expo-font';
import {
  Syne_400Regular,
  Syne_700Bold,
} from '@expo-google-fonts/syne';
import {
  DMSans_400Regular,
  DMSans_500Medium,
} from '@expo-google-fonts/dm-sans';
import { Stack, useGlobalSearchParams, usePathname } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { LogBox, Platform, StyleSheet, View } from 'react-native';
import { SafeAreaProvider, initialWindowMetrics } from 'react-native-safe-area-context';
import AnimatedSplash from '../components/AnimatedSplash';
import { InitialLocationSetupModal } from '../components/InitialLocationSetupModal';
import { SessionProvider } from '../contexts/SessionProvider';
import { NotificationProvider } from '../contexts/NotificationProvider';
import { I18nProvider } from '../contexts/I18nProvider';
import { LocationProvider } from '../contexts/LocationProvider';
import { ThemeProvider } from '../contexts/ThemeProvider';
import { OfflineQueueProvider } from '../contexts/OfflineQueueProvider';
import { useSession } from '../hooks/useSession';
import { useSelectedLocation } from '../hooks/useSelectedLocation';
import { useTheme } from '../hooks/useTheme';
import type { ThemeColors } from '../theme';

function readInitialLocationParamFromUrl(name: string): boolean {
  if (typeof window === 'undefined') return false;
  const location = window.location;
  if (!location) return false;
  const href = location.href ?? '';
  const search = location.search ?? '';
  const hash = location.hash ?? '';
  return (
    new URLSearchParams(search).has(name) ||
    new URLSearchParams(hash.includes('?') ? hash.slice(hash.indexOf('?')) : '').has(name) ||
    href.includes(`?${name}`) ||
    href.includes(`&${name}`) ||
    href.includes(`#${name}`)
  );
}

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
      <SafeAreaProvider initialMetrics={initialWindowMetrics}>
        <KeyboardProvider>
          <QueryClientProvider client={queryClient}>
            <OfflineQueueProvider>
              <SessionProvider>
                <I18nProvider>
                  <LocationProvider>
                    <ThemeProvider>
                      <NotificationProvider>
                        <BottomSheetModalProvider>
                          <RootNavigator />
                        </BottomSheetModalProvider>
                      </NotificationProvider>
                    </ThemeProvider>
                  </LocationProvider>
                </I18nProvider>
              </SessionProvider>
            </OfflineQueueProvider>
          </QueryClientProvider>
        </KeyboardProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

/**
 * Inner navigator that handles font loading, auth loading state,
 * and renders the Stack navigator once ready.
 */
function RootNavigator() {
  const { isLoading } = useSession();
  const {
    hasCompletedInitialLocationSetup,
    resetInitialLocationSetup,
  } = useSelectedLocation();
  const searchParams = useGlobalSearchParams();
  const pathname = usePathname();
  const { isDark, colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [urlForcesInitialLocation, setUrlForcesInitialLocation] = useState(
    () => readInitialLocationParamFromUrl('previewInitialLocation') || readInitialLocationParamFromUrl('resetInitialLocation'),
  );
  const hasInitialLocationParam = useCallback((name: string) => {
    if (Object.prototype.hasOwnProperty.call(searchParams, name)) return true;
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      return readInitialLocationParamFromUrl(name);
    }
    return false;
  }, [searchParams]);
  const forceInitialLocationPreview =
    urlForcesInitialLocation || hasInitialLocationParam('previewInitialLocation') || hasInitialLocationParam('resetInitialLocation');
  const [fontsLoaded, fontError] = useFonts({
    Syne_400Regular,
    Syne_700Bold,
    DMSans_400Regular,
    DMSans_500Medium,
  });

  const [splashDone, setSplashDone] = useState(false);
  const handleSplashComplete = useCallback(() => setSplashDone(true), []);
  const appReady = fontsLoaded && !isLoading;

  useEffect(() => {
    if (fontError) throw fontError;
  }, [fontError]);

  useEffect(() => {
    if (appReady) {
      SplashScreen.hideAsync();
    }
  }, [appReady]);

  useEffect(() => {
    if (
      Platform.OS === 'web' &&
      typeof window !== 'undefined' &&
      hasInitialLocationParam('resetInitialLocation')
    ) {
      resetInitialLocationSetup();
      setUrlForcesInitialLocation(true);
    }
  }, [hasInitialLocationParam, resetInitialLocationSetup]);

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

  const initialLocationGateReady = forceInitialLocationPreview || splashDone;
  const isAuthRoute =
    pathname === '/sign-in' ||
    pathname === '/forgot-password' ||
    pathname === '/reset-password' ||
    pathname === '/auth/callback';
  const showInitialLocation =
    !isAuthRoute &&
    initialLocationGateReady &&
    (!hasCompletedInitialLocationSetup || forceInitialLocationPreview);

  const nav = appReady ? (
    showInitialLocation ? (
      <>
        <InitialLocationSetupModal visible />
        <StatusBar style={isDark ? 'light' : 'dark'} />
      </>
    ) : (
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
    )
  ) : null;

  const overlay = !splashDone ? (
    <AnimatedSplash isReady={appReady} onComplete={handleSplashComplete} />
  ) : null;

  if (Platform.OS !== 'web') {
    return (
      <>
        {nav}
        {overlay}
      </>
    );
  }

  return (
    <View style={styles.webOuter}>
      <View style={styles.webFrame}>
        {nav}
        {overlay}
      </View>
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
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
