import React, { useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Lucide } from '../../components/Icon';
import { Card } from '../../components/Card';
import { SkillChip } from '../../components/SkillChip';
import { EmptyState } from '../../components/EmptyState';
import { useI18n } from '../../hooks/useI18n';
import { useTheme } from '../../hooks/useTheme';
import { useSession } from '../../hooks/useSession';
import { useProfileQuery } from '../../hooks/queries/useProfileQuery';
import type { ThemeColors } from '../../theme';
import { Fonts, FontSize, FontWeight, Radius, Shadows, Spacing } from '../../theme';
import { SKILL_LEVELS, skillLevelKey, type SkillLevel } from '../../lib/playerAttributes';
import {
  useFindPlayersQuery,
  usePartnerPreferencesQuery,
  useSendMatchInviteMutation,
  useSetDiscoverableMutation,
  useSetPartnerPreferencesMutation,
  type FindPlayer,
  type SoughtStyle,
} from '../../features/findPlayers';

const STYLE_FILTERS: { key: SoughtStyle; labelKey: string }[] = [
  { key: 'attacker', labelKey: 'equipmentStyleAttacker' },
  { key: 'defender', labelKey: 'equipmentStyleDefender' },
  { key: 'penholder', labelKey: 'findPlayersStylePenholder' },
  { key: 'lefty', labelKey: 'findPlayersStyleLefty' },
];
const AVAILABILITY: { key: string; labelKey: string }[] = [
  { key: 'mornings', labelKey: 'findPlayersAvailMornings' },
  { key: 'evenings', labelKey: 'findPlayersAvailEvenings' },
  { key: 'weekends', labelKey: 'findPlayersAvailWeekends' },
];

function getInitials(name?: string | null) {
  if (!name) return '?';
  return name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();
}

