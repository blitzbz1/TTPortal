// F053 — milestone celebration sheet + the "stack after the success sheet"
// gating logic shared by the check-in flow.

jest.mock('../../hooks/useI18n', () => ({
  useI18n: () => ({
    s: (key: string, ...args: unknown[]) => {
      const raw = require('../../locales/en.json')[key] || key;
      return args.reduce<string>((acc, a, i) => acc.replace(`{${i}}`, String(a)), raw);
    },
    lang: 'en' as const,
    setLang: jest.fn(),
  }),
}));
jest.mock('../../hooks/useTheme', () => ({
  useTheme: () => ({ colors: require('../../theme').lightColors, isDark: false }),
}));
jest.mock('../Icon', () => {
  const { View } = require('react-native');
  return { Lucide: ({ name }: { name: string }) => <View testID={`lucide-icon-${name}`} /> };
});
jest.mock('../../lib/shareImage', () => ({ shareCardImage: jest.fn() }));
jest.mock('../../lib/haptics', () => ({ hapticSuccess: jest.fn() }));

import React, { useState } from 'react';
import { Pressable, View } from 'react-native';
import { render, fireEvent } from '@testing-library/react-native';
import { MilestoneCelebrationSheet } from '../MilestoneCelebrationSheet';
import { shareCardImage } from '../../lib/shareImage';

describe('MilestoneCelebrationSheet (F053)', () => {
  it('renders nothing when not visible', () => {
    const { queryByTestId } = render(
      <MilestoneCelebrationSheet visible={false} milestoneKey="checkin_10" onClose={jest.fn()} />,
    );
    expect(queryByTestId('milestone-celebration')).toBeNull();
  });

  it('renders nothing for an unknown milestone key', () => {
    const { queryByTestId } = render(
      <MilestoneCelebrationSheet visible milestoneKey="bogus_key" onClose={jest.fn()} />,
    );
    expect(queryByTestId('milestone-celebration')).toBeNull();
  });

  it('renders the celebration + share action for a known milestone', () => {
    const { getByTestId } = render(
      <MilestoneCelebrationSheet visible milestoneKey="checkin_10" onClose={jest.fn()} />,
    );
    expect(getByTestId('milestone-celebration')).toBeTruthy();
    fireEvent.press(getByTestId('milestone-share'));
    expect(shareCardImage).toHaveBeenCalled();
  });

  it('calls onClose from the close button', () => {
    const onClose = jest.fn();
    const { getByTestId } = render(
      <MilestoneCelebrationSheet visible milestoneKey="venues_10" onClose={onClose} />,
    );
    fireEvent.press(getByTestId('milestone-close'));
    expect(onClose).toHaveBeenCalled();
  });
});

// Mirrors the VenueDetailScreen stacking: the milestone celebration is held
// behind a pending key and only revealed once the success sheet dismisses.
function StackingHarness({ pendingKey }: { pendingKey: string | null }) {
  const [successVisible, setSuccessVisible] = useState(true);
  const [milestoneVisible, setMilestoneVisible] = useState(false);
  return (
    <View>
      {successVisible ? (
        <Pressable
          testID="success-dismiss"
          onPress={() => {
            setSuccessVisible(false);
            if (pendingKey) setMilestoneVisible(true);
          }}
        >
          <View />
        </Pressable>
      ) : null}
      <MilestoneCelebrationSheet
        visible={milestoneVisible}
        milestoneKey={pendingKey}
        onClose={() => setMilestoneVisible(false)}
      />
    </View>
  );
}

describe('milestone stacking after the success sheet (F053)', () => {
  it('shows the milestone celebration only AFTER the success sheet dismisses', () => {
    const { getByTestId, queryByTestId } = render(<StackingHarness pendingKey="checkin_10" />);
    // While the success sheet is up, the milestone celebration is hidden.
    expect(queryByTestId('milestone-celebration')).toBeNull();
    // Dismiss the success sheet → the milestone celebration appears (stacked).
    fireEvent.press(getByTestId('success-dismiss'));
    expect(getByTestId('milestone-celebration')).toBeTruthy();
  });

  it('shows no celebration when no milestone was crossed', () => {
    const { getByTestId, queryByTestId } = render(<StackingHarness pendingKey={null} />);
    fireEvent.press(getByTestId('success-dismiss'));
    expect(queryByTestId('milestone-celebration')).toBeNull();
  });
});
