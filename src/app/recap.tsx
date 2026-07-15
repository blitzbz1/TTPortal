// F052: /recap — the deep-link target for the Monday "Your week in TT" push
// (notification data.screen === '/recap', with an optional `week` ISO date).
import { useLocalSearchParams } from 'expo-router';
import { WeeklyRecapScreen } from '@/src/screens';
import { useAuthGuard } from '@/src/hooks/useAuthGuard';

export default function RecapRoute() {
  const authed = useAuthGuard();
  const { week } = useLocalSearchParams<{ week?: string }>();
  if (!authed) return null;
  return <WeeklyRecapScreen weekStart={typeof week === 'string' ? week : undefined} />;
}
