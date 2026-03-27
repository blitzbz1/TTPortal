import { FavoritesScreen } from '@/src/screens';
import { useAuthGuard } from '@/src/hooks/useAuthGuard';

export default function FavoritesTab() {
  const authed = useAuthGuard();
  if (!authed) return null;
  return <FavoritesScreen hideTabBar />;
}
