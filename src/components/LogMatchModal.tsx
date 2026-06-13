// F002: log a match — pick the opponent, enter per-set scores, save. The
// opponent confirms before it counts (migration 105). Owns the log mutation so
// entry points stay thin.
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
import { Lucide } from './Icon';
import { useTheme } from '../hooks/useTheme';
import type { ThemeColors } from '../theme';
import { Fonts, FontSize, FontWeight, Spacing, Radius, Shadows } from '../theme';
import { useI18n } from '../hooks/useI18n';
import { hapticLight, hapticSelection } from '../lib/haptics';
import { showAlert } from '../lib/dialogs';
import { useLogMatchMutation } from '../features/matches';
import type { MatchSet } from '../features/matches';

interface OpponentOption {
  id: string;
  name: string;
}

interface Props {
  visible: boolean;
  currentUserId: string;
  /** Players the opponent can be picked from (friends / co-participants). */
  opponentOptions: OpponentOption[];
  /** When set, the opponent is fixed (e.g. opened from their profile). */
  presetOpponentId?: string | null;
  venueId?: number | null;
  eventId?: number | null;
  onClose: () => void;
  onLogged?: () => void;
}

const BEST_OF = [3, 5, 7] as const;

export function LogMatchModal({
  visible,
  currentUserId,
  opponentOptions,
  presetOpponentId,
  venueId,
  eventId,
  onClose,
  onLogged,
}: Props) {
  const { colors } = useTheme();
  const { s } = useI18n();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const logMatch = useLogMatchMutation(currentUserId);

  const [opponentId, setOpponentId] = useState<string | null>(presetOpponentId ?? null);
  const [bestOf, setBestOf] = useState<number>(5);
  const [sets, setSets] = useState<MatchSet[]>([{ a: 0, b: 0 }]);

  useEffect(() => {
    if (visible) {
      setOpponentId(presetOpponentId ?? null);
      setBestOf(5);
      setSets([{ a: 0, b: 0 }]);
    }
  }, [visible, presetOpponentId]);

  const setsWon = useMemo(() => {
    let a = 0;
    let b = 0;
    for (const set of sets) {
      if (set.a > set.b) a += 1;
      else if (set.b > set.a) b += 1;
    }
    return { a, b };
  }, [sets]);

  const winnerId =
    setsWon.a > setsWon.b ? currentUserId : setsWon.b > setsWon.a ? opponentId : null;
  const opponentName = opponentOptions.find((o) => o.id === opponentId)?.name ?? '';
  const canSave = !!opponentId && !!winnerId && !logMatch.isPending;

  const adjust = (idx: number, key: 'a' | 'b', delta: number) => {
    hapticLight();
    setSets((prev) =>
      prev.map((set, i) =>
        i === idx ? { ...set, [key]: Math.max(0, Math.min(30, set[key] + delta)) } : set,
      ),
    );
  };
  const addSet = () => {
    if (sets.length < bestOf) {
      hapticSelection();
      setSets((p) => [...p, { a: 0, b: 0 }]);
    }
  };
  const removeSet = () => {
    if (sets.length > 1) setSets((p) => p.slice(0, -1));
  };

  const submit = async () => {
    if (!opponentId || !winnerId) return;
    const playedSets = sets.filter((set) => set.a !== set.b); // drop unplayed/tied rows
    try {
      await logMatch.mutateAsync({ opponentId, sets: playedSets, winnerId, venueId, eventId });
      onLogged?.();
      onClose();
    } catch (e) {
      showAlert(s('error'), (e as Error)?.message ?? s('genericError'));
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={() => {}}>
          <View style={styles.handleWrap}>
            <View style={styles.handle} />
          </View>
          <Text style={styles.title}>{s('logMatchTitle')}</Text>

          <ScrollView showsVerticalScrollIndicator={false}>
            <Text style={styles.label}>{s('opponent')}</Text>
            {presetOpponentId ? (
              <View style={styles.presetOpponent}>
                <Lucide name="user" size={14} color={colors.primary} />
                <Text style={styles.presetOpponentText}>{opponentName || s('player')}</Text>
              </View>
            ) : opponentOptions.length === 0 ? (
              <Text style={styles.empty}>{s('logMatchNoOpponents')}</Text>
            ) : (
              <View style={styles.pills}>
                {opponentOptions.map((o) => {
                  const active = o.id === opponentId;
                  return (
                    <TouchableOpacity
                      key={o.id}
                      style={[styles.pill, active && styles.pillActive]}
                      onPress={() => {
                        hapticSelection();
                        setOpponentId(o.id);
                      }}
                      testID={`opponent-${o.id}`}
                    >
                      <Text
                        style={[styles.pillText, active && styles.pillTextActive]}
                        numberOfLines={1}
                      >
                        {o.name}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}

            <Text style={[styles.label, { marginTop: Spacing.md }]}>{s('bestOf')}</Text>
            <View style={styles.pills}>
              {BEST_OF.map((n) => {
                const active = bestOf === n;
                return (
                  <TouchableOpacity
                    key={n}
                    style={[styles.pill, active && styles.pillActive]}
                    onPress={() => {
                      hapticSelection();
                      setBestOf(n);
                      setSets((p) => p.slice(0, n));
                    }}
                    testID={`best-of-${n}`}
                  >
                    <Text style={[styles.pillText, active && styles.pillTextActive]}>{n}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <View style={styles.scoreHeader}>
              <View style={styles.setLabelSpacer} />
              <Text style={[styles.scoreHeaderText, { color: colors.primary }]}>{s('you')}</Text>
              <Text style={styles.scoreHeaderText} numberOfLines={1}>
                {opponentName || s('opponent')}
              </Text>
            </View>

            {sets.map((set, idx) => (
              <View key={idx} style={styles.setRow}>
                <Text style={styles.setLabel}>{s('setN', String(idx + 1))}</Text>
                <Stepper value={set.a} onChange={(d) => adjust(idx, 'a', d)} styles={styles} colors={colors} />
                <Stepper value={set.b} onChange={(d) => adjust(idx, 'b', d)} styles={styles} colors={colors} />
              </View>
            ))}

            <View style={styles.setActions}>
              {sets.length < bestOf && (
                <TouchableOpacity style={styles.addSetBtn} onPress={addSet} testID="add-set">
                  <Lucide name="plus" size={14} color={colors.primary} />
                  <Text style={styles.addSetText}>{s('addSet')}</Text>
                </TouchableOpacity>
              )}
              {sets.length > 1 && (
                <TouchableOpacity style={styles.addSetBtn} onPress={removeSet}>
                  <Lucide name="minus" size={14} color={colors.textMuted} />
                  <Text style={[styles.addSetText, { color: colors.textMuted }]}>
                    {s('removeSet')}
                  </Text>
                </TouchableOpacity>
              )}
            </View>

            {winnerId ? (
              <Text style={styles.winnerLine}>
                {winnerId === currentUserId
                  ? s('youWin')
                  : s('opponentWins', opponentName || s('opponent'))}{' '}
                ({setsWon.a}–{setsWon.b})
              </Text>
            ) : null}
          </ScrollView>

          <View style={styles.actions}>
            <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
              <Text style={styles.cancelText}>{s('cancel')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.saveBtn, !canSave && { opacity: 0.5 }]}
              onPress={submit}
              disabled={!canSave}
              testID="save-match"
            >
              {logMatch.isPending ? (
                <ActivityIndicator size="small" color={colors.textOnPrimary} />
              ) : (
                <Text style={styles.saveText}>{s('logMatchSave')}</Text>
              )}
            </TouchableOpacity>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function Stepper({
  value,
  onChange,
  styles,
  colors,
}: {
  value: number;
  onChange: (delta: number) => void;
  styles: ReturnType<typeof createStyles>;
  colors: ThemeColors;
}) {
  return (
    <View style={styles.stepper}>
      <TouchableOpacity style={styles.stepBtn} onPress={() => onChange(-1)} hitSlop={6}>
        <Lucide name="minus" size={16} color={colors.textMuted} />
      </TouchableOpacity>
      <Text style={styles.stepValue}>{value}</Text>
      <TouchableOpacity style={styles.stepBtn} onPress={() => onChange(1)} hitSlop={6}>
        <Lucide name="plus" size={16} color={colors.primary} />
      </TouchableOpacity>
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end', alignItems: 'center' },
    sheet: {
      backgroundColor: colors.bgAlt,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.md,
      width: '100%',
      maxWidth: 430,
      maxHeight: '85%',
      ...Shadows.lg,
    },
    handleWrap: { alignItems: 'center', paddingBottom: Spacing.sm },
    handle: { width: 36, height: 4, borderRadius: 2, backgroundColor: colors.border },
    title: { fontFamily: Fonts.heading, fontSize: FontSize.xxl, fontWeight: FontWeight.bold, color: colors.text, marginBottom: Spacing.sm },
    label: {
      fontFamily: Fonts.body,
      fontSize: FontSize.md,
      fontWeight: FontWeight.medium,
      color: colors.textMuted,
      textTransform: 'uppercase',
      letterSpacing: 1,
      marginBottom: Spacing.xs,
    },
    empty: { fontFamily: Fonts.body, fontSize: FontSize.md, color: colors.textFaint, paddingVertical: Spacing.sm },
    presetOpponent: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: Spacing.xs },
    presetOpponentText: { fontFamily: Fonts.body, fontSize: FontSize.lg, fontWeight: FontWeight.semibold, color: colors.text },
    pills: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs },
    pill: {
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.sm,
      borderRadius: Radius.full,
      backgroundColor: colors.bgMuted,
      borderWidth: 1,
      borderColor: 'transparent',
    },
    pillActive: { backgroundColor: colors.primaryPale, borderColor: colors.primary },
    pillText: { fontFamily: Fonts.body, fontSize: FontSize.md, color: colors.textMuted, maxWidth: 160 },
    pillTextActive: { color: colors.primary, fontWeight: FontWeight.semibold },
    scoreHeader: { flexDirection: 'row', alignItems: 'center', marginTop: Spacing.md, marginBottom: Spacing.xs },
    setLabelSpacer: { width: 56 },
    scoreHeaderText: { flex: 1, textAlign: 'center', fontFamily: Fonts.body, fontSize: FontSize.sm, fontWeight: FontWeight.semibold, color: colors.textMuted },
    setRow: { flexDirection: 'row', alignItems: 'center', marginBottom: Spacing.xs },
    setLabel: { width: 56, fontFamily: Fonts.body, fontSize: FontSize.sm, color: colors.textFaint },
    stepper: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm },
    stepBtn: {
      width: 32,
      height: 32,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.bgMuted,
    },
    stepValue: { minWidth: 28, textAlign: 'center', fontFamily: Fonts.heading, fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: colors.text },
    setActions: { flexDirection: 'row', gap: Spacing.md, marginTop: Spacing.xs },
    addSetBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 6 },
    addSetText: { fontFamily: Fonts.body, fontSize: FontSize.md, fontWeight: FontWeight.semibold, color: colors.primary },
    winnerLine: { marginTop: Spacing.sm, textAlign: 'center', fontFamily: Fonts.body, fontSize: FontSize.lg, fontWeight: FontWeight.semibold, color: colors.text },
    actions: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.md },
    cancelBtn: { flex: 1, alignItems: 'center', justifyContent: 'center', borderRadius: Radius.md, paddingVertical: 12, borderWidth: 1, borderColor: colors.border },
    cancelText: { fontFamily: Fonts.body, fontSize: FontSize.md, fontWeight: FontWeight.semibold, color: colors.textMuted },
    saveBtn: { flex: 1, alignItems: 'center', justifyContent: 'center', borderRadius: Radius.md, paddingVertical: 12, backgroundColor: colors.primary, ...Shadows.md },
    saveText: { fontFamily: Fonts.body, fontSize: FontSize.md, fontWeight: FontWeight.bold, color: colors.textOnPrimary },
  });
}
