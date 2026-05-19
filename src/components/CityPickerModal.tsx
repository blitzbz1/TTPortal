import React from 'react';
import { LocationSwitcherPanel } from './LocationSwitcherPanel';
import type { LocationCity } from '../lib/locationTypes';

interface CityPickerModalProps {
  visible: boolean;
  selectedCity: string | null;
  selectedCityId?: number | null;
  onSelect: (city: string | null) => void;
  onSelectCity?: (city: LocationCity | null) => void;
  onClose: () => void;
}

export function CityPickerModal({
  visible,
  onSelect,
  onSelectCity,
  onClose,
}: CityPickerModalProps) {
  return (
    <LocationSwitcherPanel
      visible={visible}
      onClose={onClose}
      onDone={(city) => {
        onSelectCity?.(city);
        onSelect(city.name);
      }}
    />
  );
}
