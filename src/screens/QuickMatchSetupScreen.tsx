// Quick Match — setup. Pick points per game (11/21), match length (best of
// 3/5/7), name the two players and who serves first, then launch the landscape
// scoreboard. Selection uses subtle tints + thin strokes (app UI convention).
import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Lucide } from '../components/Icon';
import { useTheme } from '../hooks/useTheme';
import { useI18n } from '../hooks/useI18n';
import { useSession } from '../hooks/useSession';
import { useProfileQuery } from '../hooks/queries/useProfileQuery';
import { hapticLight } from '../lib/haptics';
import type { ThemeColors } from '../theme';
import { Fonts, FontWeight } from '../theme';
import { gamesToWin, type Points, type BestOf, type PlayerIndex } from '../features/quickMatch';

const POINTS: Points[] = [11, 21];
const BEST_OF: BestOf[] = [3, 5, 7];

export function QuickMatchSetupScreen() {
  const router = useRouter();
  const { s } = useI18n();
  const { colors } = useTheme();
  const { user } = useSession();
  const params = useLocalSearchParams<{ opponentId?: string }>();
  const { data: myProfile } = useProfileQuery(user?.id);
  const { data: oppProfile } = useProfileQuery(params.opponentId);
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [points, setPoints] = useState<Points>(11);
  const [bestOf, setBestOf] = useState<BestOf>(5);
  const [names, setNames] = useState<[string, string]>(['', '']);
  const [firstServer, setFirstServer] = useState<PlayerIndex>(0);

  // Names pre-fill from the QR-paired profiles (you + opponent); don't clobber
  // anything the user has already typed.
  const myName = (myProfile as { full_name?: string } | null | undefined)?.full_name ?? '';
  const oppName = (oppProfile as { full_name?: string } | null | undefined)?.full_name ?? '';
  useEffect(() => {
    setNames((n) => [n[0] || myName, n[1] || oppName]);
  }, [myName, oppName]);

  // Closing setup returns to the Profile tab (where the flow launched).
  const close = () => { if (router.canDismiss()) router.dismissAll(); else router.back(); };

  const start = () => {
    hapticLight();
    router.replace({
      pathname: '/(protected)/quick-match/board',
      params: {
        opponentId: params.opponentId,
        points: String(points),
        bestOf: String(bestOf),
        n0: names[0].trim() || s('qmYou'),
        n1: names[1].trim() || s('qmOpponent'),
        server: String(firstServer),
      },
    });
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right', 'bottom']}>
      <View style={styles.topbar}>
        <TouchableOpacity style={styles.iconBtn} onPress={close} accessibilityRole="button" accessibilityLabel={s('back')}>
          <Lucide name="x" size={18} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.topTitle}>{s('quickMatch')}</Text>
        <View style={{ width: 38 }} />
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.scroll}>
        <Text style={styles.kicker}>{s('qmSetupKicker')}</Text>
        <Text style={styles.h1}>{s('qmNewMatch')}</Text>

        {/* Points per game */}
        <Text style={styles.label}>{s('qmPointsPerGame')}</Text>
        <View style={styles.row}>
          {POINTS.map((p) => {
            const sel = p === points;
            return (
              <TouchableOpacity key={p} style={[styles.tile, sel && styles.tileSel]} onPress={() => { hapticLight(); setPoints(p); }} accessibilityRole="button" accessibilityState={{ selected: sel }}>
                <Text style={[styles.tileVal, sel && styles.tileValSel]}>{p}</Text>
                <Text style={[styles.tileSub, sel && styles.tileSubSel]}>{s('qmPoints')}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Match length */}
        <Text style={styles.label}>{s('qmMatchLength')}</Text>
        <View style={styles.row}>
          {BEST_OF.map((b) => {
            const sel = b === bestOf;
            return (
              <TouchableOpacity key={b} style={[styles.tile, sel && styles.tileSel]} onPress={() => { hapticLight(); setBestOf(b); }} accessibilityRole="button" accessibilityState={{ selected: sel }}>
                <Text style={[styles.tileVal, sel && styles.tileValSel]}>{b}</Text>
                <Text style={[styles.tileSub, sel && styles.tileSubSel]}>{s('qmBestOf')}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Players & first serve */}
        <Text style={styles.label}>{s('qmPlayersServe')}</Text>
        <View style={{ gap: 9 }}>
          {([0, 1] as PlayerIndex[]).map((i) => {
            const serving = firstServer === i;
            return (
              <View key={i} style={styles.player}>
                <View style={[styles.pdot, { backgroundColor: i === 0 ? colors.primary : colors.accentBright }]} />
                <TextInput
                  style={styles.pname}
                  value={names[i]}
                  onChangeText={(t) => setNames((n) => (i === 0 ? [t, n[1]] : [n[0], t]))}
                  placeholder={i === 0 ? s('qmYou') : s('qmOpponent')}
                  placeholderTextColor={colors.textFaint}
                  maxLength={20}
                  returnKeyType="done"
                />
                <TouchableOpacity
                  style={[styles.serve, serving && styles.serveSel]}
                  onPress={() => { hapticLight(); setFirstServer(i); }}
                  accessibilityRole="button"
                  accessibilityState={{ selected: serving }}
                >
                  {serving ? <View style={styles.serveBall} /> : null}
                  <Text style={[styles.serveText, serving && styles.serveTextSel]}>{s('qmServes')}</Text>
                </TouchableOpacity>
              </View>
            );
          })}
        </View>

        {/* Start */}
        <TouchableOpacity style={styles.start} onPress={start} accessibilityRole="button" testID="quick-match-start">
          <Text style={styles.startLabel}>{s('qmStart')}</Text>
          <Text style={styles.startSub}>{s('qmStartSub', String(bestOf), String(gamesToWin(bestOf)), String(points))}</Text>
        </TouchableOpacity>
        <Text style={styles.note}>{s('qmSetupNote')}</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg },
    topbar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 8 },
    iconBtn: { width: 38, height: 38, borderRadius: 12, backgroundColor: colors.bgAlt, borderWidth: 1, borderColor: colors.borderLight, alignItems: 'center', justifyContent: 'center' },
    topTitle: { fontFamily: Fonts.body, fontSize: 12, fontWeight: FontWeight.bold, letterSpacing: 1.4, textTransform: 'uppercase', color: colors.textMuted },
    scroll: { paddingHorizontal: 18, paddingTop: 10, paddingBottom: 40 },
    kicker: { fontFamily: Fonts.body, fontSize: 11, fontWeight: FontWeight.bold, letterSpacing: 1.6, textTransform: 'uppercase', color: colors.primaryLight, marginBottom: 7, marginLeft: 2 },
    h1: { fontFamily: Fonts.heading, fontSize: 32, fontWeight: FontWeight.extrabold, letterSpacing: -0.5, color: colors.text, marginLeft: 2 },
    label: { fontFamily: Fonts.body, fontSize: 11, fontWeight: FontWeight.bold, letterSpacing: 1.4, textTransform: 'uppercase', color: colors.textFaint, marginTop: 24, marginBottom: 11, marginLeft: 2 },
    row: { flexDirection: 'row', gap: 10 },
    tile: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 3, paddingVertical: 18, borderRadius: 16, backgroundColor: colors.bgAlt, borderWidth: 1, borderColor: colors.borderLight },
    tileSel: { backgroundColor: colors.primaryPale, borderWidth: 1.5, borderColor: colors.primary },
    tileVal: { fontFamily: Fonts.heading, fontSize: 30, fontWeight: FontWeight.bold, letterSpacing: -0.5, color: colors.text, lineHeight: 32 },
    tileValSel: { color: colors.primaryLight },
    tileSub: { fontFamily: Fonts.body, fontSize: 11, fontWeight: FontWeight.semibold, letterSpacing: 0.4, textTransform: 'uppercase', color: colors.textFaint },
    tileSubSel: { color: colors.primaryMid },
    player: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 14, backgroundColor: colors.bgAlt, borderWidth: 1, borderColor: colors.borderLight, borderRadius: 14 },
    pdot: { width: 14, height: 14, borderRadius: 7 },
    pname: { flex: 1, fontFamily: Fonts.body, fontSize: 16, fontWeight: FontWeight.semibold, color: colors.text, padding: 0 },
    serve: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 6, paddingHorizontal: 11, borderRadius: 10, backgroundColor: colors.bgMuted, borderWidth: 1, borderColor: colors.borderLight },
    serveSel: { backgroundColor: colors.primaryPale, borderColor: colors.primaryDim },
    serveBall: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.primaryLight },
    serveText: { fontFamily: Fonts.body, fontSize: 11, fontWeight: FontWeight.bold, letterSpacing: 0.4, textTransform: 'uppercase', color: colors.textFaint },
    serveTextSel: { color: colors.primaryLight },
    start: { marginTop: 28, alignItems: 'center', gap: 3, paddingVertical: 16, borderRadius: 16, backgroundColor: colors.primary, borderWidth: 1, borderColor: colors.primaryLight },
    startLabel: { fontFamily: Fonts.heading, fontSize: 18, fontWeight: FontWeight.bold, color: colors.textOnPrimary },
    startSub: { fontFamily: Fonts.body, fontSize: 11.5, fontWeight: FontWeight.medium, color: colors.textOnPrimary, opacity: 0.85 },
    note: { fontFamily: Fonts.body, fontSize: 11, color: colors.textFaint, textAlign: 'center', marginTop: 16 },
  });
}
