import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { Linking } from 'react-native';
import { MapAppChooserModal } from '../MapAppChooserModal';

jest.mock('../../hooks/useI18n', () => ({
  useI18n: () => ({ s: (key: string) => key }),
}));
jest.mock('../../hooks/useTheme', () => ({
  useTheme: () => ({ colors: require('../../theme').lightColors }),
}));
jest.mock('../Icon', () => ({ Lucide: () => null }));

describe('MapAppChooserModal', () => {
  beforeEach(() => {
    jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('offers all three map apps and sends Google a named destination', () => {
    const onClose = jest.fn();
    const { getByTestId } = render(
      <MapAppChooserModal
        visible
        destination={{
          latitude: 44.439,
          longitude: 26.096,
          name: 'Parcul Ioanid',
          address: 'Bulevardul Dacia',
        }}
        onClose={onClose}
      />,
    );

    expect(getByTestId('map-app-apple')).toBeTruthy();
    expect(getByTestId('map-app-waze')).toBeTruthy();
    fireEvent.press(getByTestId('map-app-google'));

    expect(onClose).toHaveBeenCalled();
    expect(decodeURIComponent((Linking.openURL as jest.Mock).mock.calls[0][0])).toContain(
      'destination=Parcul Ioanid, Bulevardul Dacia',
    );
  });
});
