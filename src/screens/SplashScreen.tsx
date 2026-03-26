import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Lucide } from '../components/Icon';
import { Colors, Fonts, Radius } from '../theme';

const CITIES = [
  { name: 'București', count: '54' },
  { name: 'Cluj-Napoca', count: '23' },
  { name: 'Timișoara', count: '19' },
  { name: 'Iași', count: '15' },
  { name: 'Brașov', count: '12' },
  { name: 'Constanța', count: '11' },
  { name: 'Craiova', count: '8' },
  { name: 'Oradea', count: '7' },
];

export function SplashScreen() {
  return (
    <View style={styles.container}>
      <View style={styles.content}>
        {/* Top */}
        <View style={styles.top}>
          <View style={styles.badge}>
            <Text style={styles.badgeEmoji}>{'\uD83C\uDFD3'}</Text>
            <Text style={styles.badgeText}>Mese Tenis Rom&#226;nia</Text>
          </View>
          <Text style={styles.title}>TT PORTAL</Text>
          <Text style={styles.subtitle}>
            G&#259;se&#537;te o mas&#259; de tenis{'\n'}&#238;n Rom&#226;nia
          </Text>
        </View>

        {/* Middle */}
        <View style={styles.middle}>
          <TouchableOpacity style={styles.locationBtn}>
            <Lucide name="locate" size={20} color={Colors.green} />
            <Text style={styles.locationText}>Folose&#537;te loca&#539;ia mea</Text>
          </TouchableOpacity>

          <Text style={styles.orText}>sau alege un ora&#537;</Text>

          <View style={styles.cityGrid}>
            <View style={styles.cityColumn}>
              {CITIES.slice(0, 4).map((city) => (
                <TouchableOpacity key={city.name} style={styles.cityRow}>
                  <Text style={styles.cityName}>{city.name}</Text>
                  <Text style={styles.cityCount}>{city.count}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={styles.cityColumn}>
              {CITIES.slice(4).map((city) => (
                <TouchableOpacity key={city.name} style={styles.cityRow}>
                  <Text style={styles.cityName}>{city.name}</Text>
                  <Text style={styles.cityCount}>{city.count}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>

        {/* Bottom */}
        <View style={styles.bottom}>
          <TouchableOpacity style={styles.langActive}>
            <Text style={styles.langActiveText}>RO</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.langInactive}>
            <Text style={styles.langInactiveText}>EN</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.green,
  },
  content: {
    flex: 1,
    justifyContent: 'space-between',
    paddingTop: 60,
    paddingBottom: 32,
    paddingHorizontal: 28,
  },
  top: {
    alignItems: 'center',
    gap: 12,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff18',
    borderRadius: 100,
    paddingVertical: 6,
    paddingHorizontal: 14,
    gap: 8,
  },
  badgeEmoji: {
    fontSize: 16,
  },
  badgeText: {
    fontFamily: Fonts.body,
    fontSize: 13,
    fontWeight: '500',
    color: '#ffffffcc',
  },
  title: {
    fontFamily: Fonts.heading,
    fontSize: 34,
    fontWeight: '800',
    color: Colors.white,
    letterSpacing: 2,
  },
  subtitle: {
    fontFamily: Fonts.body,
    fontSize: 17,
    color: '#ffffffbb',
    textAlign: 'center',
    lineHeight: 17 * 1.45,
  },
  middle: {
    alignItems: 'center',
    gap: 24,
  },
  locationBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.white,
    borderRadius: 14,
    height: 52,
    gap: 10,
    width: '100%',
  },
  locationText: {
    fontFamily: Fonts.body,
    fontSize: 15,
    fontWeight: '600',
    color: Colors.green,
  },
  orText: {
    fontFamily: Fonts.body,
    fontSize: 13,
    color: '#ffffff80',
  },
  cityGrid: {
    flexDirection: 'row',
    gap: 10,
    width: '100%',
  },
  cityColumn: {
    flex: 1,
    gap: 8,
  },
  cityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#ffffff14',
    borderRadius: Radius.md,
    height: 44,
    paddingHorizontal: 14,
  },
  cityName: {
    fontFamily: Fonts.body,
    fontSize: 13,
    fontWeight: '500',
    color: Colors.white,
  },
  cityCount: {
    fontFamily: Fonts.body,
    fontSize: 12,
    color: '#ffffff66',
  },
  bottom: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 4,
  },
  langActive: {
    backgroundColor: '#ffffff20',
    borderRadius: 100,
    paddingVertical: 6,
    paddingHorizontal: 14,
  },
  langActiveText: {
    fontFamily: Fonts.body,
    fontSize: 12,
    fontWeight: '600',
    color: Colors.white,
  },
  langInactive: {
    borderRadius: 100,
    paddingVertical: 6,
    paddingHorizontal: 14,
  },
  langInactiveText: {
    fontFamily: Fonts.body,
    fontSize: 12,
    fontWeight: '500',
    color: '#ffffff66',
  },
});
