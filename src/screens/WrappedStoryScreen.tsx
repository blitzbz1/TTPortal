// F054: "TT Wrapped" — a swipeable, story-format year-in-review. A horizontal
// paged FlatList of story cards (mirrors VenueDetailScreen's photo gallery; NO
// carousel lib is installed). Each card is a <View collapsable={false}> captured
// to a PNG and shared via shareCardImage. Reachable from the Profile "Wrapped"
// banner inside the Dec 15 – Jan 15 window.
//
// Visual design intentionally mirrors the marketing site's animated Wrapped
// (web `WrappedStory.tsx`): a self-contained moss/clay/ink dark palette (NOT the
// app theme, so it reads the same in light or dark), gradient story cards with a
// kicker, a gradient icon disc that pops + breathes, bright accent headlines that
// count up, white story progress bars, drifting blooms and confetti. Motion via
// Reanimated; all gated by useReducedMotion().
import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  useWindowDimensions,
  type ListRenderItemInfo,
  type NativeSyntheticEvent,
  type NativeScrollEvent,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Defs, RadialGradient, Stop, Rect } from 'react-native-svg';
import Animated, {
  useSharedValue,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  withTiming,
  withRepeat,
  withDelay,
  withSequence,
  interpolate,
  Extrapolation,
  Easing,
  useReducedMotion,
} from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import { Lucide } from '../components/Icon';
import { shareCardImage } from '../lib/shareImage';
import { EmptyState } from '../components/EmptyState';
import { Fonts, FontSize, FontWeight, Spacing } from '../theme';
import { useSession } from '../hooks/useSession';
import { useI18n } from '../hooks/useI18n';
import {
  useYearInReviewQuery,
  wrappedYearFor,
  ARCHETYPE_LABEL_KEY,
  ARCHETYPE_DESC_KEY,
  MONTH_LABEL_KEY,
  type YearInReview,
} from '../features/wrapped';

const AnimatedFlatList = Animated.FlatList as unknown as typeof FlatList;
const CARD_MS = 4200;

// Self-contained brand palette mirroring the web Wrapped (moss / clay / ink).
const W = {
  moss950: '#07201a', moss900: '#123d25', moss800: '#14532d', moss700: '#1a5a37', moss600: '#266547',
  moss400: '#569c78', moss300: '#86bb9b', moss200: '#b3d6c0', moss100: '#d9ebe0',
  clay200: '#f4c49f', clay300: '#ec9c6a', clay400: '#e37442', clay500: '#d8552a',
  ink900: '#0f1d13', bezel: '#05130d', paper: '#fafaf8',
};
type Accent = 'clay' | 'moss';
const ACCENT: Record<Accent, { grad: [string, string]; icon: string; value: string; glow: string }> = {
  clay: { grad: ['rgba(216,85,42,0.40)', 'rgba(160,52,10,0.04)'], icon: W.clay300, value: W.clay200, glow: 'rgba(216,85,42,0.55)' },
  moss: { grad: ['rgba(86,156,120,0.40)', 'rgba(20,83,45,0.04)'], icon: W.moss200, value: W.moss100, glow: 'rgba(86,156,120,0.5)' },
};

interface WrappedStoryScreenProps {
  year?: number;
}

type CardKind = 'intro' | 'hours' | 'topVenue' | 'topMonth' | 'partner' | 'badges' | 'archetype';
const CARD_ACCENT: Record<CardKind, Accent> = {
  intro: 'clay', hours: 'clay', topVenue: 'moss', topMonth: 'moss', partner: 'clay', badges: 'moss', archetype: 'clay',
};

interface CardDef {
  kind: CardKind;
  show: boolean;
}

