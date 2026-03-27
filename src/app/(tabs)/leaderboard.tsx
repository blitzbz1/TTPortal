import { LeaderboardsScreen } from '@/src/screens';
import { useAuthGuard } from '@/src/hooks/useAuthGuard';

export default function LeaderboardTab() {
  const authed = useAuthGuard();
  if (!authed) return null;
  return <LeaderboardsScreen hideTabBar />;
}
