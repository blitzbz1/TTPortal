import React from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';

jest.mock('react-native-maps', () => {
  const { View } = require('react-native');
  return {
    __esModule: true,
    default: (props: any) => <View testID="address-picker-map" {...props} />,
    Marker: (props: any) => <View testID="address-picker-marker" {...props} />,
  };
});

jest.mock('../../hooks/useTheme', () => ({
  useTheme: () => ({
    colors: require('../../theme').lightColors,
    isDark: false,
  }),
}));

jest.mock('../../hooks/useI18n', () => ({
  useI18n: () => ({
    lang: 'en',
    s: (key: string) => {
      const strings = require('../../locales/en.json');
      return strings[key] || key;
    },
  }),
}));

import { AddressPickerField } from '../AddressPickerField';

const fetchMock = jest.fn(async () => ({ ok: true, json: async () => [] }));
(global as { fetch: unknown }).fetch = fetchMock;

const baseProps = {
  address: 'Strada Exemplu 12',
  city: 'Cluj-Napoca',
  knownCities: ['Cluj-Napoca'],
  knownCityRecords: [],
  onChange: jest.fn(),
};

describe('AddressPickerField (shared shell + platform map child)', () => {
  beforeEach(() => jest.clearAllMocks());

  it('renders the input + geocode button without a map when no location is set', () => {
    const { getByTestId, queryByTestId } = render(
      <AddressPickerField {...baseProps} lat={null} lng={null} />,
    );
    expect(getByTestId('address-input').props.value).toBe('Strada Exemplu 12');
    expect(getByTestId('address-geocode-btn')).toBeTruthy();
    expect(queryByTestId('address-picker-map')).toBeNull();
  });

  it('renders the mini-map with a draggable marker once a location is set', () => {
    const { getByTestId } = render(
      <AddressPickerField {...baseProps} lat={46.77} lng={23.62} />,
    );
    expect(getByTestId('address-picker-map').props.initialRegion).toMatchObject({
      latitude: 46.77,
      longitude: 23.62,
    });
    const marker = getByTestId('address-picker-marker');
    expect(marker.props.draggable).toBe(true);
    expect(marker.props.coordinate).toEqual({ latitude: 46.77, longitude: 23.62 });
  });

  it('patches coords through onChange when the marker is dragged', async () => {
    const onChange = jest.fn();
    const { getByTestId } = render(
      <AddressPickerField {...baseProps} onChange={onChange} lat={46.77} lng={23.62} />,
    );
    fireEvent(getByTestId('address-picker-marker'), 'dragEnd', {
      nativeEvent: { coordinate: { latitude: 46.75, longitude: 23.61 } },
    });
    // Let the reverse-geocode fetch kicked off by the drag settle.
    await act(async () => {});
    expect(onChange).toHaveBeenCalledWith({ lat: 46.75, lng: 23.61 });
  });

  it('forwards typed text through onChange', () => {
    const onChange = jest.fn();
    const { getByTestId } = render(
      <AddressPickerField {...baseProps} onChange={onChange} lat={null} lng={null} />,
    );
    fireEvent.changeText(getByTestId('address-input'), 'Bd');
    expect(onChange).toHaveBeenCalledWith({ address: 'Bd' });
  });

  it('disables editing when disabled', () => {
    const { getByTestId } = render(
      <AddressPickerField {...baseProps} disabled lat={null} lng={null} />,
    );
    expect(getByTestId('address-input').props.editable).toBe(false);
  });
});
