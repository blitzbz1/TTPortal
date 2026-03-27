import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Lucide } from '../components/Icon';
import { TabBar } from '../components/TabBar';
import { Colors, Fonts } from '../theme';
import { useSession } from '../hooks/useSession';
import { useI18n } from '../hooks/useI18n';
import { getFavorites, removeFavorite } from '../services/favorites';

type SortMode = 'recent' | 'name';

interface FavoritesScreenProps {
  hideTabBar?: boolean;
}

export function FavoritesScreen({ hideTabBar = false }: FavoritesScreenProps) {
  const insets = useSafeAreaInsets();
  const [favorites, setFavorites] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [sortMode, setSortMode] = useState<SortMode>('recent');
  const { user } = useSession();
  const { s } = useI18n();
  const router = useRouter();

  const fetchFavorites = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data, error } = await getFavorites(user.id);
      if (error) {
        Alert.alert(s('error'), s('favLoadError'));
      } else {
        setFavorites(data ?? []);
      }
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  useEffect(() => {
    fetchFavorites();
  }, [fetchFavorites]);

  const handleRemove = useCallback(async (venueId: number) => {
    if (!user) return;
    const { error } = await removeFavorite(user.id, venueId);
    if (error) {
      Alert.alert(s('error'), s('favRemoveError'));
      return;
    }
    setFavorites((prev) => prev.filter((f) => f.venue_id !== venueId));
  }, [user]);

  const handleToggleSort = useCallback(() => {
    setSortMode((prev) => (prev === 'recent' ? 'name' : 'recent'));
  }, []);

  const sortedFavorites = [...favorites].sort((a, b) => {
    if (sortMode === 'name') {
      const nameA = a.venues?.name ?? '';
      const nameB = b.venues?.name ?? '';
      return nameA.localeCompare(nameB, 'ro');
    }
    // 'recent' — sort by created_at descending (already default from API)
    return 0;
  });

  const getVenueTypeInfo = (venue: any) => {
    const type = venue?.type;
    if (type === 'park' || type === 'outdoor') {
      return {
        label: s('favPark'),
        bg: Colors.greenDim,
        iconColor: Colors.greenLight,
        iconBg: Colors.greenPale,
      };
    }
    if (type === 'club' || type === 'indoor') {
      return {
        label: s('favHall'),
        bg: Colors.bluePale,
        iconColor: Colors.blue,
        iconBg: Colors.bluePale,
      };
    }
    return {
      label: s('favPlace'),
      bg: Colors.greenDim,
      iconColor: Colors.greenLight,
      iconBg: Colors.greenPale,
    };
  };

  const getConditionInfo = (venue: any) => {
    const rating = venue?.venue_stats?.[0]?.avg_rating ?? venue?.venue_stats?.avg_rating;
    if (rating && rating >= 4.5) {
      return { label: s('condPro'), color: Colors.blue, dot: '#1a5080' };
    }
    if (rating && rating >= 3.5) {
      return { label: s('condGood'), color: Colors.greenLight, dot: Colors.greenLight };
    }
    return { label: s('condAvg'), color: Colors.orange, dot: Colors.orange };
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <Text style={styles.headerTitle}>{s('favorites')}</Text>
        <TouchableOpacity style={styles.sortBtn} onPress={handleToggleSort}>
          <Lucide name="arrow-up-down" size={14} color={Colors.inkMuted} />
          <Text style={styles.sortText}>{sortMode === 'recent' ? s('sortRecent') : s('sortName')}</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        {loading ? (
          <ActivityIndicator size="large" color={Colors.orangeBright} style={{ marginTop: 40 }} />
        ) : sortedFavorites.length === 0 ? (
          <View style={{ alignItems: 'center', marginTop: 40, padding: 16 }}>
            <Text style={{ fontFamily: Fonts.body, fontSize: 14, color: Colors.inkFaint }}>
              {s('noFavorites')}
            </Text>
          </View>
        ) : (
          sortedFavorites.map((fav) => {
            const venue = fav.venues;
            const typeInfo = getVenueTypeInfo(venue);
            const condInfo = getConditionInfo(venue);
            const rating = venue?.venue_stats?.[0]?.avg_rating ?? venue?.venue_stats?.avg_rating;
            const savedDate = new Date(fav.created_at).toLocaleDateString('ro-RO');

            return (
              <TouchableOpacity
                key={fav.id}
                style={styles.favCard}
                onPress={() => router.push(`/venue/${fav.venue_id}` as any)}
                accessibilityLabel={venue?.name ?? 'venue'}
              >
                <View style={[styles.favIcon, { backgroundColor: typeInfo.iconBg }]}>
                  <Lucide name="map-pin" size={22} color={typeInfo.iconColor} />
                </View>
                <View style={styles.favInfo}>
                  <Text style={styles.favName}>{venue?.name ?? s('venue')}</Text>
                  <View style={styles.favMeta}>
                    <View style={[styles.favType, { backgroundColor: typeInfo.bg }]}>
                      <Text style={styles.favTypeText}>{typeInfo.label}</Text>
                    </View>
                    <View style={[styles.conditionDot, { backgroundColor: condInfo.dot }]} />
                    <Text style={[styles.favCondition, { color: condInfo.color }]}>
                      {condInfo.label}
                    </Text>
                    {rating != null && (
                      <Text style={styles.favStars}>{'\u2605'} {Number(rating).toFixed(1)}</Text>
                    )}
                  </View>
                  <Text style={styles.favSub}>
                    {venue?.city ?? ''} {'\u00B7'} {s('saved')} {savedDate}
                  </Text>
                </View>
                <TouchableOpacity onPress={() => handleRemove(fav.venue_id)}>
                  <Lucide name="heart" size={22} color={Colors.red} />
                </TouchableOpacity>
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>

      {!hideTabBar && <TabBar activeTab="favorites" />}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.white,
    paddingBottom: 10,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerTitle: {
    fontFamily: Fonts.heading,
    fontSize: 18,
    fontWeight: '700',
    color: Colors.ink,
  },
  sortBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.bgDark,
    borderRadius: 16,
    paddingVertical: 6,
    paddingHorizontal: 10,
    gap: 4,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  sortText: {
    fontFamily: Fonts.body,
    fontSize: 12,
    fontWeight: '500',
    color: Colors.inkMuted,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingTop: 12,
    gap: 10,
  },
  favCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderRadius: 14,
    padding: 14,
    gap: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  favIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  favInfo: {
    flex: 1,
    gap: 3,
  },
  favName: {
    fontFamily: Fonts.body,
    fontSize: 15,
    fontWeight: '600',
    color: Colors.ink,
  },
  favMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  favType: {
    borderRadius: 6,
    paddingVertical: 2,
    paddingHorizontal: 6,
  },
  favTypeText: {
    fontFamily: Fonts.body,
    fontSize: 10,
    fontWeight: '600',
    color: Colors.inkMuted,
  },
  conditionDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  favCondition: {
    fontFamily: Fonts.body,
    fontSize: 11,
    fontWeight: '500',
  },
  favStars: {
    fontFamily: Fonts.body,
    fontSize: 11,
    fontWeight: '600',
    color: Colors.amber,
  },
  favSub: {
    fontFamily: Fonts.body,
    fontSize: 11,
    color: Colors.inkFaint,
  },
});
