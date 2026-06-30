import * as fs from 'fs';
import * as path from 'path';
import ro from '../locales/ro.json';
import en from '../locales/en.json';
import de from '../locales/de.json';
import itLocale from '../locales/it.json'; // aliased: bare `it` would shadow Jest's global it()
import fr from '../locales/fr.json';
import es from '../locales/es.json';
import pl from '../locales/pl.json';
import cs from '../locales/cs.json';
import nl from '../locales/nl.json';
import ru from '../locales/ru.json';
import hu from '../locales/hu.json';
import nb from '../locales/nb.json';
import sk from '../locales/sk.json';
import et from '../locales/et.json';
import hr from '../locales/hr.json';
import uk from '../locales/uk.json';
import da from '../locales/da.json';
import bg from '../locales/bg.json';
import sv from '../locales/sv.json';
import fi from '../locales/fi.json';
import pt from '../locales/pt.json';
import lv from '../locales/lv.json';
import sl from '../locales/sl.json';
import lt from '../locales/lt.json';
import el from '../locales/el.json';
import sr from '../locales/sr.json';
import tr from '../locales/tr.json';
import ka from '../locales/ka.json';
import sq from '../locales/sq.json';
import hy from '../locales/hy.json';
import isLocale from '../locales/is.json'; // aliased: bare `is` reads as the type-predicate keyword
import ar from '../locales/ar.json';
import fa from '../locales/fa.json';

const ROOT = path.resolve(__dirname, '../..');

/** Every shipped locale keyed by code; `en` is the reference for parity. */
const LOCALES: Record<string, Record<string, string>> = {
  ro, en, de, it: itLocale, fr, es, pl, cs,
  nl, ru, hu, nb, sk, et, hr, uk, da, bg,
  sv, fi, pt, lv, sl, lt, el, sr, tr, ka,
  sq, hy, is: isLocale, ar, fa,
};
/** Locales audited against the English reference. */
const NON_EN_LOCALES: [string, Record<string, string>][] = Object.entries(LOCALES).filter(
  ([code]) => code !== 'en',
);

const ACTIVE_CHALLENGE_TITLE_KEY_PATTERN = /^badgeChallenge_(CRF|SPN|ATK|FTW|DEF|SRV|CMP|EXP)\d{3}$/;
const PACK_2_3_CHALLENGE_TITLE_KEY_PATTERN = /^badgeChallenge_(CRF|SPN|ATK|FTW|DEF|SRV|CMP|EXP)[23]\d{2}$/;
const ACTIVE_CHALLENGE_TITLE_KEY_COUNT = 344;
const PACK_2_3_CHALLENGE_TITLE_KEY_COUNT = 160;
const PACK_2_3_TITLE_WORDING_MIGRATION = 'supabase/migrations/079_pack_2_3_challenge_title_wording.sql';

/** Auth screen files to audit for hardcoded strings (implementations moved
 * to src/screens in T057 — the app/ files are 5-line wrappers now). */
const AUTH_SCREEN_FILES = [
  'src/screens/SignInScreen.tsx',
  'src/screens/ForgotPasswordScreen.tsx',
  'src/screens/ResetPasswordScreen.tsx',
];

/** Brand names and symbols acceptable as hardcoded JSX text. */
const ALLOWED_HARDCODED_STRINGS = new Set([
  'TT PORTAL',
  'G',
  'Google',
  'Apple',
  'RO',
  'EN',
]);

/** Romanian diacritics that indicate a hardcoded Romanian string. */
const ROMANIAN_DIACRITICS = /[ăâîșțĂÂÎȘȚ]/;

/** HTML entities for Romanian diacritical characters. */
const ROMANIAN_HTML_ENTITIES = /&#(226|259|238|537|539);/;

