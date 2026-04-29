import { useLocalSearchParams } from 'expo-router';
import { VenueEventsScreen } from '@/src/screens';

export default function VenueEventsRoute() {
  const { venueId } = useLocalSearchParams<{ venueId: string }>();
  return <VenueEventsScreen venueId={venueId} />;
}
