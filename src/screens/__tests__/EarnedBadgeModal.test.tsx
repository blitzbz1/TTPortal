jest.mock('../../hooks/useTheme', () => ({
  useTheme: () => ({ colors: require('../../theme').lightColors, isDark: false }),
}));
jest.mock('../../lib/haptics', () => ({ hapticSuccess: jest.fn() }));
jest.mock('../../components/Icon', () => {
  const { View } = require('react-native');
  return { Lucide: ({ name }: { name: string }) => <View testID={`lucide-icon-${name}`} /> };
});
jest.mock('../../components/BadgeTrackIcon', () => {
  const { View } = require('react-native');
  return { BadgeTrackIcon: () => <View testID="badge-track-icon" /> };
});

import React from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';
import { lightColors } from '../../theme';
import { BADGE_TRACKS } from '../../features/challenges/badgeDefinitions';
import { EarnedBadgeModal } from '../ChallengeScreen/EarnedBadgeModal';

describe('EarnedBadgeModal', () => {
  it('routes Share through the configured callback', async () => {
    const onShare = jest.fn();
    const { getByTestId } = render(
      <EarnedBadgeModal
        data={{ badge: BADGE_TRACKS[0], tier: 'bronze' }}
        colors={lightColors}
        tierLabel={() => 'Bronze'}
        trackName={() => 'Craft Player'}
        s={(key) => key}
        onDismiss={jest.fn()}
        onShare={onShare}
      />,
    );

    expect(getByTestId('badge-earned-modal')).toBeTruthy();
    await act(async () => { fireEvent.press(getByTestId('badge-earned-share')); });
    expect(onShare).toHaveBeenCalledTimes(1);
  });
});
