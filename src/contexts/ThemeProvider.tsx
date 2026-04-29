import React, {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useColorScheme } from 'react-native';
import { getStringSync, setString } from '../lib/mmkv';
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

// Synchronous MMKV read so the initial render uses the persisted theme
// directly — no flash of default theme followed by a re-render to the
// real preference.
function loadModeSync(): ThemeMode {
  try {
    const value = getStringSync(STORAGE_KEY);
    if (value && VALID_MODES.has(value)) return value as ThemeMode;
  } catch {
    // Storage unavailable (web SSR / tests) — fall through to default
  }
  return DEFAULT_MODE;
}

function saveMode(mode: ThemeMode): void {
  try {
    setString(STORAGE_KEY, mode);
  } catch {
    // best-effort — in-memory state is already updated by the caller
  }
}

interface ThemeProviderProps {
  children: React.ReactNode;
  initialMode?: ThemeMode;
}

export function ThemeProvider({ children, initialMode }: ThemeProviderProps) {
  const systemScheme = useColorScheme();
  // Read MMKV synchronously on first render — no async hydration step.
  const [mode, setModeState] = useState<ThemeMode>(
    () => initialMode ?? loadModeSync(),
  );

  const setMode = useCallback((newMode: ThemeMode) => {
    setModeState(newMode);
    saveMode(newMode);
  }, []);

  const resolved: 'light' | 'dark' =
    mode === 'system' ? (systemScheme === 'dark' ? 'dark' : 'light') : mode;

  const colors = resolved === 'dark' ? darkColors : lightColors;
  const isDark = resolved === 'dark';
  // Side-effect: defer to commit phase so rebuilding shadow style objects
  // doesn't run on every render — only when the resolved theme actually flips.
  useEffect(() => {
    updateShadowsForTheme(isDark);
  }, [isDark]);

  const value = useMemo(
    () => ({ mode, resolved, colors, setMode, isDark }),
    [mode, resolved, colors, setMode, isDark]
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}
