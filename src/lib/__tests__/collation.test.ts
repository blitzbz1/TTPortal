import { compareDefault, compareEn, compareLocale, compareRo } from '../collation';

// The whole point of the collation module is that a reused Intl.Collator is
// ORDERING-IDENTICAL to the equivalent String.prototype.localeCompare call — so
// swapping it into the catalog sorts is a pure performance change with no
// behavioural difference on any platform. These tests pin that equivalence.
const NAMES = [
  'Zürich', 'Zagreb', 'Aarhus', 'Órbita', 'Iași', 'Iasi', 'Cluj', 'Cluj-Napoca',
  'Åre', 'Bucureşti', 'București', 'Łódź', 'Lodz', 'Òviedo', 'Oviedo', 'Wien', 'Wrocław',
];

describe('collation', () => {
  it('compareRo orders identically to localeCompare(_, "ro")', () => {
    expect([...NAMES].sort(compareRo)).toEqual([...NAMES].sort((a, b) => a.localeCompare(b, 'ro')));
  });

  it('compareEn orders identically to localeCompare(_, "en")', () => {
    expect([...NAMES].sort(compareEn)).toEqual([...NAMES].sort((a, b) => a.localeCompare(b, 'en')));
  });

  it('compareDefault orders identically to default localeCompare', () => {
    expect([...NAMES].sort(compareDefault)).toEqual([...NAMES].sort((a, b) => a.localeCompare(b)));
  });

  it('compareLocale matches localeCompare(_, locale) and caches per locale', () => {
    expect(compareLocale('de')).toBe(compareLocale('de'));
    expect([...NAMES].sort(compareLocale('de'))).toEqual([...NAMES].sort((a, b) => a.localeCompare(b, 'de')));
  });
});
