import React, {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { I18nManager, Platform } from 'react-native';
import * as Localization from 'expo-localization';
import { getStringSync, setString } from '../lib/mmkv';
// Only the English fallback is parsed at startup (T045). The other seven
// locales (~590KB of JSON) load lazily: inline require() on native (Hermes
// defers the parse until first require) and dynamic import() on web (each
// locale becomes its own split chunk).
import enStrings from '../locales/en.json';

/**
 * Supported language codes. The first eight are the original markets; the rest
 * cover every country we have venues in (added per the OSM import — one locale
 * per country's primary language, incl. RTL ar/fa).
 */
export type Lang =
  | 'ro' | 'en' | 'de' | 'it' | 'fr' | 'es' | 'pl' | 'cs'
  | 'nl' | 'ru' | 'hu' | 'nb' | 'sk' | 'et' | 'hr' | 'uk' | 'da' | 'bg'
  | 'sv' | 'fi' | 'pt' | 'lv' | 'sl' | 'lt' | 'el' | 'sr' | 'tr' | 'ka'
  | 'sq' | 'hy' | 'is' | 'ar' | 'fa';

/** All supported languages, in the order shown in the language picker
 * (original markets first, then the new locales by venue footprint). */
export const SUPPORTED_LANGS: readonly Lang[] = [
  'ro', 'en', 'de', 'it', 'fr', 'es', 'pl', 'cs',
  'nl', 'ru', 'hu', 'nb', 'sk', 'et', 'hr', 'uk', 'da', 'bg',
  'sv', 'fi', 'pt', 'lv', 'sl', 'lt', 'el', 'sr', 'tr', 'ka',
  'sq', 'hy', 'is', 'ar', 'fa',
];

/** Right-to-left languages. Full layout mirroring needs an app reload to apply
 * on native (see applyDirection); the JSON/strings are direction-agnostic.
 * Components read the active language's direction via `isRTL` on the context. */
const RTL_LANGS: ReadonlySet<Lang> = new Set<Lang>(['ar', 'fa']);

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
  nl: 'Nederlands',
  ru: 'Русский',
  hu: 'Magyar',
  nb: 'Norsk',
  sk: 'Slovenčina',
  et: 'Eesti',
  hr: 'Hrvatski',
  uk: 'Українська',
  da: 'Dansk',
  bg: 'Български',
  sv: 'Svenska',
  fi: 'Suomi',
  pt: 'Português',
  lv: 'Latviešu',
  sl: 'Slovenščina',
  lt: 'Lietuvių',
  el: 'Ελληνικά',
  sr: 'Srpski',
  tr: 'Türkçe',
  ka: 'ქართული',
  sq: 'Shqip',
  hy: 'Հայերեն',
  is: 'Íslenska',
  ar: 'العربية',
  fa: 'فارسی',
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
  nl: 'nl-NL',
  ru: 'ru-RU',
  hu: 'hu-HU',
  nb: 'nb-NO',
  sk: 'sk-SK',
  et: 'et-EE',
  hr: 'hr-HR',
  uk: 'uk-UA',
  da: 'da-DK',
  bg: 'bg-BG',
  sv: 'sv-SE',
  fi: 'fi-FI',
  pt: 'pt-PT',
  lv: 'lv-LV',
  sl: 'sl-SI',
  lt: 'lt-LT',
  el: 'el-GR',
  sr: 'sr-RS',
  tr: 'tr-TR',
  ka: 'ka-GE',
  sq: 'sq-AL',
  hy: 'hy-AM',
  is: 'is-IS',
  ar: 'ar',
  fa: 'fa-IR',
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
  /** Whether the active language renders right-to-left (ar/fa). */
  isRTL: boolean;
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
    case 'nl': strings = require('../locales/nl.json'); break;
    case 'ru': strings = require('../locales/ru.json'); break;
    case 'hu': strings = require('../locales/hu.json'); break;
    case 'nb': strings = require('../locales/nb.json'); break;
    case 'sk': strings = require('../locales/sk.json'); break;
    case 'et': strings = require('../locales/et.json'); break;
    case 'hr': strings = require('../locales/hr.json'); break;
    case 'uk': strings = require('../locales/uk.json'); break;
    case 'da': strings = require('../locales/da.json'); break;
    case 'bg': strings = require('../locales/bg.json'); break;
    case 'sv': strings = require('../locales/sv.json'); break;
    case 'fi': strings = require('../locales/fi.json'); break;
    case 'pt': strings = require('../locales/pt.json'); break;
    case 'lv': strings = require('../locales/lv.json'); break;
    case 'sl': strings = require('../locales/sl.json'); break;
    case 'lt': strings = require('../locales/lt.json'); break;
    case 'el': strings = require('../locales/el.json'); break;
    case 'sr': strings = require('../locales/sr.json'); break;
    case 'tr': strings = require('../locales/tr.json'); break;
    case 'ka': strings = require('../locales/ka.json'); break;
    case 'sq': strings = require('../locales/sq.json'); break;
    case 'hy': strings = require('../locales/hy.json'); break;
    case 'is': strings = require('../locales/is.json'); break;
    case 'ar': strings = require('../locales/ar.json'); break;
    case 'fa': strings = require('../locales/fa.json'); break;
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
    case 'nl': mod = await import('../locales/nl.json'); break;
    case 'ru': mod = await import('../locales/ru.json'); break;
    case 'hu': mod = await import('../locales/hu.json'); break;
    case 'nb': mod = await import('../locales/nb.json'); break;
    case 'sk': mod = await import('../locales/sk.json'); break;
    case 'et': mod = await import('../locales/et.json'); break;
    case 'hr': mod = await import('../locales/hr.json'); break;
    case 'uk': mod = await import('../locales/uk.json'); break;
    case 'da': mod = await import('../locales/da.json'); break;
    case 'bg': mod = await import('../locales/bg.json'); break;
    case 'sv': mod = await import('../locales/sv.json'); break;
    case 'fi': mod = await import('../locales/fi.json'); break;
    case 'pt': mod = await import('../locales/pt.json'); break;
    case 'lv': mod = await import('../locales/lv.json'); break;
    case 'sl': mod = await import('../locales/sl.json'); break;
    case 'lt': mod = await import('../locales/lt.json'); break;
    case 'el': mod = await import('../locales/el.json'); break;
    case 'sr': mod = await import('../locales/sr.json'); break;
    case 'tr': mod = await import('../locales/tr.json'); break;
    case 'ka': mod = await import('../locales/ka.json'); break;
    case 'sq': mod = await import('../locales/sq.json'); break;
    case 'hy': mod = await import('../locales/hy.json'); break;
    case 'is': mod = await import('../locales/is.json'); break;
    case 'ar': mod = await import('../locales/ar.json'); break;
    case 'fa': mod = await import('../locales/fa.json'); break;
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
      const raw = entry?.languageCode?.toLowerCase();
      // Norwegian variants (no/nn) map to our Bokmål locale.
      const code = raw === 'no' || raw === 'nn' ? 'nb' : raw;
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

/**
 * Sync native layout direction with the active language. forceRTL flips the
 * layout, but React Native only re-lays-out after an app reload — so we set it
 * (making the next launch correct) without forcing a disruptive mid-session
 * reload. Full RTL mirroring of every screen is a follow-up.
 */
function applyDirection(lang: Lang): void {
  try {
    I18nManager.allowRTL(true);
    const rtl = RTL_LANGS.has(lang);
    if (I18nManager.isRTL !== rtl) I18nManager.forceRTL(rtl);
  } catch {
    // I18nManager unavailable (e.g. in tests) — ignore.
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

  // Keep native layout direction in sync with the active language (RTL for ar/fa).
  useEffect(() => {
    applyDirection(lang);
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

  const value = useMemo(
    () => ({ lang, setLang, s, sn, isRTL: RTL_LANGS.has(lang) }),
    [lang, setLang, s, sn],
  );

  return (
    <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
  );
}
