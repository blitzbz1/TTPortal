import React from 'react';
import { LocationWelcome } from './LocationWelcome';

interface InitialLocationSetupModalProps {
  visible: boolean;
}

export function InitialLocationSetupModal({ visible }: InitialLocationSetupModalProps) {
  return <LocationWelcome visible={visible} />;
}
