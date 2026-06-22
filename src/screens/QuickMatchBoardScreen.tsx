// Quick Match — the live scoreboard. The app is portrait-locked, so we render a
// landscape board and rotate it 90° to fill the screen (turn the phone to read
// it upright) — no native orientation module needed. Tap a player's side to add
// a point; tap their "Undo point" strip to take one back. Games & the match
// resolve automatically (see features/quickMatch).
import React, { useMemo, useState } from 'react';
import { View, Text, Pressable, useWindowDimensions, StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Lucide } from '../components/Icon';
import { useTheme } from '../hooks/useTheme';
import { useI18n } from '../hooks/useI18n';
import { hapticLight } from '../lib/haptics';
import { showConfirm } from '../lib/dialogs';
import type { ThemeColors } from '../theme';
import { Fonts, FontWeight } from '../theme';
import {
  createMatch, scorePoint, undoPoint, serverFor, gamesToWin,
  type MatchState, type Points, type BestOf, type PlayerIndex,
} from '../features/quickMatch';

const asPoints = (v: unknown): Points => (String(v) === '21' ? 21 : 11);
const asBestOf = (v: unknown): BestOf => (String(v) === '3' ? 3 : String(v) === '7' ? 7 : 5);

export function QuickMatchBoardScreen() {
  const router = useRouter();
  const { s } = useI18n();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { width, height } = useWindowDimensions();

  const params = useLocalSearchParams<{ points?: string; bestOf?: string; n0?: string; n1?: string; server?: string }>();
  const [match, setMatch] = useState<MatchState>(() =>
    createMatch({
      points: asPoints(params.points),
      bestOf: asBestOf(params.bestOf),
      names: [params.n0 || s('qmYou'), params.n1 || s('qmOpponent')],
      firstServer: params.server === '1' ? 1 : 0,
    }),
  );

  const { config } = match;
  const need = gamesToWin(config.bestOf);
  const server: PlayerIndex | null = match.winner === null
    ? serverFor(match.game[0], match.game[1], config.points, match.gameFirstServer)
    : null;
  const gameNo = match.completed.length + 1;

  const onScore = (p: PlayerIndex) => { if (match.winner === null) { hapticLight(); setMatch((m) => scorePoint(m, p)); } };
  const onUndo = (p: PlayerIndex) => { hapticLight(); setMatch((m) => undoPoint(m, p)); };
  // Leaving the match returns to where the flow launched (the Profile tab).
  // dismissAll pops the board AND the setup screen pushed beneath it in one step;
  // a plain router.back() would strand the user back on the match-settings screen.
  const leave = () => { if (router.canDismiss()) router.dismissAll(); else router.back(); };
  const exit = async () => {
    const inPlay = match.winner === null && (match.game[0] || match.game[1] || match.games[0] || match.games[1]);
    if (inPlay) {
      if (await showConfirm(s('qmLeaveTitle'), s('qmLeaveBody'), { confirmLabel: s('qmLeave'), cancelLabel: s('cancel'), destructive: true })) leave();
    } else {
      leave();
    }
  };

  // Landscape geometry: lay the board out W×H, then rotate it into the portrait screen.
  const W = height, H = width;

  const half = (p: PlayerIndex) => {
    const left = p === 0;
    const accent = left ? colors.primaryLight : colors.accentBright;
    return (
      <View style={[styles.half, left ? styles.halfLeft : styles.halfRight, server === p && (left ? styles.servingLeft : styles.servingRight)]}>
        <Pressable style={styles.plus} onPress={() => onScore(p)} testID={`qm-score-${p}`}>
          <View style={styles.who}>
            <Text style={[styles.pname, { color: accent }]} numberOfLines={1}>{config.names[p]}</Text>
            <View style={styles.pips}>
              {Array.from({ length: need }, (_, i) => (
                <View key={i} style={[styles.pip, i < match.games[p] && { backgroundColor: accent }]} />
              ))}
            </View>
            {server === p ? (
              <View style={styles.serveTag}>
                <View style={[styles.serveBall, { backgroundColor: accent }]} />
                <Text style={[styles.serveTagText, { color: accent }]}>{s('qmServing')}</Text>
              </View>
            ) : <View style={{ height: 12 }} />}
          </View>
          <View style={styles.scoreWrap}>
            <Text style={styles.score} numberOfLines={1} adjustsFontSizeToFit>{match.game[p]}</Text>
          </View>
        </Pressable>
        <Pressable style={styles.undo} onPress={() => onUndo(p)} testID={`qm-undo-${p}`}>
          <Lucide name="minus" size={18} color={colors.textMuted} />
          <Text style={styles.undoText}>{s('qmUndoPoint')}</Text>
        </Pressable>
      </View>
    );
  };

  return (
    <View style={styles.root}>
      <StatusBar hidden />
      <View style={[styles.rotor, { width: W, height: H, left: (width - W) / 2, top: (height - H) / 2 }]}>
        <View style={styles.split}>
          {half(0)}
          {half(1)}
        </View>

        {/* center console */}
        <View style={styles.console} pointerEvents="none">
          <Text style={styles.games}>
            <Text style={{ color: colors.primaryLight }}>{match.games[0]}</Text>
            <Text style={{ color: colors.textFaint }}> – </Text>
            <Text style={{ color: colors.accentBright }}>{match.games[1]}</Text>
          </Text>
          <Text style={styles.meta}>{match.winner === null ? s('qmGame', String(gameNo)) : s('qmFinal')}</Text>
        </View>

        {/* exit + format */}
        <Pressable style={styles.exit} onPress={exit} testID="qm-exit">
          <Lucide name="x" size={15} color="#fff" />
        </Pressable>
        <Text style={styles.fmt}>{s('qmFormat', String(config.points), String(config.bestOf))}</Text>

        {/* winner overlay */}
        {match.winner !== null ? (
          <View style={styles.winWrap}>
            <View style={styles.winCard}>
              <Lucide name="trophy" size={30} color={colors.amber} />
              <Text style={styles.winName}>{s('qmWins', config.names[match.winner])}</Text>
              <Text style={styles.winScore}>{match.completed.map((g) => `${g[0]}–${g[1]}`).join('  ·  ')}</Text>
              <View style={styles.winBtns}>
                <Pressable style={[styles.winBtn, styles.winGhost]} onPress={leave} testID="qm-done">
                  <Text style={styles.winGhostText}>{s('qmDone')}</Text>
                </Pressable>
                <Pressable style={[styles.winBtn, styles.winPrimary]} onPress={() => setMatch(createMatch(config))} testID="qm-rematch">
                  <Text style={styles.winPrimaryText}>{s('qmRematch')}</Text>
                </Pressable>
              </View>
            </View>
          </View>
        ) : null}
      </View>
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: '#000' },
    rotor: { position: 'absolute', transform: [{ rotate: '90deg' }] },
    split: { flex: 1, flexDirection: 'row' },
    half: { flex: 1, position: 'relative' },
    halfLeft: { backgroundColor: '#0e1f15' },
    halfRight: { backgroundColor: '#1f1107' },
    servingLeft: { borderLeftWidth: 5, borderLeftColor: colors.primary },
    servingRight: { borderRightWidth: 5, borderRightColor: colors.accentBright },
    plus: { flex: 1, alignItems: 'center' },
    scoreWrap: { flex: 1, alignSelf: 'stretch', alignItems: 'center', justifyContent: 'center' },
    who: { alignItems: 'center', gap: 8, paddingTop: 22 },
    pname: { fontFamily: Fonts.body, fontSize: 17, fontWeight: FontWeight.bold, maxWidth: 200 },
    pips: { flexDirection: 'row', gap: 5 },
    pip: { width: 8, height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.16)' },
    serveTag: { flexDirection: 'row', alignItems: 'center', gap: 5 },
    serveBall: { width: 7, height: 7, borderRadius: 4 },
    serveTagText: { fontFamily: Fonts.body, fontSize: 10, fontWeight: FontWeight.extrabold, letterSpacing: 1.6, textTransform: 'uppercase' },
    score: { fontFamily: Fonts.heading, fontSize: 150, fontWeight: FontWeight.extrabold, letterSpacing: -4, color: '#f4fff8', includeFontPadding: false },
    undo: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 50, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.08)', backgroundColor: 'rgba(0,0,0,0.18)' },
    undoText: { fontFamily: Fonts.body, fontSize: 11, fontWeight: FontWeight.bold, letterSpacing: 1, textTransform: 'uppercase', color: colors.textMuted },
    console: { position: 'absolute', top: '50%', left: '50%', transform: [{ translateX: -52 }, { translateY: -34 }], minWidth: 104, alignItems: 'center', gap: 5, paddingVertical: 12, paddingHorizontal: 16, borderRadius: 18, backgroundColor: 'rgba(9,11,9,0.86)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
    games: { fontFamily: Fonts.heading, fontSize: 26, fontWeight: FontWeight.extrabold },
    meta: { fontFamily: Fonts.body, fontSize: 10, fontWeight: FontWeight.bold, letterSpacing: 1.6, textTransform: 'uppercase', color: colors.textFaint },
    exit: { position: 'absolute', top: 14, left: 50, width: 34, height: 34, borderRadius: 11, backgroundColor: 'rgba(10,12,10,0.5)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' },
    fmt: { position: 'absolute', top: 22, right: 24, fontFamily: Fonts.body, fontSize: 10.5, fontWeight: FontWeight.extrabold, letterSpacing: 1.6, textTransform: 'uppercase', color: 'rgba(255,255,255,0.5)' },
    winWrap: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.62)', alignItems: 'center', justifyContent: 'center' },
    winCard: { alignItems: 'center', gap: 10, paddingVertical: 26, paddingHorizontal: 34, borderRadius: 22, backgroundColor: colors.bgAlt, borderWidth: 1, borderColor: colors.borderLight },
    winName: { fontFamily: Fonts.heading, fontSize: 24, fontWeight: FontWeight.extrabold, color: colors.text },
    winScore: { fontFamily: Fonts.body, fontSize: 13, fontWeight: FontWeight.semibold, color: colors.textMuted },
    winBtns: { flexDirection: 'row', gap: 10, marginTop: 8 },
    winBtn: { paddingVertical: 11, paddingHorizontal: 22, borderRadius: 12 },
    winGhost: { backgroundColor: colors.bgMuted, borderWidth: 1, borderColor: colors.borderLight },
    winGhostText: { fontFamily: Fonts.body, fontSize: 14, fontWeight: FontWeight.bold, color: colors.text },
    winPrimary: { backgroundColor: colors.primary },
    winPrimaryText: { fontFamily: Fonts.body, fontSize: 14, fontWeight: FontWeight.bold, color: colors.textOnPrimary },
  });
}
