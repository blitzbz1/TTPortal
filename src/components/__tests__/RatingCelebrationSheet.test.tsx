jest.mock('../../hooks/useI18n', () => ({
  useI18n: () => ({
    s: (key: string, ...args: unknown[]) => {
      const raw = require('../../locales/en.json')[key] || key;
      return args.reduce<string>((acc, value, index) => acc.replace(`{${index}}`, String(value)), raw);
    },
  }),
}));
jest.mock('../../hooks/useTheme', () => ({
  useTheme: () => ({ colors: require('../../theme').lightColors, isDark: false }),
}));
jest.mock('../Icon', () => {
  const { View } = require('react-native');
  return { Lucide: ({ name }: { name: string }) => <View testID={`lucide-icon-${name}`} /> };
});
jest.mock('../../lib/haptics', () => ({ hapticSuccess: jest.fn() }));
jest.mock('../../lib/awardShare', () => ({ shareAward: jest.fn() }));

import React from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';
import { RatingCelebrationSheet } from '../RatingCelebrationSheet';
import { shareAward } from '../../lib/awardShare';

describe('RatingCelebrationSheet', () => {
  it('uses the shared award modal and invokes the working share path', async () => {
    const { getByTestId } = render(
      <RatingCelebrationSheet
        visible
        rating={1284}
        delta={24}
        peak={1301}
        matches={18}
        shareUrl="https://example.com/player/me"
        onClose={jest.fn()}
      />,
    );

    expect(getByTestId('rating-celebration')).toBeTruthy();
    await act(async () => { fireEvent.press(getByTestId('rating-share')); });
    expect(shareAward).toHaveBeenCalledWith(expect.objectContaining({
      message: require('../../locales/en.json').ratingCelebrationShareMessage,
      url: 'https://example.com/player/me',
    }));
  });
});
