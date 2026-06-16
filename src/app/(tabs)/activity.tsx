// F042: the resurrected activity feed (friend check-ins / reviews / moments).
// Routed as an auth-only tab (hidden via href:null when signed out — see
// (tabs)/_layout.tsx TAB_CONFIG). The screen renders its own login state.
import { ActivityFeedScreen } from '../../screens/ActivityFeedScreen';

export default function ActivityTab() {
  return <ActivityFeedScreen />;
}
