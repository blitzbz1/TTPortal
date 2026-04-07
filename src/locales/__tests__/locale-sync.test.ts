import en from '../en.json';
import ro from '../ro.json';

describe('Locale files sync', () => {
  const enKeys = Object.keys(en);
  const roKeys = Object.keys(ro);

  it('en.json and ro.json have the same keys', () => {
    expect(enKeys.sort()).toEqual(roKeys.sort());
  });

  it('no key has an empty string value in en.json', () => {
    for (const key of enKeys) {
      expect((en as any)[key]).not.toBe('');
    }
  });

  it('no key has an empty string value in ro.json', () => {
    for (const key of roKeys) {
      expect((ro as any)[key]).not.toBe('');
    }
  });

  it('contains all required new keys', () => {
    const required = [
      'venuePickerTitle', 'venuePickerSearch', 'venuePickerEmpty',
      'checkout', 'couldNotGetLocation', 'geocodeSuccess', 'dragPinHint',
      'confirmLogout', 'noFriendsHere', 'retry',
      'venueLoadError', 'profileLoadError', 'customMinutesPlaceholder',
      'noPhotosYet', 'favAdd', 'favRemove',
    ];
    for (const key of required) {
      expect(enKeys).toContain(key);
      expect(roKeys).toContain(key);
    }
  });
});
