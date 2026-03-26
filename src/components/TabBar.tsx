import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Lucide } from './Icon';
import { Colors, Fonts } from '../theme';

export type TabKey = 'map' | 'events' | 'leaderboard' | 'favorites' | 'profile';

interface TabBarProps {
  activeTab: TabKey;
  onTabPress?: (tab: TabKey) => void;
}

const TABS: { key: TabKey; icon: string; label: string }[] = [
  { key: 'map', icon: 'map', label: 'Hartă' },
  { key: 'events', icon: 'calendar', label: 'Evenimente' },
  { key: 'leaderboard', icon: 'trophy', label: 'Clasament' },
  { key: 'favorites', icon: 'heart', label: 'Favorite' },
  { key: 'profile', icon: 'user', label: 'Profil' },
];

export function TabBar({ activeTab, onTabPress }: TabBarProps) {
  return (
    <View style={styles.container}>
      {TABS.map((tab) => {
        const isActive = activeTab === tab.key;
        return (
          <TouchableOpacity
            key={tab.key}
            style={styles.tab}
            onPress={() => onTabPress?.(tab.key)}
            activeOpacity={0.7}
          >
            <Lucide
              name={tab.icon}
              size={22}
              color={isActive ? Colors.green : Colors.inkFaint}
            />
            <Text
              style={[
                styles.label,
                isActive && styles.labelActive,
              ]}
            >
              {tab.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    height: 56,
    backgroundColor: Colors.white,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingTop: 4,
    paddingBottom: 8,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  label: {
    fontFamily: Fonts.body,
    fontSize: 10,
    fontWeight: '500',
    color: Colors.inkFaint,
  },
  labelActive: {
    color: Colors.green,
    fontWeight: '600',
  },
});
