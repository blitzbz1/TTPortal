import React, { useState, useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Lucide } from './Icon';
import { useTheme } from '../hooks/useTheme';
import type { ThemeColors } from '../theme';
import { FontSize, FontWeight, Spacing } from '../theme';
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
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
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
          <Lucide name="user" size={24} color={colors.textMuted} />
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

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    wrapper: {
      position: 'relative',
    },
    container: {
      padding: Spacing.xxs,
      marginRight: Spacing.xs,
    },
    initialsCircle: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    initialsText: {
      color: colors.textOnPrimary,
      fontSize: FontSize.md,
      fontWeight: FontWeight.semibold,
    },
  });
}
