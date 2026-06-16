// F032: tournament bracket UI for event_type='tournament'. Organizer seeds the
// bracket + reports per-tile results (which advance the bracket and feed the
// matches/ratings layer); participants see their path + the podium on completion.
import React, { useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Lucide } from '../../components/Icon';
import { showAlert } from '../../lib/dialogs';
import { useI18n } from '../../hooks/useI18n';
import { useTheme } from '../../hooks/useTheme';
import type { ThemeColors } from '../../theme';
import { Fonts, FontSize, FontWeight, Radius, Shadows, Spacing } from '../../theme';
import type { MatchSet } from '../../services/matches';
import { useCreateBracketMutation, useReportSlotMutation, useTournamentBracketQuery } from './hooks/useTournament';
import type { BracketSlot } from './types';

interface Props {
  eventId: number;
  isOrganizer: boolean;
  participantCount: number;
  currentUserId: string | null;
}

function roundLabel(round: number, totalRounds: number, s: (k: string, ...a: string[]) => string): string {
  const fromEnd = totalRounds - round; // 0 = final
  if (fromEnd === 0) return s('tournamentRoundFinal');
  if (fromEnd === 1) return s('tournamentRoundSemi');
  if (fromEnd === 2) return s('tournamentRoundQuarter');
  return s('tournamentRound', String(round));
}

export function TournamentSection({ eventId, isOrganizer, participantCount, currentUserId }: Props) {
  const { colors } = useTheme();
  const { s } = useI18n();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { data: bracket } = useTournamentBracketQuery(eventId);
  const createMut = useCreateBracketMutation(eventId);
  const reportMut = useReportSlotMutation(eventId);
  const [scoreSlot, setScoreSlot] = useState<BracketSlot | null>(null);

  const rounds = useMemo(() => {
    const map = new Map<number, BracketSlot[]>();
    for (const sl of bracket?.slots ?? []) {
      const arr = map.get(sl.round) ?? [];
      arr.push(sl);
      map.set(sl.round, arr);
    }
    return [...map.keys()].sort((a, b) => a - b).map((r) => (map.get(r) as BracketSlot[]).sort((a, b) => a.position - b.position));
  }, [bracket]);

  const handleSetup = () => {
    if (participantCount < 2) { showAlert(s('error'), s('tournamentNeedTwo')); return; }
    createMut.mutate(undefined, { onError: (e) => showAlert(s('error'), (e as Error).message || s('genericError')) });
  };

  const name = (id: string | null, nm: string | null) =>
    id == null ? s('tournamentBye') : id === currentUserId ? s('you') : (nm || s('player'));

  // ── not seeded yet ──
  if (!bracket) {
    return (
      <View style={styles.section}>
        <View style={styles.header}>
          <Lucide name="trophy" size={16} color={colors.accent} />
          <Text style={styles.title}>{s('tournamentBracket')}</Text>
        </View>
        {isOrganizer ? (
          <TouchableOpacity style={styles.setupBtn} disabled={createMut.isPending} onPress={handleSetup} testID="tournament-setup">
            <Lucide name="trophy" size={16} color={colors.textOnPrimary} />
            <Text style={styles.setupText}>{s('tournamentSetUp')}</Text>
          </TouchableOpacity>
        ) : (
          <Text style={styles.empty}>{s('tournamentNotStarted')}</Text>
        )}
      </View>
    );
  }

  const totalRounds = rounds.length;
  return (
    <View style={styles.section}>
      <View style={styles.header}>
        <Lucide name="trophy" size={16} color={colors.accent} />
        <Text style={styles.title}>{s('tournamentBracket')}</Text>
      </View>

      {bracket.status === 'complete' && bracket.championName ? (
        <View style={styles.podium} testID="tournament-podium">
          <Lucide name="crown" size={22} color={colors.accent} />
          <Text style={styles.podiumLabel}>{s('tournamentChampion')}</Text>
          <Text style={styles.podiumName}>{bracket.championName}</Text>
        </View>
      ) : null}

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.rail}>
        {rounds.map((slots, ri) => (
          <View key={ri} style={styles.roundCol}>
            <Text style={styles.roundLabel}>{roundLabel(ri + 1, totalRounds, s)}</Text>
            {slots.map((slot) => {
              const ready = isOrganizer && !slot.winnerId && !!slot.playerA && !!slot.playerB;
              return (
                <TouchableOpacity
                  key={slot.slotId}
                  activeOpacity={ready ? 0.7 : 1}
                  disabled={!ready}
                  onPress={() => setScoreSlot(slot)}
                  style={styles.tile}
                  testID={`bracket-slot-${slot.slotId}`}
                >
                  <PlayerRow label={name(slot.playerA, slot.playerAName)} won={slot.winnerId != null && slot.winnerId === slot.playerA} styles={styles} />
                  <View style={styles.tileDivider} />
                  <PlayerRow label={name(slot.playerB, slot.playerBName)} won={slot.winnerId != null && slot.winnerId === slot.playerB} styles={styles} />
                  {ready ? <Text style={styles.tileCta}>{s('tournamentReport')}</Text> : null}
                </TouchableOpacity>
              );
            })}
          </View>
        ))}
      </ScrollView>

      <ScoreEntryModal
        slot={scoreSlot}
        nameOf={name}
        busy={reportMut.isPending}
        onClose={() => setScoreSlot(null)}
        onSubmit={(winnerId, sets) =>
          reportMut.mutate({ slotId: scoreSlot!.slotId, winnerId, sets }, {
            onSuccess: () => setScoreSlot(null),
            onError: (e) => showAlert(s('error'), (e as Error).message || s('genericError')),
          })}
      />
    </View>
  );
}

