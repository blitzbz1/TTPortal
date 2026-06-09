import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';

import { PhotoPickerButton } from '../PhotoPickerButton';

jest.mock('../../hooks/useTheme', () => ({
  useTheme: () => ({ colors: { border: '#ccc', textFaint: '#999' } }),
}));

jest.mock('../Icon', () => ({
  Lucide: ({ name }: { name: string }) => {
    const { View } = require('react-native');
    return <View testID={`icon-${name}`} />;
  },
}));

jest.mock('expo-image', () => ({
  Image: () => {
    const { View } = require('react-native');
    return <View testID="thumb" />;
  },
}));

describe('PhotoPickerButton', () => {
  it('shows the camera icon + add label when empty', () => {
    const { getByText, getByTestId, queryByTestId } = render(
      <PhotoPickerButton photoUri={null} onPress={jest.fn()} addLabel="Add photo" changeLabel="Change photo" />,
    );
    expect(getByText('Add photo')).toBeTruthy();
    expect(getByTestId('icon-camera')).toBeTruthy();
    expect(queryByTestId('thumb')).toBeNull();
  });

  it('shows a thumbnail + change label once a photo is set', () => {
    const { getByText, getByTestId, queryByTestId } = render(
      <PhotoPickerButton photoUri="file:///p.jpg" onPress={jest.fn()} addLabel="Add photo" changeLabel="Change photo" />,
    );
    expect(getByText('Change photo')).toBeTruthy();
    expect(getByTestId('thumb')).toBeTruthy();
    expect(queryByTestId('icon-camera')).toBeNull();
  });

  it('calls onPress when tapped', () => {
    const onPress = jest.fn();
    const { getByTestId } = render(
      <PhotoPickerButton photoUri={null} onPress={onPress} addLabel="Add photo" changeLabel="Change photo" testID="pick" />,
    );
    fireEvent.press(getByTestId('pick'));
    expect(onPress).toHaveBeenCalled();
  });
});
