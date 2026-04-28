// --- Mocks (must be defined before component import) ---

jest.mock('../../hooks/useTheme', () => ({
  useTheme: () => ({
    colors: require('../../theme').lightColors,
    mode: 'light',
    resolved: 'light',
    isDark: false,
    setMode: jest.fn(),
  }),
}));
jest.mock('../../hooks/useI18n', () => ({
  useI18n: () => ({
    s: (key: string) => require('../../locales/en.json')[key] || key,
    lang: 'en' as const,
    setLang: jest.fn(),
  }),
}));
jest.mock('../../components/Icon', () => {
  const { View } = require('react-native');
  return {
    Lucide: ({ name, size, color }: { name: string; size: number; color: string }) => (
      <View
        testID={`lucide-icon-${name}`}
        accessibilityHint={`size:${size},color:${color}`}
      />
    ),
  };
});
jest.mock('../../services/venues', () => ({
  searchVenues: jest.fn().mockResolvedValue({ data: [] }),
}));
jest.mock('../../hooks/queries/useVenuesQuery', () => ({
  useVenuesQuery: () => ({ data: [], isFetching: false }),
}));

 
import React from 'react';
 
import { render, waitFor } from '@testing-library/react-native';
 
import { VenuePickerModal } from '../VenuePickerModal';

describe('VenuePickerModal i18n', () => {
  beforeEach(() => jest.clearAllMocks());

  it('renders English title when visible', async () => {
    const { getByText } = render(
      <VenuePickerModal
        visible={true}
        selectedVenueId={null}
        onSelect={jest.fn()}
        onClose={jest.fn()}
      />,
    );
    await waitFor(() => {
      expect(getByText('Choose venue')).toBeTruthy();
    });
  });

  it('renders English empty message when no venues', async () => {
    const { getByText } = render(
      <VenuePickerModal
        visible={true}
        selectedVenueId={null}
        onSelect={jest.fn()}
        onClose={jest.fn()}
      />,
    );
    await waitFor(() => {
      expect(getByText('No venues found')).toBeTruthy();
    });
  });
});
