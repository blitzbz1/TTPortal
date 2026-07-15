import { useReducedMotion as useReanimatedReducedMotion } from 'react-native-reanimated';

/**
 * Returns `true` when the device "Reduce Motion" accessibility
 * setting is enabled.  All animated components should check this
 * and fall back to instant transitions or simple fades.
 */
export function useReducedMotion(): boolean {
  return useReanimatedReducedMotion();
}
