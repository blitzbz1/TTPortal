import { foldDiacritics, matchesQuery } from '../textSearch';

describe('foldDiacritics', () => {
  it('strips Romanian diacritics', () => {
    expect(foldDiacritics('București')).toBe('Bucuresti');
    expect(foldDiacritics('Cluj-Napoca')).toBe('Cluj-Napoca');
    expect(foldDiacritics('Târgu Mureș')).toBe('Targu Mures');
    expect(foldDiacritics('Brașov')).toBe('Brasov');
    expect(foldDiacritics('Iași')).toBe('Iasi');
    expect(foldDiacritics('Pitești')).toBe('Pitesti');
  });

  it('handles already-ASCII input unchanged', () => {
    expect(foldDiacritics('Bucuresti')).toBe('Bucuresti');
    expect(foldDiacritics('')).toBe('');
  });

  it('preserves case', () => {
    expect(foldDiacritics('ȘERBAN')).toBe('SERBAN');
    expect(foldDiacritics('șerban')).toBe('serban');
  });

  it('strips diacritics outside Romanian (Spanish, German, Vietnamese)', () => {
    expect(foldDiacritics('mañana')).toBe('manana');
    expect(foldDiacritics('über')).toBe('uber');
    expect(foldDiacritics('Tiếng Việt')).toBe('Tieng Viet');
  });
});

describe('matchesQuery', () => {
  it('matches diacritic-stripped query against accented haystack', () => {
    expect(matchesQuery('București', 'bucur')).toBe(true);
    expect(matchesQuery('București', 'Bucuresti')).toBe(true);
    expect(matchesQuery('Pitești', 'pitesti')).toBe(true);
  });

  it('matches accented query against accented haystack', () => {
    expect(matchesQuery('București', 'București')).toBe(true);
    expect(matchesQuery('Târgu Mureș', 'mureș')).toBe(true);
  });

  it('matches accented query against ASCII haystack', () => {
    expect(matchesQuery('Bucharest', 'București')).toBe(false);
    expect(matchesQuery('Bucuresti', 'București')).toBe(true);
  });

  it('is case-insensitive', () => {
    expect(matchesQuery('București', 'BUCUR')).toBe(true);
    expect(matchesQuery('CLUJ', 'cluj')).toBe(true);
  });

  it('does substring match, not prefix-only', () => {
    expect(matchesQuery('Parc Tineretului', 'tineret')).toBe(true);
    expect(matchesQuery('Sala Olimpia', 'lim')).toBe(true);
  });

  it('treats empty query as match-all', () => {
    expect(matchesQuery('anything', '')).toBe(true);
  });

  it('returns false for non-matching strings', () => {
    expect(matchesQuery('București', 'cluj')).toBe(false);
    expect(matchesQuery('', 'bucur')).toBe(false);
  });
});
