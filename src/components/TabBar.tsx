import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Lucide } from './Icon';
import { Colors, Fonts } from '../theme';
import { useI18n } from '../hooks/useI18n';
import { useSession } from '../hooks/useSession';

export type TabKey = 'map' | 'events' | 'leaderboard' | 'favorites' | 'profile';

const AUTH_ONLY_TABS: Set<TabKey> = new Set(['leaderboard', 'favorites', 'profile']);

interface TabBarProps {
  activeTab: TabKey;
  onTabPress?: (tab: TabKey) => void;
}

export function TabBar({ activeTab, onTabPress }: TabBarProps) {
  const { s } = useI18n();
  const { session } = useSession();

  const ALL_TABS: { key: TabKey; icon: string; label: string }[] = [
    { key: 'map', icon: 'map', label: s('tabMap') },
    { key: 'events', icon: 'calendar', label: s('tabEvents') },
    { key: 'leaderboard', icon: 'trophy', label: s('tabLeaderboard') },
    { key: 'favorites', icon: 'heart', label: s('tabFavorites') },
  ];

  const TABS = useMemo(
    () => session ? ALL_TABS : ALL_TABS.filter((t) => !AUTH_ONLY_TABS.has(t.key)),
    [session, ALL_TABS],
  );
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
