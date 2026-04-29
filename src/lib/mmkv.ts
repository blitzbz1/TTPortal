import { createMMKV } from 'react-native-mmkv';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Single MMKV instance shared by ThemeProvider, I18nProvider, and the
// Supabase auth storage adapter. MMKV is JSI-backed and ~30× faster than
// AsyncStorage on cold reads.
export const storage = createMMKV({ id: 'ttportal' });

// One-time migration from AsyncStorage. If MMKV doesn't have the key but
// AsyncStorage does (carry-over from a pre-MMKV install), copy the value
// across so users don't lose their session, theme, or language. Subsequent
// reads hit MMKV directly.
async function migrateFromAsyncStorage(key: string): Promise<string | null> {
  const legacy = await AsyncStorage.getItem(key);
  if (legacy != null) {
    storage.set(key, legacy);
    // Best-effort delete so we don't migrate twice.
    AsyncStorage.removeItem(key).catch(() => {});
  }
  return legacy;
}

// AsyncStorage-shaped adapter so the Supabase JS client (which expects an
// async storage interface) can use MMKV under the hood. Methods return
// resolved promises wrapping synchronous MMKV calls.
export const mmkvAsyncStorage = {
  async getItem(key: string): Promise<string | null> {
    const value = storage.getString(key);
    if (value != null) return value;
    return migrateFromAsyncStorage(key);
  },
  async setItem(key: string, value: string): Promise<void> {
    storage.set(key, value);
  },
  async removeItem(key: string): Promise<void> {
    storage.remove(key);
  },
};

// Sync helpers for hot paths (Theme + i18n hydration before first paint).
// Falls back to AsyncStorage on the very first run, then writes through
// to MMKV so subsequent reads are sync.
export function getStringSync(key: string): string | null {
  return storage.getString(key) ?? null;
}
export function setString(key: string, value: string): void {
  storage.set(key, value);
}