export function WrappedStoryScreen({ year }: WrappedStoryScreenProps) {
  const router = useRouter();
  const { user } = useSession();
  const { s } = useI18n();
  const { width } = useWindowDimensions();
  const cardWidth = Math.min(width, 430);
  const styles = useMemo(() => createStyles(), []);
  const reduce = useReducedMotion();

  const targetYear = year ?? wrappedYearFor();
  const { data: wrapped, isLoading } = useYearInReviewQuery(user?.id, targetYear);

  const [activeIndex, setActiveIndex] = useState(0);
  const listRef = useRef<FlatList<CardDef>>(null);
  const activeRef = useRef(0);
  const pausedRef = useRef(false);
  const cardRefs = useRef<Record<string, View | null>>({});

  const scrollX = useSharedValue(0);
  const activeSV = useSharedValue(0);
  const segProgress = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler({ onScroll: (e) => { scrollX.value = e.contentOffset.x; } });

  const hasPlayed = !!wrapped && (wrapped.sessions > 0 || wrapped.hours > 0);

  const cards: CardDef[] = useMemo(() => {
    if (!wrapped) return [];
    const all: CardDef[] = [
      { kind: 'intro', show: true },
      { kind: 'hours', show: true },
      { kind: 'topVenue', show: !!wrapped.top_venue },
      { kind: 'topMonth', show: !!wrapped.top_month },
      { kind: 'partner', show: !!wrapped.partner_of_year },
      { kind: 'badges', show: wrapped.badges > 0 || wrapped.milestones > 0 },
      { kind: 'archetype', show: true },
    ];
    return all.filter((c) => c.show);
  }, [wrapped]);

  useEffect(() => {
    activeRef.current = activeIndex;
    activeSV.value = activeIndex;
    segProgress.value = 0;
    if (reduce) { segProgress.value = 1; return; }
    segProgress.value = withTiming(1, { duration: CARD_MS, easing: Easing.linear });
    if (cards.length <= 1) return;
    const id = setTimeout(() => {
      if (pausedRef.current) return;
      const next = (activeRef.current + 1) % cards.length;
      listRef.current?.scrollToIndex({ index: next, animated: true });
    }, CARD_MS);
    return () => clearTimeout(id);
  }, [activeIndex, cards.length, reduce, activeSV, segProgress]);

  if (isLoading && !wrapped) {
    return (
      <View style={styles.screen}>
        <SafeAreaView style={styles.flex}>
          <Header onBack={() => router.back()} title={s('wrappedTitle')} styles={styles} />
          <View style={styles.loadingWrap}>
            <Text style={styles.loadingText}>{s('loading')}</Text>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  if (!hasPlayed) {
    return (
      <View style={styles.screen}>
        <SafeAreaView style={styles.flex}>
          <Header onBack={() => router.back()} title={s('wrappedTitle')} styles={styles} />
          <EmptyState
            icon="gift"
            title={s('wrappedEmptyTitle')}
            description={s('wrappedEmptyDesc')}
            iconColor={W.clay400}
            iconBg="rgba(216,85,42,0.12)"
          />
        </SafeAreaView>
      </View>
    );
  }

  const onMomentumEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const idx = Math.round(e.nativeEvent.contentOffset.x / cardWidth);
    pausedRef.current = false;
    setActiveIndex(idx);
  };

  const renderCard = ({ item, index }: ListRenderItemInfo<CardDef>) => (
    <View style={{ width: cardWidth }} testID={`wrapped-card-${item.kind}`}>
      <WrappedCard
        kind={item.kind}
        index={index}
        scrollX={scrollX}
        cardWidth={cardWidth}
        active={index === activeIndex}
        reduce={reduce}
        wrapped={wrapped as YearInReview}
        styles={styles}
        s={s}
        setRef={(node) => { cardRefs.current[item.kind] = node; }}
      />
    </View>
  );

  const activeKind = cards[activeIndex]?.kind ?? 'intro';

  return (
    <View style={styles.screen}>
      <SafeAreaView style={styles.flex}>
        <Header onBack={() => router.back()} title={s('wrappedTitle')} styles={styles} />

        {/* story progress segments */}
        <View style={styles.progressRow}>
          {cards.map((c, i) => (
            <ProgressSegment key={c.kind} index={i} activeSV={activeSV} progress={segProgress} styles={styles} />
          ))}
        </View>

        <AnimatedFlatList
          ref={listRef as never}
          data={cards}
          keyExtractor={(c: CardDef) => c.kind}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onScroll={onScroll}
          scrollEventThrottle={16}
          onScrollBeginDrag={() => { pausedRef.current = true; }}
          onMomentumScrollEnd={onMomentumEnd}
          getItemLayout={(_: unknown, index: number) => ({ length: cardWidth, offset: cardWidth * index, index })}
          renderItem={renderCard as never}
          testID="wrapped-deck"
        />

        {/* Share the currently-visible card. */}
        <TouchableOpacity
          activeOpacity={0.9}
          onPress={() =>
            shareCardImage(
              { current: cardRefs.current[activeKind] ?? null },
              s('wrappedShareMessage', String((wrapped as YearInReview).year)),
            )
          }
          accessibilityRole="button"
          testID="wrapped-share"
          style={styles.shareWrap}
        >
          <LinearGradient
            colors={[W.moss600, W.moss700]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.shareBtn}
          >
            <Lucide name="share-2" size={16} color={W.paper} />
            <Text style={styles.shareText}>{s('wrappedShare')}</Text>
          </LinearGradient>
        </TouchableOpacity>
      </SafeAreaView>
    </View>
  );
}

function Header({
  onBack,
  title,
  styles,
}: {
  onBack: () => void;
  title: string;
  styles: ReturnType<typeof createStyles>;
}) {
  return (
    <View style={styles.header}>
      <TouchableOpacity onPress={onBack} hitSlop={{ top: 10, right: 10, bottom: 10, left: 10 }} testID="wrapped-back">
        <Lucide name="arrow-left" size={22} color={W.paper} />
      </TouchableOpacity>
      <Text style={styles.headerTitle}>{title}</Text>
      <View style={{ width: 22 }} />
    </View>
  );
}

function ProgressSegment({
  index,
  activeSV,
  progress,
  styles,
}: {
  index: number;
  activeSV: { value: number };
  progress: { value: number };
  styles: ReturnType<typeof createStyles>;
}) {
  const fill = useAnimatedStyle(() => {
    const w = index < activeSV.value ? 1 : index === activeSV.value ? progress.value : 0;
    return { width: `${Math.max(0, Math.min(1, w)) * 100}%` };
  });
  return (
    <View style={styles.segTrack}>
      <Animated.View style={[styles.segFill, fill]} />
    </View>
  );
}

/** Soft radial-gradient glow (SVG so it fades to transparent like the web's blur). */
function Bloom({
  size, color, centerOpacity, posStyle, reduce, delay,
}: {
  size: number; color: string; centerOpacity: number; posStyle: object; reduce: boolean; delay: number;
}) {
  const t = useSharedValue(0);
  useEffect(() => {
    if (reduce) return;
    t.value = withDelay(delay, withRepeat(withTiming(1, { duration: 7000, easing: Easing.inOut(Easing.quad) }), -1, true));
  }, [reduce, delay, t]);
  const anim = useAnimatedStyle(() => ({
    transform: [
      { translateX: interpolate(t.value, [0, 1], [0, 14]) },
      { translateY: interpolate(t.value, [0, 1], [0, 18]) },
    ],
  }));
  const gid = 'bloom' + useId().replace(/[^a-zA-Z0-9]/g, '');
  return (
    <Animated.View pointerEvents="none" style={[{ position: 'absolute', width: size, height: size }, posStyle, anim]}>
      <Svg width={size} height={size}>
        <Defs>
          <RadialGradient id={gid} cx="50%" cy="50%" r="50%">
            <Stop offset="0%" stopColor={color} stopOpacity={centerOpacity} />
            <Stop offset="100%" stopColor={color} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Rect x="0" y="0" width={size} height={size} fill={`url(#${gid})`} />
      </Svg>
    </Animated.View>
  );
}

function Confetti({ reduce }: { reduce: boolean }) {
  const xs = [5, 16, 27, 38, 49, 60, 71, 82, 92, 21, 45, 66, 88, 11];
  const palette = [W.clay400, W.moss300, W.clay300, W.moss400, W.clay500, W.moss200];
  if (reduce) return null;
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {xs.map((x, i) => (
        <ConfettiPiece
          key={i}
          left={`${x}%`}
          color={palette[i % palette.length]}
          dur={4200 + ((i * 613) % 2600)}
          delay={(i * 311) % 3800}
          size={5 + (i % 3)}
        />
      ))}
    </View>
  );
}

