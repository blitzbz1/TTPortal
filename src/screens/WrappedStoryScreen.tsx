// F054: "TT Wrapped" — a swipeable, story-format year-in-review. A 6-card
// horizontal paged FlatList (mirrors VenueDetailScreen's photo gallery —
// FlatList horizontal pagingEnabled onMomentumScrollEnd; NO carousel lib is
// installed). Each card is a story-format <View collapsable={false}> that can be
// captured to a PNG and shared via shareCardImage (the LeaderboardsScreen
// off-screen-capture idiom, but here the card is on-screen so we capture it
// directly). Reachable from the Profile "Wrapped" banner inside the Dec 15 –
// Jan 15 window.
import React, { useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  useWindowDimensions,
  type ListRenderItemInfo,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Lucide } from '../components/Icon';
import { shareCardImage } from '../lib/shareImage';
import { EmptyState } from '../components/EmptyState';
import { useTheme } from '../hooks/useTheme';
import type { ThemeColors } from '../theme';
import { Fonts, FontSize, FontWeight, Spacing, Radius, Shadows } from '../theme';
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

interface WrappedStoryScreenProps {
  /** Optional calendar year. Defaults to the year the open window covers. */
  year?: number;
}

type CardKind =
  | 'intro'
  | 'hours'
  | 'topVenue'
  | 'topMonth'
  | 'partner'
  | 'badges'
  | 'archetype';

interface CardDef {
  kind: CardKind;
  /** True when this card has enough data to be worth showing. */
  show: boolean;
}

