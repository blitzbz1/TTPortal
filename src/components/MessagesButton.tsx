import React, { useCallback } from 'react';
import { StyleSheet, Text, TouchableOpacity } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { Lucide } from './Icon';
import { useI18n } from '../hooks/useI18n';
import { useSession } from '../hooks/useSession';
import { useTheme } from '../hooks/useTheme';
import { Fonts, FontWeight, Spacing } from '../theme';
import { useUnreadDmCountQuery } from '../features/messaging';

interface Props {
  color: string;
}

// F023: paper-plane Messages entry point with an unread badge, mounted beside
// the notification bell. Unread is its OWN count (NOT the bell's) — see
// get_unread_dm_count (migration 118). Refreshed on AppState/foreground + on
// a dm_message push by NotificationProvider.
export function MessagesButton({ color }: Props) {
  const router = useRouter();
  const { user } = useSession();
  const { s } = useI18n();
  const { colors } = useTheme();
  const { data: unread = 0 } = useUnreadDmCountQuery(user?.id);

  const handlePress = useCallback(() => {
    // Cast: the typed-routes manifest regenerates on `expo start`; the new
    // /messages route isn't in the checked-in types yet.
    router.push('/messages' as Href);
  }, [router]);

  if (!user) return null;

  return (
    <TouchableOpacity
      style={styles.btn}
      onPress={handlePress}
      hitSlop={{ top: 10, right: 10, bottom: 10, left: 10 }}
      accessibilityRole="button"
      accessibilityLabel={unread > 0 ? `${s('messagesTitle')}, ${unread > 9 ? '9+' : unread}` : s('messagesTitle')}
      testID="open-messages-btn"
    >
      <Lucide name="send" size={18} color={color} />
      {unread > 0 && (
        <Text style={[styles.badge, { backgroundColor: colors.red }]}>{unread > 9 ? '9+' : unread}</Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  btn: { position: 'relative', padding: Spacing.xxs },
  badge: {
    position: 'absolute',
    top: -2,
    right: -2,
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    textAlign: 'center',
    overflow: 'hidden',
    paddingHorizontal: 3,
    fontFamily: Fonts.body,
    fontSize: 9,
    lineHeight: 16,
    fontWeight: FontWeight.bold,
    color: '#fff',
  },
});
