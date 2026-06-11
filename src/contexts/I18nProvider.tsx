import React, {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { Platform } from 'react-native';
import * as Localization from 'expo-localization';
import { getStringSync, setString } from '../lib/mmkv';
// Only the English fallback is parsed at startup (T045). The other seven
// locales (~590KB of JSON) load lazily: inline require() on native (Hermes
// defers the parse until first require) and dynamic import() on web (each
// locale becomes its own split chunk).
import enStrings from '../locales/en.json';

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
  /**
   * Plural-aware resolver (T063): picks `key_one`/`key_few`/`key_many`/…
   * via Intl.PluralRules for the active language, falling back to the bare
   * key (the "other" form). `{0}` is the count; further args fill `{1}`+.
   */
  sn: (key: string, count: number, ...args: string[]) => string;
}

/** @internal Exported for useI18n hook consumption. */
export const I18nContext = createContext<I18nContextValue | null>(null);

const STORAGE_KEY = 'ttportal-lang';
// T067: unsupported device locales used to land on a fully Romanian first
// launch. English is the fallback now; Romanian only when the DEVICE REGION
// is Romania (a Hungarian-language phone in RO still gets ro, a Hungarian
// phone in HU gets en).
const DEFAULT_LANG: Lang = 'en';
const VALID_LANGS: ReadonlySet<string> = new Set(SUPPORTED_LANGS);

type Strings = Record<string, string>;

/** Locales parsed so far; en is always present as the fallback. */
const loadedLocales: Partial<Record<Lang, Strings>> = { en: enStrings };

/**
 * Native path: synchronous require keyed by language. The active language
 * is known synchronously from MMKV, so the selected locale is parsed before
 * the first paint — no fallback flash. The switch keeps every locale
 * statically analyzable for Metro.
 */
function loadLocaleSync(lang: Lang): Strings {
  const cached = loadedLocales[lang];
  if (cached) return cached;
  let strings: Strings;
  switch (lang) {
    case 'ro': strings = require('../locales/ro.json'); break;
    case 'de': strings = require('../locales/de.json'); break;
    case 'it': strings = require('../locales/it.json'); break;
    case 'fr': strings = require('../locales/fr.json'); break;
    case 'es': strings = require('../locales/es.json'); break;
    case 'pl': strings = require('../locales/pl.json'); break;
    case 'cs': strings = require('../locales/cs.json'); break;
    default: strings = enStrings;
  }
  loadedLocales[lang] = strings;
  return strings;
}

/** Web path: dynamic import so each locale is a split chunk. */
async function loadLocaleAsync(lang: Lang): Promise<Strings> {
  const cached = loadedLocales[lang];
  if (cached) return cached;
  let mod: { default: Strings } | Strings;
  switch (lang) {
    case 'ro': mod = await import('../locales/ro.json'); break;
    case 'de': mod = await import('../locales/de.json'); break;
    case 'it': mod = await import('../locales/it.json'); break;
    case 'fr': mod = await import('../locales/fr.json'); break;
    case 'es': mod = await import('../locales/es.json'); break;
    case 'pl': mod = await import('../locales/pl.json'); break;
    case 'cs': mod = await import('../locales/cs.json'); break;
    default: mod = enStrings;
  }
  const strings = ((mod as { default?: Strings }).default ?? mod) as Strings;
  loadedLocales[lang] = strings;
  return strings;
}

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
    // No supported language — devices physically in Romania still default
    // to Romanian rather than English (T067).
    if (locales[0]?.regionCode?.toUpperCase() === 'RO') return 'ro';
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
  // Native parses the active locale synchronously (no flash); web starts on
  // the en fallback and swaps in the split chunk when it arrives.
  const [strings, setStrings] = useState<Strings>(() =>
    Platform.OS === 'web' ? loadedLocales[lang] ?? enStrings : loadLocaleSync(lang),
  );

  useEffect(() => {
    const cached = loadedLocales[lang];
    if (cached) {
      setStrings(cached);
      return;
    }
    if (Platform.OS === 'web') {
      let cancelled = false;
      void loadLocaleAsync(lang).then((next) => {
        if (!cancelled) setStrings(next);
      });
      return () => {
        cancelled = true;
      };
    }
    setStrings(loadLocaleSync(lang));
  }, [lang]);

  const setLang = useCallback((newLang: Lang) => {
    setLangState(newLang);
    saveLang(newLang);
  }, []);

  const s = useCallback(
    (key: string, ...args: string[]): string => {
      let result = strings[key] ?? enStrings[key as keyof typeof enStrings] ?? key;
      for (let i = 0; i < args.length; i++) {
        result = result.replace(`{${i}}`, args[i]);
      }
      return result;
    },
    [strings]
  );

  const sn = useCallback(
    (key: string, count: number, ...args: string[]): string => {
      let category = 'other';
      try {
        category = new Intl.PluralRules(getDateLocale(lang)).select(count);
      } catch {
        category = count === 1 ? 'one' : 'other';
      }
      const variant = `${key}_${category}`;
      const lookup =
        strings[variant] ??
        enStrings[variant as keyof typeof enStrings] ??
        strings[key] ??
        enStrings[key as keyof typeof enStrings] ??
        key;
      let result: string = lookup;
      const all = [String(count), ...args];
      for (let i = 0; i < all.length; i++) {
        result = result.replace(`{${i}}`, all[i]);
      }
      return result;
    },
    [strings, lang]
  );

  const value = useMemo(() => ({ lang, setLang, s, sn }), [lang, setLang, s, sn]);

  return (
    <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
  );
}
