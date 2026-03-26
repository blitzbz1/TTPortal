import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { Lucide } from '../components/Icon';
import { TabBar } from '../components/TabBar';
import { Colors, Fonts, Radius } from '../theme';

const FAVORITES = [
  {
    name: 'Parcul Her\u0103str\u0103u',
    type: '\uD83C\uDF33 Parc',
    typeBg: Colors.greenDim,
    condition: 'Bun\u0103',
    conditionColor: Colors.greenLight,
    stars: '\u2605 4.3',
    sub: 'Bucure\u0219ti \u00B7 2 mese \u00B7 Salvat acum 3 zile',
    iconColor: Colors.greenLight,
    iconBg: Colors.greenPale,
  },
  {
    name: 'Ping Pong Academy',
    type: '\uD83C\uDFE2 Sal\u0103',
    typeBg: Colors.bluePale,
    condition: 'Profesional\u0103',
    conditionColor: Colors.blue,
    conditionDot: '#1a5080',
    stars: '\u2605 4.8',
    sub: 'Bucure\u0219ti \u00B7 12 mese \u00B7 Salvat acum 1 s\u0103pt\u0103m\u00e2n\u0103',
    iconColor: Colors.blue,
    iconBg: Colors.bluePale,
  },
  {
    name: 'Parcul Titan',
    type: '\uD83C\uDF33 Parc',
    typeBg: Colors.greenDim,
    condition: 'Bun\u0103',
    conditionColor: Colors.greenLight,
    stars: '\u2605 4.1',
    sub: 'Bucure\u0219ti \u00B7 6 mese \u00B7 Salvat acum 2 s\u0103pt\u0103m\u00e2ni',
    iconColor: Colors.greenLight,
    iconBg: Colors.greenPale,
  },
];

export function FavoritesScreen() {
  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Lucide name="arrow-left" size={24} color={Colors.ink} />
        <Text style={styles.headerTitle}>Favorite</Text>
        <TouchableOpacity style={styles.sortBtn}>
          <Lucide name="arrow-up-down" size={14} color={Colors.inkMuted} />
          <Text style={styles.sortText}>Recent</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        {FAVORITES.map((fav) => (
          <TouchableOpacity key={fav.name} style={styles.favCard}>
            <View style={[styles.favIcon, { backgroundColor: fav.iconBg }]}>
              <Lucide name="map-pin" size={22} color={fav.iconColor} />
            </View>
            <View style={styles.favInfo}>
              <Text style={styles.favName}>{fav.name}</Text>
              <View style={styles.favMeta}>
                <View style={[styles.favType, { backgroundColor: fav.typeBg }]}>
                  <Text style={styles.favTypeText}>{fav.type}</Text>
                </View>
                <View style={[styles.conditionDot, { backgroundColor: fav.conditionDot || fav.conditionColor }]} />
                <Text style={[styles.favCondition, { color: fav.conditionColor }]}>
                  {fav.condition}
                </Text>
                <Text style={styles.favStars}>{fav.stars}</Text>
              </View>
              <Text style={styles.favSub}>{fav.sub}</Text>
            </View>
            <Lucide name="heart" size={22} color={Colors.red} />
          </TouchableOpacity>
        ))}
      </ScrollView>

      <TabBar activeTab="favorites" />
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
    height: 52,
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
