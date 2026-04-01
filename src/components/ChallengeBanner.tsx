import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Lucide } from './Icon';
import { useTheme } from '../hooks/useTheme';
import type { ThemeColors } from '../theme';
import { Fonts, Radius } from '../theme';
import { useI18n } from '../hooks/useI18n';
import { useSession } from '../hooks/useSession';
import { getCurrentChallenge, getChallengeProgress } from '../lib/challenges';
import { getMonthlyStats } from '../services/challenges';

export function ChallengeBanner() {
  const { user } = useSession();
  const { s } = useI18n();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const challenge = getCurrentChallenge();
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (!user) return;
    getMonthlyStats(user.id).then((stats) => {
      setProgress(getChallengeProgress(challenge, stats));
    });
  }, [user, challenge.id]);

  if (!user) return null;

  const percentage = Math.round((progress / challenge.target) * 100);
  const completed = progress >= challenge.target;

  return (
    <View style={styles.container} testID="challenge-banner">
      <View style={styles.iconWrap}>
        <Lucide name={completed ? 'check-circle' : challenge.icon} size={18} color={completed ? colors.primaryLight : colors.accent} />
      </View>
      <View style={styles.info}>
        <Text style={styles.title}>{s(challenge.titleKey)}</Text>
        <Text style={styles.desc}>{s(challenge.descKey)}</Text>
        {/* Progress bar */}
        <View style={styles.progressBg}>
          <View style={[styles.progressFill, { width: `${percentage}%` }, completed && styles.progressComplete]} />
        </View>
      </View>
      <Text style={[styles.count, completed && styles.countComplete]}>
        {progress}/{challenge.target}
      </Text>
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.amberPale,
      borderRadius: Radius.md,
      padding: 10,
      marginHorizontal: 16,
      marginBottom: 8,
      gap: 10,
      borderWidth: 1,
      borderColor: colors.amberDeep,
    },
    iconWrap: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: colors.bgAlt,
      alignItems: 'center',
      justifyContent: 'center',
    },
    info: {
      flex: 1,
      gap: 3,
    },
    title: {
      fontFamily: Fonts.body,
      fontSize: 13,
      fontWeight: '700',
      color: colors.text,
    },
    desc: {
      fontFamily: Fonts.body,
      fontSize: 11,
      color: colors.textMuted,
    },
    progressBg: {
      height: 4,
      backgroundColor: colors.border,
      borderRadius: 2,
      marginTop: 2,
    },
    progressFill: {
      height: 4,
      backgroundColor: colors.accent,
      borderRadius: 2,
    },
    progressComplete: {
      backgroundColor: colors.primaryLight,
    },
    count: {
      fontFamily: Fonts.heading,
      fontSize: 16,
      fontWeight: '700',
      color: colors.accent,
    },
    countComplete: {
      color: colors.primaryLight,
    },
  });
}
