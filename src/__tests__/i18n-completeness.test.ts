import * as fs from 'fs';
import * as path from 'path';
import ro from '../locales/ro.json';
import en from '../locales/en.json';

const ROOT = path.resolve(__dirname, '../..');

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
]);

/** Romanian diacritics that indicate a hardcoded Romanian string. */
const ROMANIAN_DIACRITICS = /[ăâîșțĂÂÎȘȚ]/;

/** HTML entities for Romanian diacritical characters. */
const ROMANIAN_HTML_ENTITIES = /&#(226|259|238|537|539);/;

describe('i18n completeness', () => {
  describe('locale key parity', () => {
    const roKeys = Object.keys(ro).sort();
    const enKeys = Object.keys(en).sort();

    it('ro.json and en.json have identical key sets', () => {
      expect(roKeys).toEqual(enKeys);
    });

    it('ro.json has no empty values', () => {
      for (const value of Object.values(ro)) {
        expect(value.trim()).not.toBe('');
      }
    });

    it('en.json has no empty values', () => {
      for (const value of Object.values(en)) {
        expect(value.trim()).not.toBe('');
      }
    });

    it('all auth/error/validation/reset keys have non-trivial values in both locales', () => {
      const authKeys = roKeys.filter(
        (k) =>
          k.startsWith('auth') ||
          k.startsWith('error') ||
          k.startsWith('validation') ||
          k.startsWith('reset') ||
          k.startsWith('forgot'),
      );
      expect(authKeys.length).toBeGreaterThanOrEqual(15);
      for (const key of authKeys) {
        const roVal = (ro as Record<string, string>)[key];
        const enVal = (en as Record<string, string>)[key];
        expect(roVal.length).toBeGreaterThan(2);
        expect(enVal.length).toBeGreaterThan(2);
      }
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
