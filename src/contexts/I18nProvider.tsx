import React, {
  createContext,
  useCallback,
  useMemo,
  useState,
} from 'react';
import * as Localization from 'expo-localization';
import { getStringSync, setString } from '../lib/mmkv';
import roStrings from '../locales/ro.json';
import enStrings from '../locales/en.json';
import deStrings from '../locales/de.json';
import itStrings from '../locales/it.json';
import frStrings from '../locales/fr.json';
import esStrings from '../locales/es.json';
import plStrings from '../locales/pl.json';
import csStrings from '../locales/cs.json';

/** Supported language codes. */
export type Lang = 'ro' | 'en' | 'de' | 'it' | 'fr' | 'es' | 'pl' | 'cs';

/** All supported languages, in the order shown in the language picker. */
export const SUPPORTED_LANGS: readonly Lang[] = [
  'ro',
  'en',
  'de',
  'it',
  'fr',
  'es',
  'pl',
  'cs',
];

/** Native (endonym) display name for each language, shown in the picker. */
export const LANGUAGE_NAMES: Record<Lang, string> = {
  ro: 'Română',
  en: 'English',
  de: 'Deutsch',
  it: 'Italiano',
  fr: 'Français',
  es: 'Español',
  pl: 'Polski',
  cs: 'Čeština',
};

/** BCP-47 locale tag per language for date/number formatting. */
const LOCALE_TAGS: Record<Lang, string> = {
  ro: 'ro-RO',
  en: 'en-GB',
  de: 'de-DE',
  it: 'it-IT',
  fr: 'fr-FR',
  es: 'es-ES',
  pl: 'pl-PL',
  cs: 'cs-CZ',
};

/**
 * Resolve the BCP-47 locale tag for a language code, for use with
 * `toLocaleDateString` / `toLocaleString` / `localeCompare`. Accepts any
 * string and falls back to `en-GB` for unknown codes.
 */
export function getDateLocale(lang: string): string {
  return LOCALE_TAGS[lang as Lang] ?? 'en-GB';
}

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
const VALID_LANGS: ReadonlySet<string> = new Set(SUPPORTED_LANGS);

const locales: Record<Lang, Record<string, string>> = {
  ro: roStrings,
  en: enStrings,
  de: deStrings,
  it: itStrings,
  fr: frStrings,
  es: esStrings,
  pl: plStrings,
  cs: csStrings,
};

/**
 * Pick the first supported language from the device's preferred locales.
 * Returns null if none of the user's locales map to a supported `Lang`.
 */
function detectDeviceLang(): Lang | null {
  try {
    const locales = Localization.getLocales();
    for (const entry of locales) {
      const code = entry?.languageCode?.toLowerCase();
      if (code && VALID_LANGS.has(code)) return code as Lang;
    }
  } catch {
    // expo-localization unavailable — caller falls through to DEFAULT_LANG
  }
  return null;
}

/**
 * Synchronous read so the first render uses the right language.
 * Order: explicit MMKV pick → device locale → DEFAULT_LANG.
 * The device locale is not persisted, so OS-level language changes keep
 * taking effect until the user explicitly picks a language.
 */
function loadLangSync(): Lang {
  try {
    const value = getStringSync(STORAGE_KEY);
    if (value && VALID_LANGS.has(value)) return value as Lang;
  } catch {
    // Storage unavailable — fall through
  }
  return detectDeviceLang() ?? DEFAULT_LANG;
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
