import { useLocalSearchParams } from 'expo-router';
import { CityGuideScreen } from '@/src/screens/CityGuideScreen';

// Public, anon-readable city guide (F015). Outside the (protected) group so it
// renders for logged-out web visitors pre-install.
export default function CityRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <CityGuideScreen cityId={id} />;
}
