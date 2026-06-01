import React, { useState } from 'react';
import { TouchableOpacity, StyleSheet } from 'react-native';
import { Lucide } from './Icon';
import { useSession } from '../hooks/useSession';
import { useI18n } from '../hooks/useI18n';
import { Spacing } from '../theme';
import { UserFeedbackModal } from './UserFeedbackModal';

interface FeedbackHeaderButtonProps {
  color: string;
}

/**
 * Header icon that opens the in-app feedback modal.
 * Only renders when the user is authenticated.
 */
export function FeedbackHeaderButton({ color }: FeedbackHeaderButtonProps) {
  const { session } = useSession();
  const { s } = useI18n();
  const [open, setOpen] = useState(false);

  if (!session) return null;

  return (
    <>
      <TouchableOpacity
        style={styles.btn}
        onPress={() => setOpen(true)}
        hitSlop={{ top: 10, right: 10, bottom: 10, left: 10 }}
        accessibilityRole="button"
        accessibilityLabel={s('feedbackHeaderButton')}
        testID="header-feedback-button"
      >
        <Lucide name="clipboard-pen-line" size={18} color={color} />
      </TouchableOpacity>
      {open && <UserFeedbackModal visible onClose={() => setOpen(false)} />}
    </>
  );
}

const styles = StyleSheet.create({
  btn: {
    padding: Spacing.xxs,
  },
});
