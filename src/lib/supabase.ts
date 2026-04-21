import 'react-native-url-polyfill/auto';
import { Platform } from 'react-native';
import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

/**
 * Storage adapter factory.
 * - Native (iOS/Android): AsyncStorage (the canonical Supabase-on-React-Native
 *   choice). We previously used expo-sqlite here, but on Expo SDK 54's new
 *   architecture Android the sqlite handle is permanently broken when opened
 *   during module load — every prepareSync NPE'd, so sessions never persisted
 *   and every auth-gated query returned as unauthenticated.
 * - Web: localStorage with an in-memory fallback for SSR.
 */
function createStorage() {
  if (Platform.OS === 'web') {
    const memoryStore = new Map<string, string>();
    const hasLocalStorage = typeof localStorage !== 'undefined';
    return {
      getItem: (key: string) =>
        hasLocalStorage ? localStorage.getItem(key) : (memoryStore.get(key) ?? null),
      setItem: (key: string, value: string) => {
        if (hasLocalStorage) localStorage.setItem(key, value);
        else memoryStore.set(key, value);
      },
      removeItem: (key: string) => {
        if (hasLocalStorage) localStorage.removeItem(key);
        else memoryStore.delete(key);
      },
    };
  }
  return AsyncStorage;
}

const storage = createStorage();

/**
 * Supabase client configured with platform-appropriate session storage.
 * Reads URL and anon key from EXPO_PUBLIC_ environment variables.
 */
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
