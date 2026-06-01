import { useLocalSearchParams } from 'expo-router';
import { ConditionVotingScreen } from '@/src/screens';

export default function ConditionVoteRoute() {
  const { venueId } = useLocalSearchParams<{ venueId: string }>();
  return <ConditionVotingScreen venueId={venueId} />;
}
