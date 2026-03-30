import React, {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useColorScheme } from 'react-native';
import { openDatabaseSync } from 'expo-sqlite';
import { lightColors, darkColors, updateShadowsForTheme } from '../theme';
import type { ThemeColors } from '../theme';

export type ThemeMode = 'light' | 'dark' | 'system';

export interface ThemeContextValue {
  mode: ThemeMode;
  resolved: 'light' | 'dark';
  colors: ThemeColors;
  setMode: (m: ThemeMode) => void;
  isDark: boolean;
}

/** @internal Exported for useTheme hook consumption. */
export const ThemeContext = createContext<ThemeContextValue | null>(null);

const STORAGE_KEY = 'ttportal-theme';
const DEFAULT_MODE: ThemeMode = 'system';
const VALID_MODES: ReadonlySet<string> = new Set(['light', 'dark', 'system']);

function loadMode(): ThemeMode {
  try {
    const db = openDatabaseSync('supabase-storage.db');
    db.execSync(
      'CREATE TABLE IF NOT EXISTS storage (key TEXT PRIMARY KEY, value TEXT);'
    );
    const row = db.getFirstSync<{ value: string }>(
      'SELECT value FROM storage WHERE key = ?;',
      [STORAGE_KEY]
    );
    if (row?.value && VALID_MODES.has(row.value)) {
      return row.value as ThemeMode;
    }
  } catch {
    // Storage unavailable — fall through to default
  }
  return DEFAULT_MODE;
}

function saveMode(mode: ThemeMode): void {
  try {
    const db = openDatabaseSync('supabase-storage.db');
    db.runSync(
      'INSERT OR REPLACE INTO storage (key, value) VALUES (?, ?);',
      [STORAGE_KEY, mode]
    );
  } catch {
    // Storage write failed — mode is still set in memory
  }
}

interface ThemeProviderProps {
  children: React.ReactNode;
  initialMode?: ThemeMode;
}

export function ThemeProvider({ children, initialMode }: ThemeProviderProps) {
  const systemScheme = useColorScheme();
  const [mode, setModeState] = useState<ThemeMode>(initialMode ?? DEFAULT_MODE);

  useEffect(() => {
    if (initialMode === undefined) {
      setModeState(loadMode());
    }
  }, [initialMode]);

  const setMode = useCallback((newMode: ThemeMode) => {
    setModeState(newMode);
    saveMode(newMode);
  }, []);

  const resolved: 'light' | 'dark' =
    mode === 'system' ? (systemScheme === 'dark' ? 'dark' : 'light') : mode;

  const colors = resolved === 'dark' ? darkColors : lightColors;
  const isDark = resolved === 'dark';
  updateShadowsForTheme(isDark);

  const value = useMemo(
    () => ({ mode, resolved, colors, setMode, isDark }),
    [mode, resolved, colors, setMode, isDark]
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}