export function FindPlayersTab() {
  const { user } = useSession();
  const { s } = useI18n();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const { data: profile } = useProfileQuery(user?.id);
  const city = (profile as { city?: string | null } | undefined)?.city ?? null;

  const { data: prefs } = usePartnerPreferencesQuery(user?.id);
  const discoverable = !!prefs?.discoverable;
  const availability = prefs?.availability ?? [];

  const [skill, setSkill] = useState<SkillLevel | null>(null);
  const [style, setStyle] = useState<SoughtStyle | null>(null);
  const [challenged, setChallenged] = useState<Set<string>>(new Set());

  const { data: players = [], isLoading } = useFindPlayersQuery(
    user?.id,
    { city, skill, style },
    discoverable,
  );

  const setDiscoverableMut = useSetDiscoverableMutation(user?.id);
  const setPrefsMut = useSetPartnerPreferencesMutation(user?.id);
  const challengeMut = useSendMatchInviteMutation();

  const toggleAvailability = (key: string) => {
    const next = availability.includes(key)
      ? availability.filter((a) => a !== key)
      : [...availability, key];
    setPrefsMut.mutate({ availability: next });
  };

  const challenge = (p: FindPlayer) => {
    setChallenged((prev) => new Set(prev).add(p.userId));
    challengeMut.mutate(
      { inviteeId: p.userId },
      {
        onError: () => setChallenged((prev) => {
          const n = new Set(prev); n.delete(p.userId); return n;
        }),
      },
    );
  };

  const styleMeta = (p: FindPlayer) => {
    const parts: string[] = [];
    if (p.playingStyle) {
      parts.push(p.playingStyle === 'defender' ? s('equipmentStyleDefender')
        : p.playingStyle === 'all_rounder' ? s('equipmentStyleAllRounder')
        : s('equipmentStyleAttacker'));
    }
    if (p.grip) {
      parts.push(p.grip === 'penhold' ? s('equipmentGripPenhold')
        : p.grip === 'other' ? s('equipmentGripOther')
        : s('equipmentGripShakehand'));
    }
    if (p.dominantHand === 'left') parts.push(s('equipmentHandLeft'));
    return parts.join(' · ');
  };

  return (
    <View style={styles.section}>
      {/* Discoverable opt-in */}
      <View style={styles.optInCard}>
        <View style={styles.optInText}>
          <Text style={styles.optInTitle}>{s('findPlayersDiscoverableTitle')}</Text>
          <Text style={styles.optInDesc}>{s('findPlayersDiscoverableDesc')}</Text>
        </View>
        <Switch
          value={discoverable}
          onValueChange={(v) => setDiscoverableMut.mutate(v)}
          trackColor={{ true: colors.primary, false: colors.border }}
          thumbColor={colors.bgAlt}
        />
      </View>

      {!discoverable ? (
        <EmptyState
          icon="radar"
          title={s('findPlayersOptInPrompt')}
          iconColor={colors.primaryLight}
          iconBg={colors.primaryPale}
        />
      ) : (
        <>
          {/* Availability */}
          <Text style={styles.label}>{s('findPlayersAvailabilityLabel')}</Text>
          <View style={styles.chipRow}>
            {AVAILABILITY.map((a) => {
              const on = availability.includes(a.key);
              return (
                <TouchableOpacity
                  key={a.key}
                  style={[styles.chip, on && styles.chipOn]}
                  onPress={() => toggleAvailability(a.key)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: on }}
                >
                  <Text style={[styles.chipText, on && styles.chipTextOn]}>{s(a.labelKey)}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Filters */}
          <View style={styles.chipRow}>
            {SKILL_LEVELS.map((lv) => {
              const on = skill === lv;
              return (
                <TouchableOpacity
                  key={lv}
                  style={[styles.chip, on && styles.chipOn]}
                  onPress={() => setSkill(on ? null : lv)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: on }}
                >
                  <Text style={[styles.chipText, on && styles.chipTextOn]}>{s(skillLevelKey(lv))}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
          <View style={styles.chipRow}>
            {STYLE_FILTERS.map((st) => {
              const on = style === st.key;
              return (
                <TouchableOpacity
                  key={st.key}
                  style={[styles.chip, on && styles.chipOn]}
                  onPress={() => setStyle(on ? null : st.key)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: on }}
                >
                  <Text style={[styles.chipText, on && styles.chipTextOn]}>{s(st.labelKey)}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Directory */}
          {isLoading && players.length === 0 ? (
            <ActivityIndicator color={colors.primary} style={{ marginTop: 24 }} />
          ) : players.length === 0 ? (
            <EmptyState icon="users" title={s('findPlayersEmpty')} iconColor={colors.purple} iconBg={colors.purplePale} />
          ) : (
            players.map((p, index) => {
              const meta = styleMeta(p);
              const isChallenged = challenged.has(p.userId);
              return (
                <Animated.View key={p.userId} entering={FadeInDown.delay(Math.min(index, 8) * 50).duration(280)}>
                  <Card shadow="sm" borderRadius={14} style={styles.row}>
                    <View style={[styles.avatar, { backgroundColor: colors.primaryMid }]}>
                      <Text style={styles.avatarText}>{getInitials(p.fullName)}</Text>
                    </View>
                    <View style={styles.info}>
                      <View style={styles.nameRow}>
                        <Text style={styles.name} numberOfLines={1}>{p.fullName || s('user')}</Text>
                        {p.playedThisWeek ? (
                          <View style={styles.activeDot} accessibilityLabel={s('findPlayersPlayedThisWeek')} />
                        ) : null}
                      </View>
                      {meta ? <Text style={styles.meta} numberOfLines={1}>{meta}</Text> : null}
                      <View style={styles.badgeRow}>
                        {p.skillLevel ? <SkillChip skillLevel={p.skillLevel} /> : null}
                        {p.availability.map((a) => (
                          <View key={a} style={styles.availBadge}>
                            <Text style={styles.availText}>
                              {s(AVAILABILITY.find((x) => x.key === a)?.labelKey ?? a)}
                            </Text>
                          </View>
                        ))}
                      </View>
                    </View>
                    <TouchableOpacity
                      style={[styles.challengeBtn, isChallenged && styles.challengeBtnDone]}
                      disabled={isChallenged}
                      onPress={() => challenge(p)}
                      accessibilityRole="button"
                      testID={`challenge-${p.userId}`}
                    >
                      <Lucide name={isChallenged ? 'check' : 'swords'} size={14}
                        color={isChallenged ? colors.primary : colors.textOnPrimary} />
                      <Text style={[styles.challengeText, isChallenged && styles.challengeTextDone]}>
                        {isChallenged ? s('findPlayersChallengeSent') : s('findPlayersChallenge')}
                      </Text>
                    </TouchableOpacity>
                  </Card>
                </Animated.View>
              );
            })
          )}
        </>
      )}
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    section: { paddingHorizontal: Spacing.md, paddingTop: Spacing.md, paddingBottom: Spacing.xs, gap: Spacing.sm },
    optInCard: {
      flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
      backgroundColor: colors.primaryPale, borderRadius: Radius.lg, borderWidth: 1,
      borderColor: colors.primaryDim, padding: Spacing.md,
    },
    optInText: { flex: 1, gap: 2 },
    optInTitle: { fontFamily: Fonts.body, fontSize: FontSize.lg, fontWeight: FontWeight.semibold, color: colors.text },
    optInDesc: { fontFamily: Fonts.body, fontSize: FontSize.base, color: colors.textMuted },
    label: { fontFamily: Fonts.body, fontSize: FontSize.base, fontWeight: FontWeight.semibold, color: colors.textMuted, marginTop: Spacing.xs },
    chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs },
    chip: {
      paddingVertical: 6, paddingHorizontal: 13, borderRadius: 999,
      borderWidth: 1, borderColor: colors.borderLight, backgroundColor: colors.bgAlt,
    },
    chipOn: { borderColor: colors.primary, backgroundColor: colors.primaryPale },
    chipText: { fontFamily: Fonts.body, fontSize: FontSize.base, color: colors.textMuted },
    chipTextOn: { color: colors.primaryMid, fontWeight: FontWeight.semibold },
    row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: Spacing.sm, gap: Spacing.sm },
    avatar: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
    avatarText: { fontFamily: Fonts.body, fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: colors.textOnPrimary },
    info: { flex: 1, gap: 3 },
    nameRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
    name: { fontFamily: Fonts.body, fontSize: FontSize.lg, fontWeight: FontWeight.semibold, color: colors.text, flexShrink: 1 },
    activeDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primaryLight },
    meta: { fontFamily: Fonts.body, fontSize: FontSize.base, color: colors.textFaint },
    badgeRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: Spacing.xxs, marginTop: 2 },
    availBadge: { paddingVertical: 2, paddingHorizontal: 8, borderRadius: 999, backgroundColor: colors.bgMuted },
    availText: { fontFamily: Fonts.body, fontSize: FontSize.sm, color: colors.textMuted },
    challengeBtn: {
      flexDirection: 'row', alignItems: 'center', gap: 5,
      backgroundColor: colors.primary, borderRadius: Radius.md, paddingVertical: 8, paddingHorizontal: 12,
      ...Shadows.sm,
    },
    challengeBtnDone: { backgroundColor: colors.bgAlt, borderWidth: 1, borderColor: colors.primary },
    challengeText: { fontFamily: Fonts.body, fontSize: FontSize.base, fontWeight: FontWeight.semibold, color: colors.textOnPrimary },
    challengeTextDone: { color: colors.primary },
  });
}