export function WrappedStoryScreen({ year }: WrappedStoryScreenProps) {
  const router = useRouter();
  const { user } = useSession();
  const { s } = useI18n();
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const cardWidth = Math.min(width, 430); // matches the web phone-frame cap.
  const styles = useMemo(() => createStyles(colors), [colors]);

  const targetYear = year ?? wrappedYearFor();
  const { data: wrapped, isLoading } = useYearInReviewQuery(user?.id, targetYear);

  const [activeIndex, setActiveIndex] = useState(0);
  // One capture ref per visible card (shared via a map keyed by card kind).
  const cardRefs = useRef<Record<string, View | null>>({});

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

  if (isLoading && !wrapped) {
    return (
      <SafeAreaView style={styles.container}>
        <Header onBack={() => router.back()} title={s('wrappedTitle')} styles={styles} colors={colors} />
        <View style={styles.loadingWrap}>
          <Text style={styles.loadingText}>{s('loading')}</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!hasPlayed) {
    return (
      <SafeAreaView style={styles.container}>
        <Header onBack={() => router.back()} title={s('wrappedTitle')} styles={styles} colors={colors} />
        <EmptyState
          icon="gift"
          title={s('wrappedEmptyTitle')}
          description={s('wrappedEmptyDesc')}
          iconColor={colors.accent}
          iconBg={colors.amberPale}
        />
      </SafeAreaView>
    );
  }

  const renderCard = ({ item, index }: ListRenderItemInfo<CardDef>) => (
    <View style={{ width: cardWidth }} testID={`wrapped-card-${item.kind}`}>
      <WrappedCard
        kind={item.kind}
        index={index}
        wrapped={wrapped as YearInReview}
        styles={styles}
        colors={colors}
        s={s}
        setRef={(node) => {
          cardRefs.current[item.kind] = node;
        }}
      />
    </View>
  );

  const activeKind = cards[activeIndex]?.kind ?? 'intro';

  return (
    <SafeAreaView style={styles.container}>
      <Header onBack={() => router.back()} title={s('wrappedTitle')} styles={styles} colors={colors} />

      <FlatList
        data={cards}
        keyExtractor={(c) => c.kind}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={(e) => {
          const idx = Math.round(e.nativeEvent.contentOffset.x / cardWidth);
          setActiveIndex(idx);
        }}
        getItemLayout={(_, index) => ({ length: cardWidth, offset: cardWidth * index, index })}
        renderItem={renderCard}
        testID="wrapped-deck"
      />

      {/* Page dots */}
      <View style={styles.dotsRow}>
        {cards.map((c, i) => (
          <View key={c.kind} style={[styles.dot, i === activeIndex && styles.dotActive]} />
        ))}
      </View>

      {/* Share the currently-visible card. */}
      <TouchableOpacity
        style={styles.shareBtn}
        onPress={() =>
          shareCardImage(
            { current: cardRefs.current[activeKind] ?? null },
            s('wrappedShareMessage', String((wrapped as YearInReview).year)),
          )
        }
        accessibilityRole="button"
        testID="wrapped-share"
      >
        <Lucide name="share-2" size={16} color={colors.textOnPrimary} />
        <Text style={styles.shareText}>{s('wrappedShare')}</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

function Header({
  onBack,
  title,
  styles,
  colors,
}: {
  onBack: () => void;
  title: string;
  styles: ReturnType<typeof createStyles>;
  colors: ThemeColors;
}) {
  return (
    <View style={styles.header}>
      <TouchableOpacity
        onPress={onBack}
        hitSlop={{ top: 10, right: 10, bottom: 10, left: 10 }}
        testID="wrapped-back"
      >
        <Lucide name="arrow-left" size={22} color={colors.text} />
      </TouchableOpacity>
      <Text style={styles.headerTitle}>{title}</Text>
      <View style={{ width: 22 }} />
    </View>
  );
}

interface WrappedCardProps {
  kind: CardKind;
  index: number;
  wrapped: YearInReview;
  styles: ReturnType<typeof createStyles>;
  colors: ThemeColors;
  s: (key: string, ...args: string[]) => string;
  setRef: (node: View | null) => void;
}

// Whole-number stats read cleaner; one decimal only when fractional.
function fmtHours(hours: number): string {
  return Number.isInteger(hours) ? String(hours) : hours.toFixed(1);
}

function WrappedCard({ kind, wrapped, styles, colors, s, setRef }: WrappedCardProps) {
  let icon = 'sparkles';
  let headline = '';
  let title = '';
  let subtitle: string | null = null;

  switch (kind) {
    case 'intro':
      icon = 'gift';
      headline = String(wrapped.year);
      title = s('wrappedIntroTitle');
      subtitle = s('wrappedIntroSubtitle');
      break;
    case 'hours':
      icon = 'clock';
      headline = fmtHours(wrapped.hours);
      title = s('wrappedHoursTitle');
      subtitle = s('wrappedHoursSubtitle', String(wrapped.sessions), String(wrapped.venues));
      break;
    case 'topVenue':
      icon = 'map-pin';
      headline = wrapped.top_venue ? wrapped.top_venue.name : '';
      title = s('wrappedTopVenueTitle');
      subtitle = wrapped.top_venue
        ? s('wrappedTopVenueSubtitle', String(wrapped.top_venue.checkins))
        : null;
      break;
    case 'topMonth':
      icon = 'calendar';
      headline = wrapped.top_month ? s(MONTH_LABEL_KEY[wrapped.top_month.month] ?? 'monthJan') : '';
      title = s('wrappedTopMonthTitle');
      subtitle = wrapped.top_month
        ? s('wrappedTopMonthSubtitle', String(wrapped.top_month.sessions))
        : null;
      break;
    case 'partner':
      icon = 'users';
      headline = wrapped.partner_of_year?.full_name || s('user');
      title = s('wrappedPartnerTitle');
      subtitle = s('wrappedPartnerSubtitle');
      break;
    case 'badges':
      icon = 'medal';
      headline = String(wrapped.badges + wrapped.milestones);
      title = s('wrappedBadgesTitle');
      subtitle = s('wrappedBadgesSubtitle', String(wrapped.badges), String(wrapped.milestones));
      break;
    case 'archetype':
      icon = 'crown';
      headline = s(ARCHETYPE_LABEL_KEY[wrapped.archetype]);
      title = s('wrappedArchetypeTitle');
      subtitle = s(ARCHETYPE_DESC_KEY[wrapped.archetype]);
      break;
  }

  return (
    // collapsable={false} is REQUIRED on the captured root or Android captures blank.
    <View ref={setRef} collapsable={false} style={styles.card} testID={`wrapped-card-inner-${kind}`}>
      <View style={styles.brandRow}>
        <Lucide name="circle-dot" size={16} color={colors.primary} />
        <Text style={styles.brand}>{s('wrappedBrand', String(wrapped.year))}</Text>
      </View>
      <View style={styles.cardBody}>
        <View style={styles.cardIconWrap}>
          <Lucide name={icon} size={34} color={colors.accent} />
        </View>
        <Text style={styles.cardHeadline} numberOfLines={2} adjustsFontSizeToFit testID={`wrapped-headline-${kind}`}>
          {headline}
        </Text>
        <Text style={styles.cardTitle}>{title}</Text>
        {subtitle ? <Text style={styles.cardSubtitle}>{subtitle}</Text> : null}
      </View>
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: colors.bgAlt,
      height: 52,
      paddingHorizontal: Spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      ...Shadows.bar,
    },
    headerTitle: {
      fontFamily: Fonts.heading,
      fontSize: FontSize.xl,
      fontWeight: FontWeight.bold,
      color: colors.text,
    },
    loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    loadingText: { fontFamily: Fonts.body, fontSize: FontSize.md, color: colors.textMuted },
    card: {
      flex: 1,
      margin: Spacing.md,
      padding: Spacing.xl,
      borderRadius: Radius.xl,
      backgroundColor: colors.bgAlt,
      borderWidth: 1,
      borderColor: colors.primaryDim,
      ...Shadows.md,
    },
    brandRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    brand: {
      fontFamily: Fonts.body,
      fontSize: FontSize.md,
      fontWeight: FontWeight.bold,
      color: colors.primary,
    },
    cardBody: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.sm },
    cardIconWrap: {
      width: 72,
      height: 72,
      borderRadius: 36,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.amberPale,
      marginBottom: Spacing.sm,
    },
    cardHeadline: {
      fontFamily: Fonts.heading,
      fontSize: 44,
      fontWeight: FontWeight.bold,
      color: colors.text,
      textAlign: 'center',
    },
    cardTitle: {
      fontFamily: Fonts.heading,
      fontSize: FontSize.xl,
      fontWeight: FontWeight.bold,
      color: colors.text,
      textAlign: 'center',
    },
    cardSubtitle: {
      fontFamily: Fonts.body,
      fontSize: FontSize.md,
      color: colors.textMuted,
      textAlign: 'center',
      paddingHorizontal: Spacing.md,
    },
    dotsRow: {
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      gap: 6,
      paddingVertical: Spacing.sm,
    },
    dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.primaryDim },
    dotActive: { backgroundColor: colors.primary, width: 18 },
    shareBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: Spacing.sm,
      marginHorizontal: Spacing.md,
      marginBottom: Spacing.md,
      paddingVertical: Spacing.md,
      backgroundColor: colors.primary,
      borderRadius: Radius.lg,
      ...Shadows.sm,
    },
    shareText: {
      fontFamily: Fonts.body,
      fontSize: FontSize.md,
      fontWeight: FontWeight.bold,
      color: colors.textOnPrimary,
    },
  });
}
