import { useLocalSearchParams } from 'expo-router';
import { WriteReviewScreen } from '@/src/screens';

export default function ReviewRoute() {
  const { venueId } = useLocalSearchParams<{ venueId: string }>();
  return <WriteReviewScreen venueId={venueId} />;
}
