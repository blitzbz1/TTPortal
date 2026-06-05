export const CANONICAL_COUNTRY_NAMES: Record<string, string> = {
  AL: 'Albania',
  AD: 'Andorra',
  AT: 'Austria',
  BA: 'Bosnia and Herzegovina',
  BE: 'Belgium',
  BG: 'Bulgaria',
  BY: 'Belarus',
  CH: 'Switzerland',
  CY: 'Cyprus',
  CZ: 'Czechia',
  DE: 'Germany',
  DK: 'Denmark',
  EE: 'Estonia',
  ES: 'Spain',
  FI: 'Finland',
  FR: 'France',
  GB: 'United Kingdom',
  GR: 'Greece',
  HR: 'Croatia',
  HU: 'Hungary',
  IE: 'Ireland',
  IS: 'Iceland',
  IT: 'Italy',
  LI: 'Liechtenstein',
  LT: 'Lithuania',
  LU: 'Luxembourg',
  LV: 'Latvia',
  MD: 'Moldova',
  ME: 'Montenegro',
  MK: 'North Macedonia',
  MT: 'Malta',
  NL: 'Netherlands',
  NO: 'Norway',
  PL: 'Poland',
  PT: 'Portugal',
  RO: 'Romania',
  RS: 'Serbia',
  SE: 'Sweden',
  SI: 'Slovenia',
  SK: 'Slovakia',
  TR: 'Turkey',
  UA: 'Ukraine',
  XK: 'Kosovo',
};

const COUNTRY_NAME_OVERRIDES: Record<string, Record<string, string>> = {
  ro: {
    AL: 'Albania',
    AD: 'Andorra',
    AT: 'Austria',
    BA: 'Bosnia \u0219i Her\u021begovina',
    BE: 'Belgia',
    BG: 'Bulgaria',
    BY: 'Belarus',
    CH: 'Elve\u021bia',
    CY: 'Cipru',
    CZ: 'Cehia',
    DE: 'Germania',
    DK: 'Danemarca',
    EE: 'Estonia',
    ES: 'Spania',
    FI: 'Finlanda',
    FR: 'Fran\u021ba',
    GB: 'Regatul Unit',
    GR: 'Grecia',
    HR: 'Croa\u021bia',
    HU: 'Ungaria',
    IE: 'Irlanda',
    IS: 'Islanda',
    IT: 'Italia',
    LI: 'Liechtenstein',
    LT: 'Lituania',
    LU: 'Luxemburg',
    LV: 'Letonia',
    MD: 'Moldova',
    ME: 'Muntenegru',
    MK: 'Macedonia de Nord',
    MT: 'Malta',
    NL: '\u021a\u0103rile de Jos',
    NO: 'Norvegia',
    PL: 'Polonia',
    PT: 'Portugalia',
    RO: 'Rom\u00e2nia',
    RS: 'Serbia',
    SE: 'Suedia',
    SI: 'Slovenia',
    SK: 'Slovacia',
    TR: 'Turcia',
    UA: 'Ucraina',
    XK: 'Kosovo',
  },
};

const COUNTRY_CODE_BY_NAME = buildCountryCodeByName();

type IntlWithDisplayNames = typeof Intl & {
  DisplayNames?: new (locales: string[], options: { type: 'region' }) => {
    of(code: string): string | undefined;
  };
};

export function getCanonicalCountryName(code: string | null | undefined, fallback?: string | null): string {
  const normalized = normalizeCountryCode(code) || inferCountryCodeFromName(fallback);
  if (!normalized) return fallback || '';
  return CANONICAL_COUNTRY_NAMES[normalized] ?? fallback ?? normalized;
}

export function getLocalizedCountryName(
  code: string | null | undefined,
  locale: string | null | undefined,
  fallback?: string | null,
): string {
  const normalized = normalizeCountryCode(code) || inferCountryCodeFromName(fallback);
  if (!normalized) return fallback || '';
  const language = (locale || 'en').split('-')[0].toLowerCase();
  const override = COUNTRY_NAME_OVERRIDES[language]?.[normalized];
  if (override) return override;

  const displayName = getIntlRegionName(normalized, locale || language);
  return displayName || getCanonicalCountryName(normalized, fallback);
}

function normalizeCountryCode(code: string | null | undefined): string {
  const normalized = (code || '').trim().toUpperCase();
  if (/^[A-Z]{2}$/.test(normalized)) return normalized;
  return inferCountryCodeFromName(code);
}

function inferCountryCodeFromName(name: string | null | undefined): string {
  const key = normalizeCountryNameKey(name);
  return key ? COUNTRY_CODE_BY_NAME[key] ?? '' : '';
}

function buildCountryCodeByName(): Record<string, string> {
  const entries: Array<[string, string]> = [];
  Object.entries(CANONICAL_COUNTRY_NAMES).forEach(([code, name]) => entries.push([name, code]));
  Object.values(COUNTRY_NAME_OVERRIDES).forEach((names) => {
    Object.entries(names).forEach(([code, name]) => entries.push([name, code]));
  });
  return Object.fromEntries(entries.map(([name, code]) => [normalizeCountryNameKey(name), code]));
}

function normalizeCountryNameKey(name: string | null | undefined): string {
  return (name || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function getIntlRegionName(code: string, locale: string): string | null {
  try {
    const DisplayNames = (Intl as IntlWithDisplayNames).DisplayNames;
    if (!DisplayNames) return null;
    return new DisplayNames([locale], { type: 'region' }).of(code) ?? null;
  } catch {
    return null;
  }
}
