// Diacritic-insensitive string matching for client-side typeahead.
//
// Romanian text uses ă, â, î, ș, ț (and their uppercase forms). Naive
// `toLowerCase + includes` won't match "Bucuresti" against "București"
// because the Unicode code points differ. The standard fix is Unicode
// NFD normalization, which decomposes each accented character into a
// base letter + combining diacritic, after which a regex strips the
// combining marks. The result is plain ASCII for Latin-based scripts.
//
// We use \p{Diacritic} (Unicode property escape) — it's broader than
// ̀-ͯ and covers every Unicode-defined combining diacritic,
// not just the Latin range. Requires the /u flag.

export function foldDiacritics(s: string): string {
  return s.normalize('NFD').replace(/\p{Diacritic}/gu, '');
}

// Case- and diacritic-insensitive substring match. Pre-fold both inputs.
export function matchesQuery(haystack: string, query: string): boolean {
  if (!query) return true;
  return foldDiacritics(haystack).toLowerCase().includes(
    foldDiacritics(query).toLowerCase(),
  );
}
