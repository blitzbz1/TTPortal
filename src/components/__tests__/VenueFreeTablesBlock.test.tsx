import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';

import { VenueFreeTablesBlock } from '../VenueFreeTablesBlock';

const mockUseTheme = jest.fn();
jest.mock('../../hooks/useTheme', () => ({ useTheme: () => mockUseTheme() }));

const mockS = jest.fn((key: string) => key);
jest.mock('../../hooks/useI18n', () => ({ useI18n: () => ({ s: mockS }) }));

jest.mock('../Icon', () => ({
  Lucide: ({ name, ...props }: any) => {
    const { View } = require('react-native');
    return <View testID={`icon-${name}`} {...props} />;
  },
}));

const mockColors = {
  bg: '#fff', bgAlt: '#fff', bgMuted: '#eee', text: '#111', textMuted: '#444',
  textFaint: '#999', textOnPrimary: '#fff', primary: '#14532d', primaryMid: '#166534',
  primaryLight: '#22c55e', primaryDim: '#dcfce7', primaryPale: '#f0fdf4',
};

beforeEach(() => {
  jest.clearAllMocks();
  mockUseTheme.mockReturnValue({ colors: mockColors });
  mockS.mockImplementation((key: string) => key);
});

describe('VenueFreeTablesBlock (F011)', () => {
  it('renders nothing when there is no report and the viewer cannot report', () => {
    const { toJSON } = render(<VenueFreeTablesBlock freeTables={null} canReport={false} />);
    expect(toJSON()).toBeNull();
  });

  it('shows the latest fresh report line', () => {
    const { getByTestId } = render(
      <VenueFreeTablesBlock
        freeTables={{ free_count: 1, group_size: null, reported_at: 'x', age_minutes: 12 }}
        canReport={false}
      />,
    );
    expect(getByTestId('free-tables-latest')).toBeTruthy();
  });

  it('scales option buttons to the known table count', () => {
    const { getByTestId, queryByTestId } = render(
      <VenueFreeTablesBlock canReport tablesCount={2} onReport={jest.fn()} />,
    );
    expect(getByTestId('free-tables-opt-0')).toBeTruthy();
    expect(getByTestId('free-tables-opt-2')).toBeTruthy();
    // tablesCount 2 → no "3" option.
    expect(queryByTestId('free-tables-opt-3')).toBeNull();
  });

  it('reports the chosen count + group size and shows a thanks state', async () => {
    const onReport = jest.fn().mockResolvedValue(undefined);
    const { getByTestId, queryByTestId, getByText } = render(
      <VenueFreeTablesBlock canReport tablesCount={5} onReport={onReport} />,
    );
    // Bump group size to 2, then report "1 free".
    fireEvent.press(getByTestId('free-tables-group-plus'));
    fireEvent.press(getByTestId('free-tables-group-plus'));
    fireEvent.press(getByTestId('free-tables-opt-1'));

    await waitFor(() => expect(onReport).toHaveBeenCalledWith(1, 2));
    // Prompt collapses into the thanks state.
    await waitFor(() => expect(getByText('freeTablesThanks')).toBeTruthy());
    expect(queryByTestId('free-tables-opt-1')).toBeNull();
  });

  it('keeps the prompt open if the report fails', async () => {
    const onReport = jest.fn().mockRejectedValue(new Error('rate limited'));
    const { getByTestId } = render(
      <VenueFreeTablesBlock canReport tablesCount={3} onReport={onReport} />,
    );
    fireEvent.press(getByTestId('free-tables-opt-0'));
    await waitFor(() => expect(onReport).toHaveBeenCalled());
    // Still showing the buttons (no thanks state) so the user can retry.
    expect(getByTestId('free-tables-opt-0')).toBeTruthy();
  });
});
