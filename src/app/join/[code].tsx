import { useLocalSearchParams } from 'expo-router';
import { JoinReferralScreen } from '../../screens/JoinReferralScreen';

export default function JoinRoute() {
  const { code } = useLocalSearchParams<{ code: string }>();
  return <JoinReferralScreen code={code} />;
}
