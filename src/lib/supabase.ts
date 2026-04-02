import 'react-native-url-polyfill/auto';
import { Platform } from 'react-native';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

/**
 * Storage adapter factory.
 * - Native (iOS/Android): uses expo-sqlite for persistent storage.
 * - Web: uses localStorage (no SharedArrayBuffer requirement).
 */
function createStorage() {
  if (Platform.OS === 'web') {
    // localStorage is unavailable during SSR; use in-memory fallback
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

  // Native: use expo-sqlite
  const { openDatabaseSync } = require('expo-sqlite');
  const db = openDatabaseSync('supabase-storage.db');
  db.execSync(
    'CREATE TABLE IF NOT EXISTS storage (key TEXT PRIMARY KEY, value TEXT);'
  );

  return {
    getItem(key: string): string | null {
      const row = db.getFirstSync(
        'SELECT value FROM storage WHERE key = ?;',
        [key]
      );
      return row?.value ?? null;
    },
    setItem(key: string, value: string): void {
      db.runSync(
        'INSERT OR REPLACE INTO storage (key, value) VALUES (?, ?);',
        [key, value]
      );
    },
    removeItem(key: string): void {
      db.runSync('DELETE FROM storage WHERE key = ?;', [key]);
    },
  };
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
