import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Lucide } from '../../components/Icon';
import { SkillChip } from '../../components/SkillChip';
import { useI18n } from '../../hooks/useI18n';
import { useTheme } from '../../hooks/useTheme';
import type { ThemeColors } from '../../theme';
import { Fonts, FontSize, FontWeight, Radius, Shadows, Spacing } from '../../theme';
import type { VenueOpenPlay, WhenSlot } from '../../features/openplay';

interface Props {
  items: VenueOpenPlay[];
  busyId: number | null;
  /** Viewer can start a broadcast here (signed in, no active broadcast). */
  canPlan: boolean;
  planning: boolean;
  onJoin: (intentId: number) => void;
  onLeave: (intentId: number) => void;
  onConvert: (intentId: number) => void;
  onCancel: (intentId: number) => void;
  onPlan: (whenSlot: WhenSlot) => void;
}

const WHEN_KEY: Record<WhenSlot, string> = {
  now: 'openPlayWhenNow',
  plus_1h: 'openPlayWhenPlus1h',
  tonight: 'openPlayWhenTonight',
  tomorrow: 'openPlayWhenTomorrow',
};
const WHEN_ORDER: WhenSlot[] = ['now', 'plus_1h', 'tonight', 'tomorrow'];

export function VenueOpenPlaySection({ items, busyId, canPlan, planning, onJoin, onLeave, onConvert, onCancel, onPlan }: Props) {
  const { colors } = useTheme();
  const { s, sn } = useI18n();
  const styles = React.useMemo(() => createStyles(colors), [colors]);

  if (!items.length && !canPlan) return null;

  return (
    <View style={styles.section}>
      <View style={styles.headerRow}>
        <View style={styles.pulseDot} />
        <Text style={styles.title}>{items.length ? s('openPlayHere') : s('openPlayPlanTitle')}</Text>
      </View>

      {items.map((it) => {
        const busy = busyId === it.id;
        return (
          <View key={it.id} style={styles.card}>
            <View style={styles.topRow}>
              <View style={styles.info}>
                <Text style={styles.host} numberOfLines={1}>{it.hostName || s('user')}</Text>
                <Text style={styles.when}>
                  {s(WHEN_KEY[it.whenSlot])}
                  {it.joinCount > 0 ? ` · ${sn('openPlayInCount', it.joinCount)}` : ''}
                </Text>
                {it.note ? <Text style={styles.note} numberOfLines={2}>{it.note}</Text> : null}
              </View>
              {it.hostSkill ? <SkillChip skillLevel={it.hostSkill} /> : null}
            </View>

            <View style={styles.actions}>
              {it.isHost ? (
                <>
                  {it.joinCount >= 1 && (
                    <TouchableOpacity
                      style={styles.primaryBtn}
                      disabled={busy}
                      onPress={() => onConvert(it.id)}
                      accessibilityRole="button"
                    >
                      <Lucide name="calendar-plus" size={15} color={colors.textOnPrimary} />
                      <Text style={styles.primaryText}>{s('openPlayConvert')}</Text>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity style={styles.ghostBtn} disabled={busy} onPress={() => onCancel(it.id)}>
                    <Text style={styles.ghostText}>{s('openPlayCancel')}</Text>
                  </TouchableOpacity>
                </>
              ) : it.viewerJoined ? (
                <TouchableOpacity
                  style={styles.joinedBtn}
                  disabled={busy}
                  onPress={() => onLeave(it.id)}
                  accessibilityRole="button"
                >
                  <Lucide name="check" size={15} color={colors.primary} />
                  <Text style={styles.joinedText}>{s('openPlayJoined')}</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  style={styles.primaryBtn}
                  disabled={busy}
                  onPress={() => onJoin(it.id)}
                  accessibilityRole="button"
                  testID={`open-play-join-${it.id}`}
                >
                  <Lucide name="hand" size={15} color={colors.textOnPrimary} />
                  <Text style={styles.primaryText}>{s('openPlayJoin')}</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        );
      })}

      {canPlan && (
        <View style={styles.planBlock}>
          <Text style={styles.planLabel}>{s('openPlayPlanPrompt')}</Text>
          <View style={styles.planChips}>
            {WHEN_ORDER.map((slot) => (
              <TouchableOpacity
                key={slot}
                style={styles.planChip}
                disabled={planning}
                onPress={() => onPlan(slot)}
                accessibilityRole="button"
                testID={`open-play-plan-${slot}`}
              >
                <Text style={styles.planChipText}>{s(WHEN_KEY[slot])}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    section: { paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, gap: Spacing.sm },
    headerRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
    pulseDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: colors.primary },
    title: { fontFamily: Fonts.heading, fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: colors.text },
    card: {
      backgroundColor: colors.primaryPale,
      borderRadius: Radius.lg,
      borderWidth: 1,
      borderColor: colors.primaryDim,
      padding: Spacing.sm,
      gap: Spacing.sm,
      ...Shadows.sm,
    },
    topRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
    info: { flex: 1, gap: 2 },
    host: { fontFamily: Fonts.body, fontSize: FontSize.lg, fontWeight: FontWeight.semibold, color: colors.text },
    when: { fontFamily: Fonts.body, fontSize: FontSize.base, fontWeight: FontWeight.medium, color: colors.primaryMid },
    note: { fontFamily: Fonts.body, fontSize: FontSize.base, color: colors.textMuted },
    actions: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
    primaryBtn: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
      backgroundColor: colors.primary, borderRadius: Radius.md, paddingVertical: 9, paddingHorizontal: 16,
    },
    primaryText: { fontFamily: Fonts.body, fontSize: FontSize.md, fontWeight: FontWeight.semibold, color: colors.textOnPrimary },
    joinedBtn: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
      borderRadius: Radius.md, paddingVertical: 9, paddingHorizontal: 16,
      borderWidth: 1, borderColor: colors.primary, backgroundColor: colors.bgAlt,
    },
    joinedText: { fontFamily: Fonts.body, fontSize: FontSize.md, fontWeight: FontWeight.semibold, color: colors.primary },
    ghostBtn: { borderRadius: Radius.md, paddingVertical: 9, paddingHorizontal: 16, borderWidth: 1, borderColor: colors.borderLight },
    ghostText: { fontFamily: Fonts.body, fontSize: FontSize.md, fontWeight: FontWeight.medium, color: colors.textMuted },
    planBlock: { gap: Spacing.xs },
    planLabel: { fontFamily: Fonts.body, fontSize: FontSize.base, color: colors.textMuted },
    planChips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs },
    planChip: {
      paddingVertical: 7, paddingHorizontal: 14, borderRadius: 999,
      borderWidth: 1, borderColor: colors.primaryDim, backgroundColor: colors.primaryPale,
    },
    planChipText: { fontFamily: Fonts.body, fontSize: FontSize.base, fontWeight: FontWeight.semibold, color: colors.primaryMid },
  });
}
