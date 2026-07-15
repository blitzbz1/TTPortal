import { useLocalSearchParams } from 'expo-router';
import { PlayerProfileScreen } from '@/src/screens';

export default function PlayerProfileRoute() {
  const { userId, logMatch } = useLocalSearchParams<{ userId: string; logMatch?: string }>();
  return <PlayerProfileScreen userId={userId} autoLogMatch={logMatch === '1'} />;
}
