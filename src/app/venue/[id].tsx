import { useLocalSearchParams } from 'expo-router';
import { VenueDetailScreen } from '@/src/screens';

export default function VenueRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <VenueDetailScreen venueId={id} />;
}
