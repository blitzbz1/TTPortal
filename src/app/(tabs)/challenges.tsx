import { ChallengeScreen } from '@/src/screens';
import { useAuthGuard } from '@/src/hooks/useAuthGuard';

export default function ChallengesTab() {
  const authed = useAuthGuard();
  if (!authed) return null;
  return <ChallengeScreen hideTabBar />;
}
