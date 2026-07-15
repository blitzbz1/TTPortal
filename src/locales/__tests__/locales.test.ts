import ro from '../ro.json';
import en from '../en.json';

const REQUIRED_AUTH_KEYS = [
  'authSignup',
  'authLogin',
  'authForgot',
  'validationEmailInvalid',
  'validationPasswordMin',
  'validationNameRequired',
  'errorDuplicateEmail',
  'errorDuplicateEmailNoSocial',
  'errorInvalidCredentials',
  'errorNetwork',
  'logout',
  'forgotPasswordSuccess',
] as const;

describe('locale files', () => {
  it('ro.json parses as a valid object with string values', () => {
    expect(typeof ro).toBe('object');
    expect(ro).not.toBeNull();
    for (const [key, value] of Object.entries(ro)) {
      expect(typeof value).toBe('string');
      expect(key.length).toBeGreaterThan(0);
    }
  });

  it('en.json parses as a valid object with string values', () => {
    expect(typeof en).toBe('object');
    expect(en).not.toBeNull();
    for (const [key, value] of Object.entries(en)) {
      expect(typeof value).toBe('string');
      expect(key.length).toBeGreaterThan(0);
    }
  });

  it('ro.json and en.json have identical BASE key sets', () => {
    // Plural-variant suffixes (_one/_few/_many/_other — T063) are
    // legitimately language-specific: ro needs _few, en doesn't.
    const baseKeys = (obj: object) =>
      Array.from(new Set(Object.keys(obj).map((k) => k.replace(/_(one|few|many|other)$/, '')))).sort();
    expect(baseKeys(ro)).toEqual(baseKeys(en));
  });

  it.each(REQUIRED_AUTH_KEYS)(
    'contains required auth key "%s" in both locales',
    (key) => {
      expect(ro).toHaveProperty(key);
      expect(en).toHaveProperty(key);
      expect((ro as Record<string, string>)[key].length).toBeGreaterThan(0);
      expect((en as Record<string, string>)[key].length).toBeGreaterThan(0);
    }
  );

  it('has no empty string values in ro.json', () => {
    for (const value of Object.values(ro)) {
      expect(value.trim().length).toBeGreaterThan(0);
    }
  });

  it('has no empty string values in en.json', () => {
    for (const value of Object.values(en)) {
      expect(value.trim().length).toBeGreaterThan(0);
    }
  });
});
