import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Lucide } from './Icon';
import { Colors } from '../theme';
import { useSession } from '../hooks/useSession';
import { ProfilePopover } from './ProfilePopover';

/**
 * Auth-aware profile icon for the header.
 * When anonymous: renders a generic user icon; tap navigates to /sign-in.
 * When authenticated: renders a 32px circle with user initials; tap toggles a profile popover.
 */
export function HeaderProfileIcon() {
  const { session, user } = useSession();
  const router = useRouter();
  const [popoverVisible, setPopoverVisible] = useState(false);

  const isAuthenticated = !!session;

  const handlePress = () => {
    if (!isAuthenticated) {
      router.push('/sign-in');
      return;
    }
    setPopoverVisible((prev) => !prev);
  };

  const fullName = user?.user_metadata?.full_name as string | undefined;
  const initials = getInitials(fullName);

  return (
    <View style={styles.wrapper}>
      <Pressable
        style={styles.container}
        accessibilityRole="button"
        accessibilityLabel="Profile"
        testID="header-profile-icon"
        onPress={handlePress}
      >
        {isAuthenticated ? (
          <View testID="initials-circle" style={styles.initialsCircle}>
            <Text testID="initials-text" style={styles.initialsText}>
              {initials}
            </Text>
          </View>
        ) : (
          <Lucide name="user" size={24} color={Colors.inkMuted} />
        )}
      </Pressable>
      {isAuthenticated && (
        <ProfilePopover
          visible={popoverVisible}
          onClose={() => setPopoverVisible(false)}
        />
      )}
    </View>
  );
}

/**
 * Extract initials from a full name (first letter of first + last name).
 * @param fullName - The user's full name
 * @returns Uppercase initials string (e.g., "IP" for "Ion Popescu")
 */
function getInitials(fullName?: string): string {
  if (!fullName) return '?';
  const parts = fullName.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? '';
  const last = parts.length > 1 ? parts[parts.length - 1]![0] ?? '' : '';
  return (first + last).toUpperCase();
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'relative',
  },
  container: {
    padding: 4,
    marginRight: 8,
  },
  initialsCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.green,
    alignItems: 'center',
    justifyContent: 'center',
  },
  initialsText: {
    color: Colors.white,
    fontSize: 13,
    fontWeight: '600',
  },
});
