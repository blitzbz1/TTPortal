import { Platform } from 'react-native';

let db: any = null;

function getDb() {
  if (db) return db;
  if (Platform.OS === 'web') return null;
  try {
    const SQLite = require('expo-sqlite');
    db = SQLite.openDatabaseSync('ttportal_cache');
    db.execSync(`CREATE TABLE IF NOT EXISTS cache (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at INTEGER NOT NULL
    )`);
    return db;
  } catch {
    return null;
  }
}

export function setCacheItem(key: string, value: any): void {
  const d = getDb();
  if (!d) return;
  try {
    d.runSync(
      'INSERT OR REPLACE INTO cache (key, value, updated_at) VALUES (?, ?, ?)',
      [key, JSON.stringify(value), Date.now()],
    );
  } catch {}
}

export function getCacheItem<T>(key: string): T | null {
  const d = getDb();
  if (!d) return null;
  try {
    const row = d.getFirstSync('SELECT value FROM cache WHERE key = ?', [key]);
    return row ? JSON.parse(row.value) : null;
  } catch {
    return null;
  }
}

export function removeCacheItem(key: string): void {
  const d = getDb();
  if (!d) return;
  try {
    d.runSync('DELETE FROM cache WHERE key = ?', [key]);
  } catch {}
}

export function removeCacheItemsByPrefix(prefix: string): void {
  const d = getDb();
  if (!d) return;
  try {
    d.runSync('DELETE FROM cache WHERE key LIKE ?', [`${prefix}%`]);
  } catch {}
}

export function getCacheAge(key: string): number | null {
  const d = getDb();
  if (!d) return null;
  try {
    const row = d.getFirstSync('SELECT updated_at FROM cache WHERE key = ?', [key]);
    return row ? Date.now() - row.updated_at : null;
  } catch {
    return null;
  }
}
