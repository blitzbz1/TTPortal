import { ProfileScreen } from '@/src/screens';
import { useAuthGuard } from '@/src/hooks/useAuthGuard';

export default function ProfileTab() {
  const authed = useAuthGuard();
  if (!authed) return null;
  return <ProfileScreen hideTabBar />;
}
