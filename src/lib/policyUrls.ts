import Constants from 'expo-constants';

const DEFAULT_BASE_URL = 'https://ttportal.org';

export type PolicyKind = 'privacy' | 'terms' | 'cookies';

function getBaseUrl(): string {
  const configured = Constants.expoConfig?.extra?.marketingSiteUrl;
  return typeof configured === 'string' && configured.length > 0
    ? configured.replace(/\/$/, '')
    : DEFAULT_BASE_URL;
}

export function getPolicyUrl(locale: string, kind: PolicyKind): string {
  return `${getBaseUrl()}/${locale}/${kind}`;
}
