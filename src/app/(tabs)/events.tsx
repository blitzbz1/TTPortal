import { StyleSheet, Text, View } from 'react-native';

import { Colors } from '@/src/theme';

/** Events tab — placeholder until events implementation. */
export default function EventsScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Evenimente</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.bg,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.ink,
  },
});
