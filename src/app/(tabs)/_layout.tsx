import React from 'react';
import { Tabs } from 'expo-router';
import { Lucide } from '../../components/Icon';
import { Fonts } from '../../theme';
import { useTheme } from '../../hooks/useTheme';
import { useSession } from '../../hooks/useSession';

const TAB_CONFIG = [
  { name: 'index', label: 'Hartă', icon: 'map', authOnly: false },
  { name: 'events', label: 'Evenimente', icon: 'calendar', authOnly: false },
  { name: 'leaderboard', label: 'Clasament', icon: 'trophy', authOnly: true },
  { name: 'favorites', label: 'Favorite', icon: 'heart', authOnly: true },
  { name: 'profile', label: 'Profil', icon: 'user', authOnly: true, hidden: true },
] as const;

const TAB_ICON_SIZE = 22;

export default function TabLayout() {
  const { session } = useSession();
  const { colors } = useTheme();

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
            title: tab.label,
            tabBarAccessibilityLabel: tab.label,
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
