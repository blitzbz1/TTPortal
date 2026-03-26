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
import { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import 'react-native-reanimated';
import { SessionProvider } from '../contexts/SessionProvider';
import { I18nProvider } from '../contexts/I18nProvider';
import { useSession } from '../hooks/useSession';
import { Colors } from '../theme';

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
    <SessionProvider>
      <I18nProvider>
        <RootNavigator />
      </I18nProvider>
    </SessionProvider>
  );
}

/**
 * Inner navigator that handles font loading, auth loading state,
 * and renders the Stack navigator once ready.
 */
function RootNavigator() {
  const { isLoading } = useSession();
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

  if (!fontsLoaded || isLoading) {
    return (
      <View style={styles.splash} testID="splash-loading">
        <ActivityIndicator size="large" color={Colors.green} />
      </View>
    );
  }

  return (
    <>
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="sign-in" options={{ headerShown: false }} />
        <Stack.Screen name="forgot-password" options={{ headerShown: false }} />
        <Stack.Screen name="reset-password" options={{ headerShown: false }} />
        <Stack.Screen name="venue/[id]" options={{ headerShown: false }} />
        <Stack.Screen name="(protected)" options={{ headerShown: false }} />
      </Stack>
      <StatusBar style="auto" />
    </>
  );
}

const styles = StyleSheet.create({
  splash: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.bg,
  },
});
