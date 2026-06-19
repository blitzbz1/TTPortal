import { conditionLabel, venueTypeLabel, venueHoursLabel } from '../venueLabels';

// `s` is mocked as identity so assertions read on the resolved i18n KEY,
// proving the stored value is mapped to a key rather than rendered raw.
const s = (key: string) => key;

describe('conditionLabel', () => {
  it('maps every stored Romanian condition value to its i18n key', () => {
    expect(conditionLabel('buna', s)).toBe('conditionGood');
    expect(conditionLabel('acceptabila', s)).toBe('conditionAcceptable');
    expect(conditionLabel('deteriorata', s)).toBe('conditionDegraded');
    expect(conditionLabel('profesionala', s)).toBe('conditionPro');
    expect(conditionLabel('necunoscuta', s)).toBe('conditionUnknown');
  });

  it('falls back to conditionUnknown for null/undefined/unrecognized (never echoes raw)', () => {
    expect(conditionLabel(null, s)).toBe('conditionUnknown');
    expect(conditionLabel(undefined, s)).toBe('conditionUnknown');
    // a stale/garbage value must not leak through as a raw label
    expect(conditionLabel('buna_veche' as never, s)).toBe('conditionUnknown');
  });
});

describe('venueTypeLabel', () => {
  it('maps the closed venue-type enum to short i18n keys', () => {
    expect(venueTypeLabel('parc_exterior', s)).toBe('typePark');
    expect(venueTypeLabel('sala_indoor', s)).toBe('typeHall');
  });

  it('returns empty string for null/undefined', () => {
    expect(venueTypeLabel(null, s)).toBe('');
    expect(venueTypeLabel(undefined, s)).toBe('');
  });
});

describe('venueHoursLabel', () => {
  it('resolves empty/null hours to the localized free-access string', () => {
    expect(venueHoursLabel(null, s)).toBe('freeAccess247');
    expect(venueHoursLabel(undefined, s)).toBe('freeAccess247');
    expect(venueHoursLabel('   ', s)).toBe('freeAccess247');
  });

  it('resolves language-specific free-access sentinels to the localized string', () => {
    expect(venueHoursLabel('Acces liber', s)).toBe('freeAccess247');
    expect(venueHoursLabel('  ACCES LIBER ', s)).toBe('freeAccess247');
    expect(venueHoursLabel('24/7', s)).toBe('freeAccess247');
    expect(venueHoursLabel('Non-stop', s)).toBe('freeAccess247');
  });

  it('passes language-neutral time ranges through verbatim (trimmed)', () => {
    expect(venueHoursLabel('08:00-22:00', s)).toBe('08:00-22:00');
    expect(venueHoursLabel('Mo-Su 09:00-21:00', s)).toBe('Mo-Su 09:00-21:00');
    expect(venueHoursLabel('  7-22  ', s)).toBe('7-22');
  });
});
