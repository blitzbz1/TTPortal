import React from 'react';
import { Text } from 'react-native';
import { render } from '@testing-library/react-native';

jest.mock('../../hooks/useTheme', () => ({
  useTheme: () => ({
    colors: require('../../theme').lightColors,
  }),
}));

import { DraggableSheet } from '../DraggableSheet';

describe('DraggableSheet', () => {
  it('renders with testID', () => {
    const { getByTestId } = render(
      <DraggableSheet><Text>Content</Text></DraggableSheet>,
    );
    expect(getByTestId('draggable-sheet')).toBeTruthy();
  });

  it('renders children', () => {
    const { getByText } = render(
      <DraggableSheet><Text>Venue List</Text></DraggableSheet>,
    );
    expect(getByText('Venue List')).toBeTruthy();
  });

  it('renders the drag handle', () => {
    const { getByTestId } = render(
      <DraggableSheet><Text>Content</Text></DraggableSheet>,
    );
    const sheet = getByTestId('draggable-sheet');
    // The handle area is the first child of the sheet
    expect(sheet.children.length).toBeGreaterThanOrEqual(2);
  });
});