function ConfettiPiece({
  color, dur, delay, size, left,
}: {
  color: string; dur: number; delay: number; size: number; left: string;
}) {
  const p = useSharedValue(0);
  useEffect(() => {
    p.value = withDelay(delay, withRepeat(withTiming(1, { duration: dur, easing: Easing.linear }), -1, false));
  }, [p, dur, delay]);
  const anim = useAnimatedStyle(() => ({
    opacity: interpolate(p.value, [0, 0.1, 0.85, 1], [0, 0.95, 0.85, 0]),
    transform: [
      { translateY: interpolate(p.value, [0, 1], [0, 640]) },
      { rotate: `${interpolate(p.value, [0, 1], [0, 420])}deg` },
    ],
  }));
  return (
    <Animated.View
      style={[
        { position: 'absolute', top: -16, left: left as never, width: size, height: size * 1.8, borderRadius: 1, backgroundColor: color },
        anim,
      ]}
    />
  );
}

interface WrappedCardProps {
  kind: CardKind;
  index: number;
  scrollX: { value: number };
  cardWidth: number;
  active: boolean;
  reduce: boolean;
  wrapped: YearInReview;
  styles: ReturnType<typeof createStyles>;
  s: (key: string, ...args: string[]) => string;
  setRef: (node: View | null) => void;
}

