import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';

import { VenueChangeRequestModal } from '../VenueChangeRequestModal';

const mockColors: any = {
  bg: '#fff',
  bgAlt: '#f7f7f7',
  border: '#ccc',
  text: '#000',
  textMuted: '#666',
  textFaint: '#999',
  textOnPrimary: '#fff',
  primary: '#0a0',
  primaryMid: '#0a0',
  primaryPale: '#efe',
  primaryDim: '#dfd',
  red: '#f00',
  redPale: '#fee',
};

jest.mock('../../hooks/useTheme', () => ({
  useTheme: () => ({ colors: mockColors }),
}));

jest.mock('../../hooks/useI18n', () => ({
  useI18n: () => ({ s: (key: string) => key }),
}));

jest.mock('../Icon', () => ({
  Lucide: ({ name }: { name: string }) => {
    const { View } = require('react-native');
    return <View testID={`icon-${name}`} />;
  },
}));

function setup(props: Partial<React.ComponentProps<typeof VenueChangeRequestModal>> = {}) {
  const onSubmit = jest.fn();
  const onClose = jest.fn();
  const utils = render(
    <VenueChangeRequestModal visible onClose={onClose} onSubmit={onSubmit} {...props} />,
  );
  return { onSubmit, onClose, ...utils };
}

describe('VenueChangeRequestModal', () => {
  it('renders the title and submit button', () => {
    const { getByText, getByTestId } = setup();
    expect(getByText('vcrTitle')).toBeTruthy();
    expect(getByTestId('vcr-submit')).toBeTruthy();
  });

  it('does not submit when no change is proposed', () => {
    const { getByTestId, onSubmit } = setup();
    fireEvent.press(getByTestId('vcr-submit'));
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('submits a nets change with the right payload', () => {
    const { getByTestId, onSubmit } = setup();
    fireEvent.press(getByTestId('vcr-nets-true'));
    fireEvent.press(getByTestId('vcr-submit'));
    expect(onSubmit).toHaveBeenCalledWith({
      nets: true,
      nightLighting: null,
      tablesCount: null,
      markUnavailable: false,
      note: null,
    });
  });

  it('submits a tables count and the unavailable flag', () => {
    const { getByTestId, onSubmit } = setup();
    fireEvent.changeText(getByTestId('vcr-tables-input'), '4');
    fireEvent.press(getByTestId('vcr-unavailable'));
    fireEvent.press(getByTestId('vcr-submit'));
    expect(onSubmit).toHaveBeenCalledWith({
      nets: null,
      nightLighting: null,
      tablesCount: 4,
      markUnavailable: true,
      note: null,
    });
  });

  it('ignores an invalid tables count (stays disabled)', () => {
    const { getByTestId, onSubmit } = setup();
    fireEvent.changeText(getByTestId('vcr-tables-input'), 'ab');
    fireEvent.press(getByTestId('vcr-submit'));
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('trims the note into the payload', () => {
    const { getByTestId, onSubmit } = setup();
    fireEvent.press(getByTestId('vcr-lighting-false'));
    fireEvent.changeText(getByTestId('vcr-note-input'), '   gone now   ');
    fireEvent.press(getByTestId('vcr-submit'));
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ nightLighting: false, note: 'gone now' }),
    );
  });

  it('closes via the close button without submitting', () => {
    const { getByTestId, onClose, onSubmit } = setup();
    fireEvent.press(getByTestId('vcr-modal-close'));
    expect(onClose).toHaveBeenCalled();
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
