import { useContext } from 'react';
import { I18nContext, type I18nContextValue } from '../contexts/I18nProvider';

/**
 * Hook to access the i18n context.
 * Must be used within an I18nProvider.
 * @returns The i18n context value with `lang`, `setLang`, and `s()`.
 * @throws {Error} If used outside of an I18nProvider.
 */
export function useI18n(): I18nContextValue {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error('useI18n must be used within an I18nProvider');
  }
  return context;
}