describe('i18n completeness', () => {
  it('ships exactly the 33 configured languages with matching loader cases', () => {
    const provider = fs.readFileSync(path.join(ROOT, 'src/contexts/I18nProvider.tsx'), 'utf-8');
    const supportedBlock = provider.match(/export const SUPPORTED_LANGS:[^=]+=\s*\[([\s\S]*?)\];/);
    expect(supportedBlock).not.toBeNull();

    const supported = [...supportedBlock![1].matchAll(/'([^']+)'/g)]
      .map((match) => match[1])
      .sort();
    const nonEnglishSupported = supported.filter((code) => code !== 'en');
    const localeFiles = fs.readdirSync(path.join(ROOT, 'src/locales'))
      .filter((fileName) => fileName.endsWith('.json'))
      .map((fileName) => path.basename(fileName, '.json'))
      .sort();
    const syncCases = [...provider.matchAll(/case '([^']+)': strings = require\('\.\.\/locales\/[^']+\.json'\)/g)]
      .map((match) => match[1])
      .sort();
    const asyncCases = [...provider.matchAll(/case '([^']+)': mod = await import\('\.\.\/locales\/[^']+\.json'\)/g)]
      .map((match) => match[1])
      .sort();

    expect(supported).toHaveLength(33);
    expect(localeFiles).toEqual(supported);
    expect(Object.keys(LOCALES).sort()).toEqual(supported);
    expect(syncCases).toEqual(nonEnglishSupported);
    expect(asyncCases).toEqual(nonEnglishSupported);
  });

  describe('locale key parity', () => {
    const enRef = LOCALES.en;
    const enKeys = Object.keys(enRef).sort();
    const authKeys = enKeys.filter(
      (k) =>
        k.startsWith('auth') ||
        k.startsWith('error') ||
        k.startsWith('validation') ||
        k.startsWith('reset') ||
        k.startsWith('forgot'),
    );
    /** Sorted, comma-joined set of {n} placeholders in a value. */
    const placeholders = (value: string): string =>
      (value.match(/\{\d+\}/g) ?? []).sort().join(',');

    it('en.json has no empty values', () => {
      const empty = Object.entries(enRef).filter(([, v]) => !v.trim()).map(([k]) => k);
      expect(empty).toEqual([]);
    });

    it('en.json has enough auth/error/validation/reset keys to audit', () => {
      expect(authKeys.length).toBeGreaterThanOrEqual(15);
    });

    it.each(NON_EN_LOCALES)('%s.json has the same BASE key set as en.json', (_code, locale) => {
      // Plural variants (_one/_few/_many/_other — T063) are language-specific.
      const base = (keys: string[]) =>
        Array.from(new Set(keys.map((k) => k.replace(/_(one|few|many|other)$/, '')))).sort();
      expect(base(Object.keys(locale))).toEqual(base(enKeys));
    });

    it.each(NON_EN_LOCALES)('%s.json has no empty values', (_code, locale) => {
      const empty = Object.entries(locale).filter(([, v]) => !v.trim()).map(([k]) => k);
      expect(empty).toEqual([]);
    });

    it.each(NON_EN_LOCALES)(
      '%s.json preserves the interpolation placeholders from en.json',
      (_code, locale) => {
        const mismatched = enKeys.filter(
          (k) => placeholders(locale[k] ?? '') !== placeholders(enRef[k]),
        );
        expect(mismatched).toEqual([]);
      },
    );

    it.each(NON_EN_LOCALES)(
      'all auth/error/validation/reset keys are non-trivial in %s.json',
      (_code, locale) => {
        const trivial = authKeys.filter((k) => (locale[k] ?? '').length <= 2);
        expect(trivial).toEqual([]);
      },
    );

    it.each(Object.entries(LOCALES))('%s.json covers every active challenge title key', (_code, locale) => {
      const challengeKeys = Object.keys(locale).filter((key) => ACTIVE_CHALLENGE_TITLE_KEY_PATTERN.test(key));
      const pack23Keys = challengeKeys.filter((key) => PACK_2_3_CHALLENGE_TITLE_KEY_PATTERN.test(key));
      const invalidValues = challengeKeys.filter((key) => !locale[key]?.trim() || locale[key] === key);

      expect(challengeKeys).toHaveLength(ACTIVE_CHALLENGE_TITLE_KEY_COUNT);
      expect(pack23Keys).toHaveLength(PACK_2_3_CHALLENGE_TITLE_KEY_COUNT);
      expect(invalidValues).toEqual([]);
    });

    it('Pack 2/3 SQL fallback titles match en.json', () => {
      const migration = fs.readFileSync(path.join(ROOT, PACK_2_3_TITLE_WORDING_MIGRATION), 'utf-8');
      const rowPattern = /\('((?:CRF|SPN|ATK|FTW|DEF|SRV|CMP|EXP)[23]\d{2})', '((?:''|[^'])*)'\)/g;
      const rows = [...migration.matchAll(rowPattern)].map((match) => [
        `badgeChallenge_${match[1]}`,
        match[2].replace(/''/g, "'"),
      ] as const);

      const mismatched = rows.filter(([key, title]) => enRef[key] !== title);

      expect(rows).toHaveLength(PACK_2_3_CHALLENGE_TITLE_KEY_COUNT);
      expect(mismatched).toEqual([]);
    });
  });

  describe('auth screen hardcoded string audit', () => {
    for (const relPath of AUTH_SCREEN_FILES) {
      describe(relPath, () => {
        let content: string;

        beforeAll(() => {
          const fullPath = path.join(ROOT, relPath);
          content = fs.readFileSync(fullPath, 'utf-8');
        });

        it('imports and uses useI18n', () => {
          expect(content).toContain('useI18n');
          expect(content).toMatch(/\bs\s*\(/);
        });

        it('contains no Romanian diacritics in source code', () => {
          // Strip comments before checking
          const stripped = content
            .replace(/\/\*[\s\S]*?\*\//g, '')
            .replace(/\/\/.*/g, '');

          const lines = stripped.split('\n');
          const violations = lines
            .map((line, i) => ({ line: i + 1, text: line.trim() }))
            .filter(({ text }) => ROMANIAN_DIACRITICS.test(text));

          expect(violations).toEqual([]);
        });

        it('contains no Romanian HTML entities in JSX', () => {
          const stripped = content
            .replace(/\/\*[\s\S]*?\*\//g, '')
            .replace(/\/\/.*/g, '');

          const lines = stripped.split('\n');
          const violations = lines
            .map((line, i) => ({ line: i + 1, text: line.trim() }))
            .filter(({ text }) => ROMANIAN_HTML_ENTITIES.test(text));

          expect(violations).toEqual([]);
        });

        it('has no hardcoded natural language in JSX text nodes', () => {
          // Match text between > and </ (JSX text nodes)
          const jsxTextPattern = />([^<{}]+)<\//g;
          const violations: string[] = [];
          let match;

          while ((match = jsxTextPattern.exec(content)) !== null) {
            const text = match[1].trim();
            if (!text) continue;
            if (ALLOWED_HARDCODED_STRINGS.has(text)) continue;
            // Only flag strings with 2+ consecutive alphabetic chars
            if (!/[a-zA-Z]{2,}/.test(text)) continue;
            violations.push(text);
          }

          expect(violations).toEqual([]);
        });
      });
    }
  });
});
