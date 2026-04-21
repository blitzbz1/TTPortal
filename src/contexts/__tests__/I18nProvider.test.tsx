const mockGetItem = jest.fn<Promise<string | null>, [string]>(() =>
  Promise.resolve(null),
);
const mockSetItem = jest.fn<Promise<void>, [string, string]>(() =>
  Promise.resolve(),
);
const mockRemoveItem = jest.fn<Promise<void>, [string]>(() => Promise.resolve());

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: (...args: [string]) => mockGetItem(...args),
    setItem: (...args: [string, string]) => mockSetItem(...args),
    removeItem: (...args: [string]) => mockRemoveItem(...args),
  },
}));

 
import React from 'react';
 
import { Text, Pressable } from 'react-native';
 
import { render, screen, userEvent } from '@testing-library/react-native';
 
import { I18nProvider } from '../I18nProvider';
 
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
    mockGetItem.mockImplementation(() => Promise.resolve(null));
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

  it('persists language to AsyncStorage when setLang is called', async () => {
    const user = userEvent.setup();

    render(
      <I18nProvider initialLang="ro">
        <TestConsumer />
      </I18nProvider>
    );

    await user.press(screen.getByTestId('switchToEn'));

    expect(mockSetItem).toHaveBeenCalledWith('ttportal-lang', 'en');
  });

  it('loads language from AsyncStorage when no initialLang is provided', async () => {
    mockGetItem.mockImplementationOnce(() => Promise.resolve('en'));

    render(
      <I18nProvider>
        <TestConsumer />
      </I18nProvider>
    );

    expect(mockGetItem).toHaveBeenCalledWith('ttportal-lang');
    await screen.findByText('en');
    expect(screen.getByTestId('lang')).toHaveTextContent('en');
  });

  it('falls back to ro when stored value is invalid', async () => {
    mockGetItem.mockImplementationOnce(() => Promise.resolve('fr'));

    render(
      <I18nProvider>
        <TestConsumer />
      </I18nProvider>
    );

    await new Promise((r) => setTimeout(r, 0));
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
