import React from 'react';
import { Pressable, Text } from 'react-native';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { ShareProvider, useAppShare } from '../ShareProvider';

jest.mock('../../hooks/useI18n', () => ({
  useI18n: () => ({
    s: (key: string) => ({
      shareCard: 'Share',
      shareOpenLink: 'Open link',
      shareCopyLink: 'Copy link',
      shareCopied: 'Copied',
      cancel: 'Cancel',
    }[key] ?? key),
  }),
}));

jest.mock('../../hooks/useTheme', () => ({
  useTheme: () => ({ colors: require('../../theme').lightColors }),
}));

jest.mock('../../components/Icon', () => ({ Lucide: () => null }));

function ShareButton() {
  const { share } = useAppShare();
  return (
    <Pressable
      testID="share"
      onPress={() => void share({
        title: 'Parcul Național',
        message: 'Parcul Național - aleea pan halipa',
        url: 'https://www.ttportal.org/TTPortal/app/venue/73',
      })}
    >
      <Text>Share</Text>
    </Pressable>
  );
}

describe('ShareProvider', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('opens the global web share sheet when native sharing is unavailable', async () => {
    jest.replaceProperty(require('react-native').Platform, 'OS', 'web');

    const { getByTestId, getByText } = render(
      <ShareProvider>
        <ShareButton />
      </ShareProvider>,
    );

    fireEvent.press(getByTestId('share'));

    await waitFor(() => {
      expect(getByText('WhatsApp')).toBeTruthy();
      expect(getByText('Telegram')).toBeTruthy();
      expect(getByText('Copy link')).toBeTruthy();
    });
  });
});
