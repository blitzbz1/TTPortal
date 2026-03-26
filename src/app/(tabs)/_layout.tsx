import React from 'react';
import { Tabs } from 'expo-router';
import { Lucide } from '../../components/Icon';
import { HeaderProfileIcon } from '../../components/HeaderProfileIcon';
import { Colors, Fonts } from '../../theme';

/**
 * Tab configuration matching the existing TabBar.tsx design.
 * Each entry maps a file-based route name to its label and icon.
 */
const TAB_CONFIG = [
  { name: 'index', label: 'Hartă', icon: 'map' },
  { name: 'events', label: 'Evenimente', icon: 'calendar' },
  { name: 'leaderboard', label: 'Clasament', icon: 'trophy' },
  { name: 'favorites', label: 'Favorite', icon: 'heart' },
  { name: 'profile', label: 'Profil', icon: 'user' },
] as const;

/** Icon size matching the existing TabBar component. */
const TAB_ICON_SIZE = 22;

/**
 * Tab navigator layout — publicly accessible for anonymous browsing.
 * Configures 5 tabs (Harta, Evenimente, Clasament, Favorite, Profil)
 * with dark green active color and muted gray inactive color.
 * Includes HeaderProfileIcon in the header-right area.
 */
export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: Colors.green,
        tabBarInactiveTintColor: Colors.inkFaint,
        tabBarLabelStyle: {
          fontFamily: Fonts.body,
          fontSize: 10,
          fontWeight: '500',
        },
        headerRight: () => <HeaderProfileIcon />,
      }}
    >
      {TAB_CONFIG.map((tab) => (
        <Tabs.Screen
          key={tab.name}
          name={tab.name}
          options={{
            title: tab.label,
            tabBarIcon: ({ color }) => (
              <Lucide name={tab.icon} size={TAB_ICON_SIZE} color={color} />
            ),
          }}
        />
      ))}
    </Tabs>
  );
}
