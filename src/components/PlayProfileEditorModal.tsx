// F001: edit the self-declared play profile (skill level + play goals) from
// the Profile screen — the persistent home for what onboarding captures once.
import React, { useEffect, useMemo, useState } from 'react';
import {
  Modal,
  View,
  Text,
  Pressable,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { useTheme } from '../hooks/useTheme';
import type { ThemeColors } from '../theme';
import { Fonts, FontSize, FontWeight, Spacing, Radius, Shadows } from '../theme';
import { useI18n } from '../hooks/useI18n';
import { hapticSelection } from '../lib/haptics';
import { updateProfile } from '../services/profiles';
import {
  SKILL_LEVELS,
  PLAY_GOALS,
  skillLevelKey,
  playGoalKey,
  type SkillLevel,
  type PlayGoal,
} from '../lib/playerAttributes';

interface Props {
  visible: boolean;
  userId: string;
  initialSkill: SkillLevel | null;
  initialGoals: PlayGoal[];
  onClose: () => void;
  onSaved?: () => void;
}

export function PlayProfileEditorModal({
  visible,
  userId,
  initialSkill,
  initialGoals,
  onClose,
  onSaved,
}: Props) {
  const { colors } = useTheme();
  const { s } = useI18n();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [skill, setSkill] = useState<SkillLevel | null>(initialSkill);
  const [goals, setGoals] = useState<Set<PlayGoal>>(new Set(initialGoals));
  const [saving, setSaving] = useState(false);

  // Re-seed from the latest profile whenever the sheet (re)opens.
  useEffect(() => {
    if (visible) {
      setSkill(initialSkill);
      setGoals(new Set(initialGoals));
    }
  }, [visible, initialSkill, initialGoals]);

  const toggleGoal = (goal: PlayGoal) => {
    hapticSelection();
    setGoals((prev) => {
      const next = new Set(prev);
      if (next.has(goal)) next.delete(goal);
      else next.add(goal);
      return next;
    });
  };

  const save = async () => {
    setSaving(true);
    const { error } = await updateProfile(userId, {
      skill_level: skill,
      play_goals: Array.from(goals),
    });
    setSaving(false);
    if (!error) {
      onSaved?.();
      onClose();
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={() => {}}>
          <View style={styles.handleWrap}>
            <View style={styles.handle} />
          </View>
          <Text style={styles.title}>{s('playProfileEditTitle')}</Text>

          <ScrollView showsVerticalScrollIndicator={false}>
            <Text style={styles.label}>{s('onboardingSkillLabel')}</Text>
            <View style={styles.pills}>
              {SKILL_LEVELS.map((level) => {
                const active = skill === level;
                return (
                  <TouchableOpacity
                    key={level}
                    style={[styles.pill, active && styles.pillActive]}
                    onPress={() => {
                      hapticSelection();
                      setSkill(active ? null : level);
                    }}
                    testID={`edit-skill-${level}`}
                  >
                    <Text style={[styles.pillText, active && styles.pillTextActive]}>
                      {s(skillLevelKey(level))}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={[styles.label, { marginTop: Spacing.md }]}>{s('onboardingGoalsLabel')}</Text>
            <View style={styles.pills}>
              {PLAY_GOALS.map((goal) => {
                const active = goals.has(goal);
                return (
                  <TouchableOpacity
                    key={goal}
                    style={[styles.pill, active && styles.pillActive]}
                    onPress={() => toggleGoal(goal)}
                    testID={`edit-goal-${goal}`}
                  >
                    <Text style={[styles.pillText, active && styles.pillTextActive]}>
                      {s(playGoalKey(goal))}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </ScrollView>

          <View style={styles.actions}>
            <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
              <Text style={styles.cancelText}>{s('cancel')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.saveBtn, saving && { opacity: 0.6 }]}
              onPress={save}
              disabled={saving}
              testID="save-play-profile"
            >
              {saving ? (
                <ActivityIndicator size="small" color={colors.textOnPrimary} />
              ) : (
                <Text style={styles.saveText}>{s('save')}</Text>
              )}
            </TouchableOpacity>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.4)',
      justifyContent: 'flex-end',
      alignItems: 'center',
    },
    sheet: {
      backgroundColor: colors.bgAlt,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.md,
      width: '100%',
      maxWidth: 430,
      maxHeight: '80%',
      ...Shadows.lg,
    },
    handleWrap: { alignItems: 'center', paddingBottom: Spacing.sm },
    handle: { width: 36, height: 4, borderRadius: 2, backgroundColor: colors.border },
    title: {
      fontFamily: Fonts.heading,
      fontSize: FontSize.xxl,
      fontWeight: FontWeight.bold,
      color: colors.text,
      marginBottom: Spacing.sm,
    },
    label: {
      fontFamily: Fonts.body,
      fontSize: FontSize.md,
      fontWeight: FontWeight.medium,
      color: colors.textMuted,
      textTransform: 'uppercase',
      letterSpacing: 1,
      marginBottom: Spacing.xs,
    },
    pills: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: Spacing.xs,
    },
    pill: {
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.sm,
      borderRadius: Radius.full,
      backgroundColor: colors.bgMuted,
      borderWidth: 1,
      borderColor: 'transparent',
    },
    pillActive: {
      backgroundColor: colors.primaryPale,
      borderColor: colors.primary,
    },
    pillText: {
      fontFamily: Fonts.body,
      fontSize: FontSize.md,
      color: colors.textMuted,
    },
    pillTextActive: {
      color: colors.primary,
      fontWeight: FontWeight.semibold,
    },
    actions: {
      flexDirection: 'row',
      gap: Spacing.sm,
      marginTop: Spacing.md,
    },
    cancelBtn: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: Radius.md,
      paddingVertical: 12,
      borderWidth: 1,
      borderColor: colors.border,
    },
    cancelText: {
      fontFamily: Fonts.body,
      fontSize: FontSize.md,
      fontWeight: FontWeight.semibold,
      color: colors.textMuted,
    },
    saveBtn: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: Radius.md,
      paddingVertical: 12,
      backgroundColor: colors.primary,
      ...Shadows.md,
    },
    saveText: {
      fontFamily: Fonts.body,
      fontSize: FontSize.md,
      fontWeight: FontWeight.bold,
      color: colors.textOnPrimary,
    },
  });
}
