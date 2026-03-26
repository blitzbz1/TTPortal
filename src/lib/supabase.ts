import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import { openDatabaseSync } from 'expo-sqlite';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

/**
 * SQLite-backed storage adapter for Supabase auth session persistence.
 * Uses expo-sqlite to store key-value pairs in a local database,
 * enabling session persistence across app restarts.
 */
class ExpoSQLiteStorage {
  private db: ReturnType<typeof openDatabaseSync>;

  constructor() {
    this.db = openDatabaseSync('supabase-storage.db');
    this.db.execSync(
      'CREATE TABLE IF NOT EXISTS storage (key TEXT PRIMARY KEY, value TEXT);'
    );
  }

  /** Retrieve a value by key from SQLite storage. */
  getItem(key: string): string | null {
    const row = this.db.getFirstSync<{ value: string }>(
      'SELECT value FROM storage WHERE key = ?;',
      [key]
    );
    return row?.value ?? null;
  }

  /** Store a key-value pair in SQLite storage. */
  setItem(key: string, value: string): void {
    this.db.runSync(
      'INSERT OR REPLACE INTO storage (key, value) VALUES (?, ?);',
      [key, value]
    );
  }

  /** Remove a key-value pair from SQLite storage. */
  removeItem(key: string): void {
    this.db.runSync('DELETE FROM storage WHERE key = ?;', [key]);
  }
}

const storage = new ExpoSQLiteStorage();

/**
 * Supabase client configured with expo-sqlite session storage.
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
