const mockGetSync = jest.fn<string | null, [string]>(() => null);
const mockSetString = jest.fn<void, [string, string]>(() => undefined);

jest.mock('../../lib/mmkv', () => ({
  __esModule: true,
  getStringSync: (...args: [string]) => mockGetSync(...args),
  setString: (...args: [string, string]) => mockSetString(...args),
}));

 
import React from 'react';
 
import { Text, Pressable } from 'react-native';
 
import { render, screen, userEvent } from '@testing-library/react-native';
 
import { ThemeProvider } from '../ThemeProvider';
 
import { useTheme } from '../../hooks/useTheme';
 
import { lightColors, darkColors } from '../../theme';

function TestConsumer() {
  const { mode, resolved, colors, setMode, isDark } = useTheme();
  return (
    <>
      <Text testID="mode">{mode}</Text>
      <Text testID="resolved">{resolved}</Text>
      <Text testID="isDark">{String(isDark)}</Text>
      <Text testID="bgColor">{colors.bg}</Text>
      <Text testID="textColor">{colors.text}</Text>
      <Pressable testID="setLight" onPress={() => setMode('light')}>
        <Text>Light</Text>
      </Pressable>
      <Pressable testID="setDark" onPress={() => setMode('dark')}>
        <Text>Dark</Text>
      </Pressable>
      <Pressable testID="setSystem" onPress={() => setMode('system')}>
        <Text>System</Text>
      </Pressable>
    </>
  );
}

describe('ThemeProvider', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetSync.mockImplementation(() => null);
  });

  it('defaults to system mode', () => {
    render(
      <ThemeProvider>
        <TestConsumer />
      </ThemeProvider>
    );

    expect(screen.getByTestId('mode')).toHaveTextContent('system');
  });

  it('system mode resolves to light when device scheme is not dark', () => {
    render(
      <ThemeProvider>
        <TestConsumer />
      </ThemeProvider>
    );

    // In test env useColorScheme returns null, which resolves to light
    expect(screen.getByTestId('resolved')).toHaveTextContent('light');
    expect(screen.getByTestId('isDark')).toHaveTextContent('false');
    expect(screen.getByTestId('bgColor')).toHaveTextContent(lightColors.bg);
  });

  it('uses initialMode when provided', () => {
    render(
      <ThemeProvider initialMode="dark">
        <TestConsumer />
      </ThemeProvider>
    );

    expect(screen.getByTestId('mode')).toHaveTextContent('dark');
    expect(screen.getByTestId('resolved')).toHaveTextContent('dark');
  });

  it('provides light colors when mode is light', () => {
    render(
      <ThemeProvider initialMode="light">
        <TestConsumer />
      </ThemeProvider>
    );

    expect(screen.getByTestId('bgColor')).toHaveTextContent(lightColors.bg);
    expect(screen.getByTestId('textColor')).toHaveTextContent(lightColors.text);
    expect(screen.getByTestId('isDark')).toHaveTextContent('false');
  });

  it('provides dark colors when mode is dark', () => {
    render(
      <ThemeProvider initialMode="dark">
        <TestConsumer />
      </ThemeProvider>
    );

    expect(screen.getByTestId('bgColor')).toHaveTextContent(darkColors.bg);
    expect(screen.getByTestId('textColor')).toHaveTextContent(darkColors.text);
    expect(screen.getByTestId('isDark')).toHaveTextContent('true');
  });

  it('switches from light to dark and updates colors', async () => {
    const user = userEvent.setup();

    render(
      <ThemeProvider initialMode="light">
        <TestConsumer />
      </ThemeProvider>
    );

    expect(screen.getByTestId('bgColor')).toHaveTextContent(lightColors.bg);

    await user.press(screen.getByTestId('setDark'));

    expect(screen.getByTestId('mode')).toHaveTextContent('dark');
    expect(screen.getByTestId('bgColor')).toHaveTextContent(darkColors.bg);
  });

  it('switches from dark to light and updates colors', async () => {
    const user = userEvent.setup();

    render(
      <ThemeProvider initialMode="dark">
        <TestConsumer />
      </ThemeProvider>
    );

    await user.press(screen.getByTestId('setLight'));

    expect(screen.getByTestId('mode')).toHaveTextContent('light');
    expect(screen.getByTestId('bgColor')).toHaveTextContent(lightColors.bg);
  });

  it('persists mode to MMKV when setMode is called', async () => {
    const user = userEvent.setup();

    render(
      <ThemeProvider initialMode="light">
        <TestConsumer />
      </ThemeProvider>
    );

    await user.press(screen.getByTestId('setDark'));

    expect(mockSetString).toHaveBeenCalledWith('ttportal-theme', 'dark');
  });

  it('loads mode from MMKV synchronously when no initialMode is provided', () => {
    mockGetSync.mockReturnValueOnce('dark');

    render(
      <ThemeProvider>
        <TestConsumer />
      </ThemeProvider>
    );

    expect(mockGetSync).toHaveBeenCalledWith('ttportal-theme');
    // Sync hydrate — no waitFor needed.
    expect(screen.getByTestId('mode')).toHaveTextContent('dark');
  });

  it('falls back to system when stored value is invalid', () => {
    mockGetSync.mockReturnValueOnce('invalid');

    render(
      <ThemeProvider>
        <TestConsumer />
      </ThemeProvider>
    );

    expect(screen.getByTestId('mode')).toHaveTextContent('system');
  });

  it('switches to system mode', async () => {
    const user = userEvent.setup();

    render(
      <ThemeProvider initialMode="dark">
        <TestConsumer />
      </ThemeProvider>
    );

    expect(screen.getByTestId('resolved')).toHaveTextContent('dark');

    await user.press(screen.getByTestId('setSystem'));

    expect(screen.getByTestId('mode')).toHaveTextContent('system');
    // In test env, system resolves to light
    expect(screen.getByTestId('resolved')).toHaveTextContent('light');
  });
});

describe('useTheme', () => {
  it('throws when used outside ThemeProvider', () => {
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => render(<TestConsumer />)).toThrow(
      'useTheme must be used within a ThemeProvider'
    );

    spy.mockRestore();
  });
});
