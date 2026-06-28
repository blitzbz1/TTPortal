// MMKV-backed KV cache (T047). Previously this rode on synchronous
// expo-sqlite, which did sync disk reads + JSON parse on the JS thread in
// the tab-switch path; the venues/cities caches already proved MMKV is the
// better fit. Exported signatures are unchanged — every domain cache built
// on cacheUtils keeps working as-is. As a side effect, the cache now also
// works on web (the SQLite version was a no-op there).
//
// Storage shape: one envelope per key — JSON { v: <value>, t: <written-at ms> }.
// Schema versioning (T034): a KV_CACHE_SCHEMA_VERSION mismatch wipes this store
// — hydrating stale-shaped JSON is worse than a cold refetch. The version is
// KV-only: it gates the `offline-kv-cache` store and NOT the cities/venues MMKV
// delta caches, which own CITIES_/VENUES_CACHE_SCHEMA_VERSION respectively.

import { createMMKV } from 'react-native-mmkv';
import { Platform } from 'react-native';
import { KV_CACHE_SCHEMA_VERSION } from './cacheSchema';

const SCHEMA_VERSION_KEY = '__schema_version__';
const SQLITE_MIGRATED_KEY = '__migrated_from_sqlite__';

const store = createMMKV({ id: 'offline-kv-cache' });

interface Envelope {
  v: unknown;
  t: number;
}

/**
 * One-time migration from the legacy `ttportal_cache` SQLite store so
 * existing devices don't cold-start their domain caches. Rows older than
 * the schema bump are not migrated (the version gate below would discard
 * them anyway). Failures are swallowed — worst case is a cold cache.
 */
function migrateFromSqliteOnce(): void {
  if (Platform.OS === 'web') return;
  if (store.getBoolean(SQLITE_MIGRATED_KEY)) return;
  try {
    const SQLite = require('expo-sqlite');
    const db = SQLite.openDatabaseSync('ttportal_cache');
    const rows: { key: string; value: string; updated_at: number }[] =
      db.getAllSync?.('SELECT key, value, updated_at FROM cache') ?? [];
    for (const row of rows) {
      if (row.key.startsWith('__')) continue;
      try {
        const envelope: Envelope = { v: JSON.parse(row.value), t: row.updated_at };
        store.set(row.key, JSON.stringify(envelope));
      } catch {
        // skip unparseable rows
      }
    }
    // Free the old store; the table itself stays (cheap, and dropping the
    // db file needs APIs that differ across expo-sqlite versions).
    db.runSync?.('DELETE FROM cache');
  } catch {
    // expo-sqlite unavailable or legacy db missing — nothing to migrate.
  } finally {
    try {
      store.set(SQLITE_MIGRATED_KEY, true);
    } catch {}
  }
}

(function ensureSchema() {
  try {
    const stored = store.getString(SCHEMA_VERSION_KEY);
    if (Number(stored) !== KV_CACHE_SCHEMA_VERSION) {
      store.clearAll();
      store.set(SCHEMA_VERSION_KEY, String(KV_CACHE_SCHEMA_VERSION));
      migrateFromSqliteOnce();
    }
  } catch {
    // Storage unavailable — every read below degrades to a miss.
  }
})();

function readEnvelope(key: string): Envelope | null {
  try {
    const raw = store.getString(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Envelope;
    if (parsed == null || typeof parsed.t !== 'number') return null;
    return parsed;
  } catch {
    return null;
  }
}

export function setCacheItem(key: string, value: any): void {
  try {
    const envelope: Envelope = { v: value, t: Date.now() };
    store.set(key, JSON.stringify(envelope));
  } catch {}
}

export function getCacheItem<T>(key: string): T | null {
  const envelope = readEnvelope(key);
  return envelope ? ((envelope.v as T) ?? null) : null;
}

export function removeCacheItem(key: string): void {
  try {
    store.remove(key);
  } catch {}
}

export function removeCacheItemsByPrefix(prefix: string): void {
  try {
    for (const key of store.getAllKeys()) {
      if (key.startsWith(prefix)) store.remove(key);
    }
  } catch {}
}

export function getCacheAge(key: string): number | null {
  const envelope = readEnvelope(key);
  return envelope ? Date.now() - envelope.t : null;
}
