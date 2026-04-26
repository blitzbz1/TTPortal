import React, {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
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

async function loadMode(): Promise<ThemeMode> {
  try {
    const value = await AsyncStorage.getItem(STORAGE_KEY);
    if (value && VALID_MODES.has(value)) {
      return value as ThemeMode;
    }
  } catch {
    // Storage unavailable — fall through to default
  }
  return DEFAULT_MODE;
}

function saveMode(mode: ThemeMode): void {
  // Fire-and-forget; the in-memory state is already updated by the caller.
  AsyncStorage.setItem(STORAGE_KEY, mode).catch(() => {
    // Storage write failed — mode is still set in memory
  });
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
      let cancelled = false;
      loadMode().then((next) => {
        if (!cancelled) setModeState(next);
      });
      return () => {
        cancelled = true;
      };
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
