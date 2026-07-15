import { useLocalSearchParams, useRouter } from 'expo-router';
import { View } from 'react-native';
import { WriteEventFeedbackScreen } from '@/src/screens/WriteEventFeedbackScreen';
import { useTheme } from '@/src/hooks/useTheme';

export default function EventFeedbackRoute() {
  const { eventId } = useLocalSearchParams<{ eventId: string }>();
  const router = useRouter();
  const { colors } = useTheme();

  const parsedId = eventId ? Number(eventId) : null;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <WriteEventFeedbackScreen
        visible={true}
        eventId={Number.isFinite(parsedId) ? parsedId : null}
        onDismiss={() => router.back()}
      />
    </View>
  );
}
