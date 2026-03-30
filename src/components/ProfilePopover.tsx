import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../hooks/useTheme';
import type { ThemeColors } from '../theme';
import { Shadows } from '../theme';
import { useSession } from '../hooks/useSession';
import { useI18n } from '../hooks/useI18n';

/** Props for ProfilePopover. */
interface ProfilePopoverProps {
  /** Whether the popover is visible. */
  visible: boolean;
  /** Callback to close the popover. */
  onClose: () => void;
}

/**
 * Profile popover displayed below the HeaderProfileIcon.
 * Shows user name, email (truncated if >25 chars), and a sign-out button.
 * Dismisses on outside tap via a Pressable overlay.
 */
export function ProfilePopover({ visible, onClose }: ProfilePopoverProps) {
  const { user, signOut } = useSession();
  const { s } = useI18n();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  if (!visible) return null;

  const fullName =
    (user?.user_metadata?.full_name as string | undefined) || 'User';
  const email = user?.email || '';
  const truncatedEmail = truncateEmail(email);

  const handleSignOut = async () => {
    await signOut();
    onClose();
  };

  return (
    <>
      <Pressable
        testID="popover-overlay"
        style={styles.overlay}
        onPress={onClose}
      />
      <View testID="profile-popover" style={styles.popover}>
        <Text testID="popover-name" style={styles.name}>
          {fullName}
        </Text>
        <Text testID="popover-email" style={styles.email}>
          {truncatedEmail}
        </Text>
        <Pressable
          testID="popover-signout"
          style={styles.signOutButton}
          onPress={handleSignOut}
        >
          <Text style={styles.signOutText}>{s('logout')}</Text>
        </Pressable>
      </View>
    </>
  );
}

/**
 * Truncate email to 25 characters with ellipsis if longer.
 * @param email - The email address to truncate
 * @returns Truncated email string
 */
function truncateEmail(email: string): string {
  if (email.length <= 25) return email;
  return email.slice(0, 25) + '...';
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    overlay: {
      position: 'absolute',
      top: -1000,
      left: -1000,
      right: -1000,
      bottom: -1000,
      zIndex: 10,
    },
    popover: {
      position: 'absolute',
      top: 40,
      right: 0,
      backgroundColor: colors.bgAlt,
      borderRadius: 10,
      padding: 16,
      minWidth: 200,
      zIndex: 11,
      ...Shadows.md,
    },
    name: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 4,
    },
    email: {
      fontSize: 13,
      color: colors.textMuted,
      marginBottom: 12,
    },
    signOutButton: {
      paddingVertical: 8,
      paddingHorizontal: 12,
      backgroundColor: colors.bgMuted,
      borderRadius: 6,
      alignItems: 'center',
    },
    signOutText: {
      fontSize: 14,
      fontWeight: '500',
      color: colors.red,
    },
  });
}