function PlayerRow({ label, won, styles }: { label: string; won: boolean; styles: ReturnType<typeof createStyles> }) {
  return (
    <View style={styles.playerRow}>
      <Text style={[styles.playerName, won && styles.playerNameWon]} numberOfLines={1}>{label}</Text>
      {won ? <Lucide name="check" size={13} color={styles._winColor.color} /> : null}
    </View>
  );
}

// Minimal best-of-3 score entry (mirrors LogMatchModal's stepper). winner is
// derived from set tallies; the organizer is authoritative.
function ScoreEntryModal({
  slot, nameOf, busy, onClose, onSubmit,
}: {
  slot: BracketSlot | null;
  nameOf: (id: string | null, nm: string | null) => string;
  busy: boolean;
  onClose: () => void;
  onSubmit: (winnerId: string, sets: MatchSet[]) => void;
}) {
  const { colors } = useTheme();
  const { s } = useI18n();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [sets, setSets] = useState<MatchSet[]>([{ a: 0, b: 0 }, { a: 0, b: 0 }, { a: 0, b: 0 }]);

  React.useEffect(() => {
    if (slot) setSets([{ a: 0, b: 0 }, { a: 0, b: 0 }, { a: 0, b: 0 }]);
  }, [slot]);

  if (!slot) return null;

  const played = sets.filter((st) => st.a !== st.b);
  const setsA = played.filter((st) => st.a > st.b).length;
  const setsB = played.filter((st) => st.b > st.a).length;
  const winnerId = setsA > setsB ? slot.playerA : setsB > setsA ? slot.playerB : null;
  const canSave = !!winnerId && !busy;

  const bump = (i: number, side: 'a' | 'b', d: number) =>
    setSets((prev) => prev.map((st, j) => (j === i ? { ...st, [side]: Math.max(0, Math.min(30, st[side] + d)) } : st)));

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={() => {}}>
          <Text style={styles.sheetTitle}>{s('tournamentReport')}</Text>
          <View style={styles.scoreHeader}>
            <Text style={styles.scoreName} numberOfLines={1}>{nameOf(slot.playerA, slot.playerAName)}</Text>
            <Text style={styles.scoreVs}>vs</Text>
            <Text style={[styles.scoreName, { textAlign: 'right' }]} numberOfLines={1}>{nameOf(slot.playerB, slot.playerBName)}</Text>
          </View>
          {sets.map((st, i) => (
            <View key={i} style={styles.setRow}>
              <Stepper value={st.a} onMinus={() => bump(i, 'a', -1)} onPlus={() => bump(i, 'a', 1)} styles={styles} />
              <Text style={styles.setLabel}>{s('tournamentSet', String(i + 1))}</Text>
              <Stepper value={st.b} onMinus={() => bump(i, 'b', -1)} onPlus={() => bump(i, 'b', 1)} styles={styles} />
            </View>
          ))}
          <View style={styles.sheetActions}>
            <TouchableOpacity style={styles.cancelBtn} onPress={onClose}><Text style={styles.cancelText}>{s('cancel')}</Text></TouchableOpacity>
            <TouchableOpacity style={[styles.saveBtn, !canSave && { opacity: 0.5 }]} disabled={!canSave} onPress={() => onSubmit(winnerId as string, played)} testID="bracket-score-save">
              <Text style={styles.saveText}>{s('confirm')}</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function Stepper({ value, onMinus, onPlus, styles }: { value: number; onMinus: () => void; onPlus: () => void; styles: ReturnType<typeof createStyles> }) {
  return (
    <View style={styles.stepper}>
      <TouchableOpacity style={styles.stepBtn} onPress={onMinus}><Lucide name="minus" size={16} color={styles._winColor.color} /></TouchableOpacity>
      <Text style={styles.stepVal}>{value}</Text>
      <TouchableOpacity style={styles.stepBtn} onPress={onPlus}><Lucide name="plus" size={16} color={styles._winColor.color} /></TouchableOpacity>
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    _winColor: { color: colors.primary },
    section: { paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, gap: Spacing.sm },
    header: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    title: { fontFamily: Fonts.heading, fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: colors.text },
    empty: { fontFamily: Fonts.body, fontSize: FontSize.base, color: colors.textFaint },
    setupBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: colors.primary, borderRadius: Radius.md, paddingVertical: 11 },
    setupText: { fontFamily: Fonts.body, fontSize: FontSize.md, fontWeight: FontWeight.semibold, color: colors.textOnPrimary },
    podium: { alignItems: 'center', gap: 2, backgroundColor: colors.amberPale, borderRadius: Radius.lg, paddingVertical: Spacing.md },
    podiumLabel: { fontFamily: Fonts.body, fontSize: FontSize.sm, color: colors.accent, fontWeight: FontWeight.semibold },
    podiumName: { fontFamily: Fonts.heading, fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: colors.text },
    rail: { gap: Spacing.md, paddingVertical: Spacing.xs },
    roundCol: { gap: Spacing.sm, justifyContent: 'space-around', minWidth: 150 },
    roundLabel: { fontFamily: Fonts.body, fontSize: FontSize.sm, fontWeight: FontWeight.semibold, color: colors.textMuted, textAlign: 'center' },
    tile: { backgroundColor: colors.bgAlt, borderRadius: 10, borderWidth: 1, borderColor: colors.borderLight, paddingVertical: 6, paddingHorizontal: 10, ...Shadows.sm },
    tileDivider: { height: 1, backgroundColor: colors.border, marginVertical: 4 },
    playerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 6 },
    playerName: { fontFamily: Fonts.body, fontSize: FontSize.base, color: colors.textMuted, flexShrink: 1 },
    playerNameWon: { color: colors.text, fontWeight: FontWeight.bold },
    tileCta: { fontFamily: Fonts.body, fontSize: FontSize.sm, color: colors.primary, fontWeight: FontWeight.semibold, marginTop: 4, textAlign: 'center' },
    overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
    sheet: { backgroundColor: colors.bgAlt, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: Spacing.lg, gap: Spacing.md, ...Shadows.lg },
    sheetTitle: { fontFamily: Fonts.heading, fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: colors.text, textAlign: 'center' },
    scoreHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
    scoreName: { flex: 1, fontFamily: Fonts.body, fontSize: FontSize.md, fontWeight: FontWeight.semibold, color: colors.text },
    scoreVs: { fontFamily: Fonts.body, fontSize: FontSize.base, color: colors.textFaint },
    setRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    setLabel: { fontFamily: Fonts.body, fontSize: FontSize.sm, color: colors.textMuted },
    stepper: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    stepBtn: { width: 32, height: 32, borderRadius: 16, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
    stepVal: { fontFamily: Fonts.heading, fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: colors.text, minWidth: 24, textAlign: 'center' },
    sheetActions: { flexDirection: 'row', gap: Spacing.sm },
    cancelBtn: { flex: 1, alignItems: 'center', paddingVertical: 12, borderRadius: Radius.md, borderWidth: 1, borderColor: colors.border },
    cancelText: { fontFamily: Fonts.body, fontSize: FontSize.md, fontWeight: FontWeight.semibold, color: colors.textMuted },
    saveBtn: { flex: 1, alignItems: 'center', paddingVertical: 12, borderRadius: Radius.md, backgroundColor: colors.primary },
    saveText: { fontFamily: Fonts.body, fontSize: FontSize.md, fontWeight: FontWeight.semibold, color: colors.textOnPrimary },
  });
}
