import React from 'react';
import { LocationSelector } from './LocationSelector';
import type { LocationCity } from '../lib/locationTypes';

interface LocationSwitcherPanelProps {
  visible: boolean;
  onClose: () => void;
  onDone?: (city: LocationCity) => void;
}

export function LocationSwitcherPanel({ visible, onClose, onDone }: LocationSwitcherPanelProps) {
  return (
    <LocationSelector
      visible={visible}
      mode="switcher"
      onClose={onClose}
      onDone={onDone}
    />
  );
}
