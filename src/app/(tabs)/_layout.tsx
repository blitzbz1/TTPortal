import { Tabs } from 'expo-router';

import { Colors } from '@/src/theme';

/** Tab navigator — publicly accessible for anonymous browsing. */
export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: Colors.green,
        tabBarInactiveTintColor: Colors.inkMuted,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Harta',
        }}
      />
    </Tabs>
  );
}
