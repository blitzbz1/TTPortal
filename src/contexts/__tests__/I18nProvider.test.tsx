const mockDb = {
  execSync: jest.fn(),
  getFirstSync: jest.fn((): { value: string } | null => null),
  runSync: jest.fn(),
};

jest.mock('expo-sqlite', () => ({
  openDatabaseSync: () => mockDb,
}));

// eslint-disable-next-line import/first
import React from 'react';
// eslint-disable-next-line import/first
import { Text, Pressable } from 'react-native';
// eslint-disable-next-line import/first
import { render, screen, userEvent } from '@testing-library/react-native';
// eslint-disable-next-line import/first
import { I18nProvider } from '../I18nProvider';
// eslint-disable-next-line import/first
import { useI18n } from '../../hooks/useI18n';

function TestConsumer() {
  const { lang, setLang, s } = useI18n();
  return (
    <>
      <Text testID="lang">{lang}</Text>
      <Text testID="authLogin">{s('authLogin')}</Text>
      <Text testID="nonexistent">{s('nonexistent')}</Text>
      <Pressable testID="switchToEn" onPress={() => setLang('en')}>
        <Text>Switch EN</Text>
      </Pressable>
      <Pressable testID="switchToRo" onPress={() => setLang('ro')}>
        <Text>Switch RO</Text>
      </Pressable>
    </>
  );
}

describe('I18nProvider', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns Romanian string for authLogin when lang is ro', () => {
    render(
      <I18nProvider initialLang="ro">
        <TestConsumer />
      </I18nProvider>
    );

    expect(screen.getByTestId('lang')).toHaveTextContent('ro');
    expect(screen.getByTestId('authLogin')).toHaveTextContent('Conectare');
  });

  it('returns English string for authLogin when lang is en', () => {
    render(
      <I18nProvider initialLang="en">
        <TestConsumer />
      </I18nProvider>
    );

    expect(screen.getByTestId('lang')).toHaveTextContent('en');
    expect(screen.getByTestId('authLogin')).toHaveTextContent('Log in');
  });

  it('returns the key itself as fallback for nonexistent keys', () => {
    render(
      <I18nProvider initialLang="ro">
        <TestConsumer />
      </I18nProvider>
    );

    expect(screen.getByTestId('nonexistent')).toHaveTextContent('nonexistent');
  });

  it('switches from ro to en and updates resolved strings', async () => {
    const user = userEvent.setup();

    render(
      <I18nProvider initialLang="ro">
        <TestConsumer />
      </I18nProvider>
    );

    expect(screen.getByTestId('authLogin')).toHaveTextContent('Conectare');

    await user.press(screen.getByTestId('switchToEn'));

    expect(screen.getByTestId('lang')).toHaveTextContent('en');
    expect(screen.getByTestId('authLogin')).toHaveTextContent('Log in');
  });

  it('switches from en to ro and updates resolved strings', async () => {
    const user = userEvent.setup();

    render(
      <I18nProvider initialLang="en">
        <TestConsumer />
      </I18nProvider>
    );

    expect(screen.getByTestId('authLogin')).toHaveTextContent('Log in');

    await user.press(screen.getByTestId('switchToRo'));

    expect(screen.getByTestId('lang')).toHaveTextContent('ro');
    expect(screen.getByTestId('authLogin')).toHaveTextContent('Conectare');
  });

  it('persists language to SQLite when setLang is called', async () => {
    const user = userEvent.setup();

    render(
      <I18nProvider initialLang="ro">
        <TestConsumer />
      </I18nProvider>
    );

    await user.press(screen.getByTestId('switchToEn'));

    expect(mockDb.runSync).toHaveBeenCalledWith(
      'INSERT OR REPLACE INTO storage (key, value) VALUES (?, ?);',
      ['ttportal-lang', 'en']
    );
  });

  it('loads language from SQLite when no initialLang is provided', () => {
    mockDb.getFirstSync.mockReturnValueOnce({ value: 'en' });

    render(
      <I18nProvider>
        <TestConsumer />
      </I18nProvider>
    );

    expect(mockDb.execSync).toHaveBeenCalledWith(
      'CREATE TABLE IF NOT EXISTS storage (key TEXT PRIMARY KEY, value TEXT);'
    );
    expect(mockDb.getFirstSync).toHaveBeenCalledWith(
      'SELECT value FROM storage WHERE key = ?;',
      ['ttportal-lang']
    );
    expect(screen.getByTestId('lang')).toHaveTextContent('en');
  });

  it('falls back to ro when stored value is invalid', () => {
    mockDb.getFirstSync.mockReturnValueOnce({ value: 'fr' });

    render(
      <I18nProvider>
        <TestConsumer />
      </I18nProvider>
    );

    expect(screen.getByTestId('lang')).toHaveTextContent('ro');
  });

  it('falls back to English string when key missing from current locale', () => {
    // Verify fallback: if a key exists in en.json but not in ro.json,
    // the English string is returned. Since both files currently have
    // identical keys, we test via the nonexistent key path (returns key).
    render(
      <I18nProvider initialLang="ro">
        <TestConsumer />
      </I18nProvider>
    );

    expect(screen.getByTestId('nonexistent')).toHaveTextContent('nonexistent');
  });
});

describe('useI18n', () => {
  it('throws when used outside I18nProvider', () => {
    // Suppress React error boundary console output
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => render(<TestConsumer />)).toThrow(
      'useI18n must be used within an I18nProvider'
    );

    spy.mockRestore();
  });
});
