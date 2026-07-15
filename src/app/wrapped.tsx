// F054: /wrapped — the swipeable "TT Wrapped" year-in-review story, opened from
// the Profile banner (Dec 15 – Jan 15) or the mid-December teaser push
// (notification data.screen === '/(tabs)/profile', with an optional `year`).
import { useLocalSearchParams } from 'expo-router';
import { WrappedStoryScreen } from '@/src/screens';
import { useAuthGuard } from '@/src/hooks/useAuthGuard';

export default function WrappedRoute() {
  const authed = useAuthGuard();
  const { year } = useLocalSearchParams<{ year?: string }>();
  if (!authed) return null;
  const parsed = typeof year === 'string' ? Number(year) : NaN;
  return <WrappedStoryScreen year={Number.isFinite(parsed) ? parsed : undefined} />;
}
