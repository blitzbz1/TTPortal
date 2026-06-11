// Cross-platform dialogs (T054). RN's Alert.alert is a silent no-op on
// web — confirms there used to "succeed" without ever asking. Native keeps
// Alert; web maps to window.alert/window.confirm. Alert imports outside
// this file are banned by ESLint (no-restricted-imports).

import { Alert, Platform } from 'react-native';

export function showAlert(title: string, message?: string): void {
  if (Platform.OS === 'web') {
    window.alert(message ? `${title}\n\n${message}` : title);
    return;
  }
  Alert.alert(title, message);
}

export interface ConfirmOptions {
  confirmLabel?: string;
  cancelLabel?: string;
  /** Styles the confirm button destructively on iOS. */
  destructive?: boolean;
}

/**
 * Confirm dialog → Promise<boolean>. Replaces the button-callback Alert
 * pattern: `if (await showConfirm(...)) { ... }`.
 */
export function showConfirm(
  title: string,
  message?: string,
  options: ConfirmOptions = {},
): Promise<boolean> {
  if (Platform.OS === 'web') {
    return Promise.resolve(window.confirm(message ? `${title}\n\n${message}` : title));
  }
  return new Promise((resolve) => {
    Alert.alert(title, message, [
      {
        text: options.cancelLabel ?? 'Cancel',
        style: 'cancel',
        onPress: () => resolve(false),
      },
      {
        text: options.confirmLabel ?? 'OK',
        style: options.destructive ? 'destructive' : 'default',
        onPress: () => resolve(true),
      },
    ], { cancelable: true, onDismiss: () => resolve(false) });
  });
}
