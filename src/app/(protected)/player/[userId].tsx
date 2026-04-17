import { useLocalSearchParams } from 'expo-router';
import { PlayerProfileScreen } from '@/src/screens';

export default function PlayerProfileRoute() {
  const { userId } = useLocalSearchParams<{ userId: string }>();
  return <PlayerProfileScreen userId={userId} />;
}
