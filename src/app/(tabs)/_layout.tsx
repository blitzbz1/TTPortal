import React, { useMemo } from 'react';
import { Tabs } from 'expo-router';
import { Lucide } from '../../components/Icon';
import { Fonts } from '../../theme';
import { useTheme } from '../../hooks/useTheme';
import { useSession } from '../../hooks/useSession';
import { useI18n } from '../../hooks/useI18n';

const TAB_ICON_SIZE = 22;

const TAB_CONFIG = [
  { name: 'index', labelKey: 'tabMap', icon: 'map', authOnly: false },
  { name: 'events', labelKey: 'tabEvents', icon: 'calendar', authOnly: false },
  { name: 'leaderboard', labelKey: 'tabLeaderboard', icon: 'trophy', authOnly: true },
  { name: 'favorites', labelKey: 'tabFavorites', icon: 'heart', authOnly: true },
  { name: 'profile', labelKey: 'tabProfile', icon: 'user', authOnly: true, hidden: true },
] as const;

export default function TabLayout() {
  const { session } = useSession();
  const { colors } = useTheme();
  const { s } = useI18n();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textFaint,
        tabBarStyle: {
          backgroundColor: colors.bgAlt,
          borderTopColor: colors.border,
        },
        tabBarLabelStyle: {
          fontFamily: Fonts.body,
          fontSize: 10,
          fontWeight: '500',
        },
      }}
    >
      {TAB_CONFIG.map((tab) => (
        <Tabs.Screen
          key={tab.name}
          name={tab.name}
          options={{
            title: s(tab.labelKey),
            tabBarAccessibilityLabel: s(tab.labelKey),
            tabBarIcon: ({ color }: { color: string }) => (
              <Lucide name={tab.icon} size={TAB_ICON_SIZE} color={color} />
            ),
            href: ('hidden' in tab && tab.hidden) || (tab.authOnly && !session) ? null : undefined,
          } as any}
        />
      ))}
    </Tabs>
  );
}
