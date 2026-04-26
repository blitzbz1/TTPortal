import 'react-native-url-polyfill/auto';
import { Platform } from 'react-native';
import { createClient } from '@supabase/supabase-js';
import { mmkvAsyncStorage } from './mmkv';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

/**
 * Storage adapter factory.
 * - Native (iOS/Android): MMKV via `mmkvAsyncStorage` — JSI-backed sync
 *   storage wrapped in the AsyncStorage-shaped interface Supabase expects.
 *   Migrates legacy AsyncStorage values on first read so existing sessions
 *   survive the upgrade.
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
  return mmkvAsyncStorage;
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
