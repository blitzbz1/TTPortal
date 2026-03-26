import { StyleSheet, Text, View } from 'react-native';

import { Colors } from '@/src/theme';

/** Favorites tab — placeholder until favorites implementation. */
export default function FavoritesScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Favorite</Text>
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
