import { StyleSheet, Text, View } from 'react-native';

import { Colors } from '@/src/theme';

/** Map tab — placeholder until map implementation. */
export default function MapScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>TTPortal</Text>
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
