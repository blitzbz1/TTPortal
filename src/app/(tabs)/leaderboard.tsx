import { StyleSheet, Text, View } from 'react-native';

import { Colors } from '@/src/theme';

/** Leaderboard tab — placeholder until leaderboard implementation. */
export default function LeaderboardScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Clasament</Text>
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
