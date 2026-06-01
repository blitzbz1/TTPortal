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

  it('ro.json and en.json have identical key sets', () => {
    const roKeys = Object.keys(ro).sort();
    const enKeys = Object.keys(en).sort();
    expect(roKeys).toEqual(enKeys);
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
