import { useLocalSearchParams } from 'expo-router';
import { MessageThreadScreen } from '@/src/screens';

export default function MessageThreadRoute() {
  const { threadId, otherName } = useLocalSearchParams<{ threadId: string; otherName?: string }>();
  return <MessageThreadScreen threadId={Number(threadId)} otherName={otherName} />;
}
