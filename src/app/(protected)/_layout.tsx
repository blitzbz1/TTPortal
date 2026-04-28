import { Stack } from 'expo-router';
import { useAuthGuard } from '../../hooks/useAuthGuard';

export default function ProtectedLayout() {
  const authed = useAuthGuard();
  if (!authed) return null;

  return (
    <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
      <Stack.Screen name="add-venue" />
      <Stack.Screen name="review/[venueId]" options={{ animation: 'slide_from_bottom' }} />
      <Stack.Screen name="condition-vote/[venueId]" options={{ animation: 'slide_from_bottom' }} />
      <Stack.Screen name="friends" />
      <Stack.Screen name="play-history" />
      <Stack.Screen name="equipment" />
      <Stack.Screen name="favorites" />
      <Stack.Screen name="admin" />
      <Stack.Screen name="create-event" options={{ animation: 'slide_from_bottom' }} />
      <Stack.Screen name="settings" />
      <Stack.Screen name="leaderboard" />
      <Stack.Screen name="player/[userId]" />
      <Stack.Screen name="event-feedback/[eventId]" options={{ animation: 'slide_from_bottom' }} />
    </Stack>
  );
}
