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

  it('has clean Romanian challenge strings without replacement artifacts', () => {
    const challengeKeyPattern = /^(challenge|badgeTrack|badgeChallenge|eventChallenge|eventAdd|eventAttach|eventNo|eventAward)/;
    const mojibakePattern = /[\u00c2\u00c3\u00c4\u00c5\u00c8\u00c9\u00f0]|[\u0080-\u009f]/;
    const violations = roKeys
      .filter((key) => challengeKeyPattern.test(key))
      .map((key) => [key, (ro as Record<string, string>)[key]] as const)
      .filter(([, value]) => value.includes('?') || mojibakePattern.test(value));

    expect(violations).toEqual([]);
    expect((ro as Record<string, string>).challengeSwitch).toBe('Schimbă');
    expect((ro as Record<string, string>).eventAddChallenge).toBe('Adaugă provocarea curentă la eveniment');
    expect((ro as Record<string, string>).challengeInviteToEvent).toBe('Creează eveniment cu provocarea');
    expect((ro as Record<string, string>).challengeComplete).toBe('Finalizează');
  });
});
