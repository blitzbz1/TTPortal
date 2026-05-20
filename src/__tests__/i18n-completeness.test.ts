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

const ROOT = path.resolve(__dirname, '../..');

/** Every shipped locale keyed by code; `en` is the reference for parity. */
const LOCALES: Record<string, Record<string, string>> = { ro, en, de, it: itLocale, fr, es, pl, cs };
/** Locales audited against the English reference. */
const NON_EN_LOCALES: [string, Record<string, string>][] = Object.entries(LOCALES).filter(
  ([code]) => code !== 'en',
);

/** Auth screen files to audit for hardcoded strings. */
const AUTH_SCREEN_FILES = [
  'src/app/sign-in.tsx',
  'src/app/forgot-password.tsx',
  'src/app/reset-password.tsx',
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

    it.each(NON_EN_LOCALES)('%s.json has the same key set as en.json', (_code, locale) => {
      expect(Object.keys(locale).sort()).toEqual(enKeys);
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
