import { Stack } from 'expo-router';
import { useAuthGuard } from '../../hooks/useAuthGuard';

export default function ProtectedLayout() {
  const authed = useAuthGuard();
  if (!authed) return null;

  return (
    <Stack>
      <Stack.Screen name="add-venue" options={{ headerShown: false }} />
      <Stack.Screen name="review/[venueId]" options={{ headerShown: false }} />
      <Stack.Screen name="condition-vote/[venueId]" options={{ headerShown: false }} />
      <Stack.Screen name="friends" options={{ headerShown: false }} />
      <Stack.Screen name="play-history" options={{ headerShown: false }} />
      <Stack.Screen name="admin" options={{ headerShown: false }} />
      <Stack.Screen name="create-event" options={{ headerShown: false }} />
      <Stack.Screen name="notifications" options={{ headerShown: false }} />
    </Stack>
  );
}
