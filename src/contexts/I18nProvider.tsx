import React, {
  createContext,
  useCallback,
  useMemo,
  useState,
} from 'react';
import { getStringSync, setString } from '../lib/mmkv';
import roStrings from '../locales/ro.json';
import enStrings from '../locales/en.json';

/** Supported language codes. */
export type Lang = 'ro' | 'en';

/** Context value exposed by I18nProvider. */
export interface I18nContextValue {
  /** Current language code. */
  lang: Lang;
  /** Change the current language and persist to storage. */
  setLang: (lang: Lang) => void;
  /** Resolve a localized string by key with optional interpolation args. Falls back to English, then to the key itself. */
  s: (key: string, ...args: string[]) => string;
}

/** @internal Exported for useI18n hook consumption. */
export const I18nContext = createContext<I18nContextValue | null>(null);

const STORAGE_KEY = 'ttportal-lang';
const DEFAULT_LANG: Lang = 'ro';
const VALID_LANGS: ReadonlySet<string> = new Set(['ro', 'en']);

const locales: Record<Lang, Record<string, string>> = {
  ro: roStrings,
  en: enStrings,
};

/**
 * Synchronous read so the first render uses the persisted language.
 */
function loadLangSync(): Lang {
  try {
    const value = getStringSync(STORAGE_KEY);
    if (value && VALID_LANGS.has(value)) return value as Lang;
  } catch {
    // Storage unavailable — fall through to default
  }
  return DEFAULT_LANG;
}

function saveLang(lang: Lang): void {
  try {
    setString(STORAGE_KEY, lang);
  } catch {
    // best-effort
  }
}

/** Props for I18nProvider. */
interface I18nProviderProps {
  children: React.ReactNode;
  /** Override initial language (useful for testing). If omitted, loads from storage. */
  initialLang?: Lang;
}

/**
 * Provider that loads language from AsyncStorage, and exposes `lang`,
 * `setLang(lang)`, and `s(key, ...args)` string resolver with English fallback.
 */
export function I18nProvider({ children, initialLang }: I18nProviderProps) {
  // Read MMKV synchronously on mount — no async hydration step before first paint.
  const [lang, setLangState] = useState<Lang>(
    () => initialLang ?? loadLangSync(),
  );

  const setLang = useCallback((newLang: Lang) => {
    setLangState(newLang);
    saveLang(newLang);
  }, []);

  const s = useCallback(
    (key: string, ...args: string[]): string => {
      let result = locales[lang][key] ?? locales.en[key] ?? key;
      for (let i = 0; i < args.length; i++) {
        result = result.replace(`{${i}}`, args[i]);
      }
      return result;
    },
    [lang]
  );

  const value = useMemo(() => ({ lang, setLang, s }), [lang, setLang, s]);

  return (
    <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
  );
}
