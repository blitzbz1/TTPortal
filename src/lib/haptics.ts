import { Platform } from 'react-native';

/** Lightweight wrapper around expo-haptics that no-ops on web. */

let Haptics: typeof import('expo-haptics') | null = null;

if (Platform.OS !== 'web') {
  try {
    Haptics = require('expo-haptics');
  } catch {
    // expo-haptics not available — running on web or not installed
  }
}

export function hapticLight() {
  Haptics?.impactAsync(Haptics.ImpactFeedbackStyle.Light);
}

export function hapticMedium() {
  Haptics?.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
}

export function hapticSuccess() {
  Haptics?.notificationAsync(Haptics.NotificationFeedbackType.Success);
}

export function hapticSelection() {
  Haptics?.selectionAsync();
}

export function hapticError() {
  Haptics?.notificationAsync(Haptics.NotificationFeedbackType.Error);
}

export function hapticHeavy() {
  Haptics?.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
}