function fmtHours(hours: number): string {
  return Number.isInteger(hours) ? String(hours) : hours.toFixed(1);
}

function CountUp({
  target, active, reduce, style, testID,
}: {
  target: number; active: boolean; reduce: boolean; style: object; testID?: string;
}) {
  const [n, setN] = useState(reduce ? target : 0);
  useEffect(() => {
    if (!active || reduce) { setN(target); return; }
    let raf = 0;
    let start = 0;
    setN(0);
    const tick = (t: number) => {
      if (!start) start = t;
      const prog = Math.min(1, (t - start) / 1000);
      setN(Math.round(target * (1 - Math.pow(1 - prog, 3))));
      if (prog < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [active, target, reduce]);
  return (
    <Text style={style} numberOfLines={1} adjustsFontSizeToFit testID={testID}>{n}</Text>
  );
}

function WrappedCard({
  kind, index, scrollX, cardWidth, active, reduce, wrapped, styles, s, setRef,
}: WrappedCardProps) {
  const accent = ACCENT[CARD_ACCENT[kind]];
  let icon = 'sparkles';
  let headline = '';
  let title = '';
  let subtitle: string | null = null;
  let countTarget: number | null = null;

  switch (kind) {
    case 'intro':
      icon = 'gift'; headline = String(wrapped.year); title = s('wrappedIntroTitle'); subtitle = s('wrappedIntroSubtitle', String(wrapped.year)); break;
    case 'hours':
      icon = 'clock'; headline = fmtHours(wrapped.hours); if (Number.isInteger(wrapped.hours)) countTarget = wrapped.hours;
      title = s('wrappedHoursTitle'); subtitle = s('wrappedHoursSubtitle', String(wrapped.sessions), String(wrapped.venues)); break;
    case 'topVenue':
      icon = 'map-pin'; headline = wrapped.top_venue ? wrapped.top_venue.name : ''; title = s('wrappedTopVenueTitle');
      subtitle = wrapped.top_venue ? s('wrappedTopVenueSubtitle', String(wrapped.top_venue.checkins)) : null; break;
    case 'topMonth':
      icon = 'calendar'; headline = wrapped.top_month ? s(MONTH_LABEL_KEY[wrapped.top_month.month] ?? 'monthJan') : ''; title = s('wrappedTopMonthTitle');
      subtitle = wrapped.top_month ? s('wrappedTopMonthSubtitle', String(wrapped.top_month.sessions)) : null; break;
    case 'partner':
      icon = 'users'; headline = wrapped.partner_of_year?.full_name || s('user'); title = s('wrappedPartnerTitle'); subtitle = s('wrappedPartnerSubtitle'); break;
    case 'badges':
      icon = 'medal'; headline = String(wrapped.badges + wrapped.milestones); countTarget = wrapped.badges + wrapped.milestones;
      title = s('wrappedBadgesTitle'); subtitle = s('wrappedBadgesSubtitle', String(wrapped.badges), String(wrapped.milestones)); break;
    case 'archetype':
      icon = 'crown'; headline = s(ARCHETYPE_LABEL_KEY[wrapped.archetype]); title = s('wrappedArchetypeTitle'); subtitle = s(ARCHETYPE_DESC_KEY[wrapped.archetype]); break;
  }

  const cardAnim = useAnimatedStyle(() => {
    if (reduce) return {};
    const inputRange = [(index - 1) * cardWidth, index * cardWidth, (index + 1) * cardWidth];
    return {
      opacity: interpolate(scrollX.value, inputRange, [0.4, 1, 0.4], Extrapolation.CLAMP),
      transform: [
        { scale: interpolate(scrollX.value, inputRange, [0.92, 1, 0.92], Extrapolation.CLAMP) },
        { translateY: interpolate(scrollX.value, inputRange, [16, 0, 16], Extrapolation.CLAMP) },
      ],
    };
  });

  const iconScale = useSharedValue(reduce ? 1 : 0.6);
  const glow = useSharedValue(0);
  useEffect(() => {
    if (reduce) return;
    if (active) {
      iconScale.value = withSequence(
        withTiming(1.12, { duration: 320, easing: Easing.out(Easing.back(2)) }),
        withTiming(1, { duration: 220 }),
      );
      glow.value = withRepeat(withTiming(1, { duration: 1400, easing: Easing.inOut(Easing.quad) }), -1, true);
    } else {
      iconScale.value = withTiming(0.85, { duration: 200 });
      glow.value = withTiming(0, { duration: 200 });
    }
  }, [active, reduce, iconScale, glow]);
  const iconAnim = useAnimatedStyle(() => ({ transform: [{ scale: iconScale.value }] }));
  const glowAnim = useAnimatedStyle(() => ({
    opacity: interpolate(glow.value, [0, 1], [0.12, 0.45]),
    transform: [{ scale: interpolate(glow.value, [0, 1], [1, 1.2]) }],
  }));

  const valueStyle = [styles.headline, { color: accent.value }];

  return (
    <Animated.View style={[styles.cardOuter, cardAnim]}>
      {/* collapsable={false} is REQUIRED on the captured root or Android captures blank. */}
      <View ref={setRef} collapsable={false} style={styles.card}>
        <LinearGradient colors={[W.moss950, W.ink900]} style={StyleSheet.absoluteFill} />
        {/* drifting soft blooms */}
        <Bloom size={300} color={W.clay500} centerOpacity={0.5} posStyle={{ top: -84, right: -96 }} reduce={reduce} delay={0} />
        <Bloom size={280} color={W.moss600} centerOpacity={0.55} posStyle={{ bottom: -92, left: -84 }} reduce={reduce} delay={1500} />
        {/* confetti */}
        <Confetti reduce={reduce} />

        {/* kicker */}
        <View style={styles.kickerRow}>
          <View style={styles.kickerDot} />
          <Text style={styles.kicker}>{s('wrappedBrand', String(wrapped.year))}</Text>
        </View>

        <View style={styles.body}>
          <View style={styles.iconWrap}>
            <Animated.View style={[styles.iconGlow, { backgroundColor: accent.glow }, glowAnim]} />
            <Animated.View style={iconAnim}>
              <LinearGradient
                colors={accent.grad}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.iconDisc}
              >
                <Lucide name={icon} size={34} color={accent.icon} />
              </LinearGradient>
            </Animated.View>
          </View>

          {countTarget != null ? (
            <CountUp target={countTarget} active={active} reduce={reduce} style={valueStyle} testID={`wrapped-headline-${kind}`} />
          ) : (
            <Text style={valueStyle} numberOfLines={2} adjustsFontSizeToFit testID={`wrapped-headline-${kind}`}>{headline}</Text>
          )}
          <Text style={styles.title}>{title}</Text>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        </View>
      </View>
    </Animated.View>
  );
}

function createStyles() {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: W.bezel },
    flex: { flex: 1 },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      height: 52,
      paddingHorizontal: Spacing.md,
    },
    headerTitle: { fontFamily: Fonts.heading, fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: W.paper },
    loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    loadingText: { fontFamily: Fonts.body, fontSize: FontSize.md, color: W.moss200 },
    progressRow: { flexDirection: 'row', gap: 5, paddingHorizontal: Spacing.md, paddingBottom: 4 },
    segTrack: { flex: 1, height: 3, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.16)', overflow: 'hidden' },
    segFill: { height: '100%', borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.92)' },
    cardOuter: { flex: 1 },
    card: {
      flex: 1,
      margin: Spacing.md,
      borderRadius: 30,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.06)',
      backgroundColor: W.moss950,
    },
    bloomA: {
      position: 'absolute', top: -40, right: -56, width: 220, height: 220, borderRadius: 110,
      backgroundColor: W.clay500, opacity: 0.22,
    },
    bloomB: {
      position: 'absolute', bottom: -48, left: -44, width: 200, height: 200, borderRadius: 100,
      backgroundColor: W.moss600, opacity: 0.3,
    },
    kickerRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: Spacing.lg, paddingTop: Spacing.lg },
    kickerDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: W.clay400 },
    kicker: { fontFamily: Fonts.body, fontSize: 11, fontWeight: FontWeight.bold, letterSpacing: 2, textTransform: 'uppercase', color: W.moss200 },
    body: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, paddingHorizontal: Spacing.xl },
    iconWrap: { width: 72, height: 72, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
    iconGlow: { position: 'absolute', width: 72, height: 72, borderRadius: 22 },
    iconDisc: {
      width: 72, height: 72, borderRadius: 22, alignItems: 'center', justifyContent: 'center',
      borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
    },
    headline: { fontFamily: Fonts.heading, fontSize: 48, fontWeight: FontWeight.bold, color: W.clay200, textAlign: 'center' },
    title: { fontFamily: Fonts.heading, fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: W.paper, textAlign: 'center' },
    subtitle: { fontFamily: Fonts.body, fontSize: FontSize.md, color: 'rgba(179,214,192,0.82)', textAlign: 'center', paddingHorizontal: Spacing.md, maxWidth: 280 },
    shareWrap: { marginHorizontal: Spacing.md, marginBottom: Spacing.md },
    shareBtn: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm,
      paddingVertical: Spacing.md, borderRadius: 999,
    },
    shareText: { fontFamily: Fonts.body, fontSize: FontSize.md, fontWeight: FontWeight.bold, color: W.paper },
  });
}
