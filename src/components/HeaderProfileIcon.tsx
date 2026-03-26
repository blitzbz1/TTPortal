import React from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { Lucide } from './Icon';
import { Colors } from '../theme';

/**
 * Auth-aware profile icon for the header.
 * Stub implementation — renders a generic user icon for anonymous users.
 * Will be expanded in T033 with authenticated state (initials circle + popover).
 */
export function HeaderProfileIcon() {
  return (
    <Pressable
      style={styles.container}
      accessibilityRole="button"
      accessibilityLabel="Profile"
      testID="header-profile-icon"
    >
      <Lucide name="user" size={24} color={Colors.inkMuted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 4,
    marginRight: 8,
  },
});
