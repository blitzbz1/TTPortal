import React, { useState, useCallback } from 'react';
import { View, Text, TextInput, Pressable, ScrollView, StyleSheet, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useSession } from '@/src/hooks/useSession';
import { createEvent } from '@/src/services/events';
import { Colors, Fonts, Radius } from '@/src/theme';

export default function CreateEventRoute() {
  const router = useRouter();
  const { user } = useSession();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);

  const handleCreate = useCallback(async () => {
    if (!title.trim() || !user) return;
    setLoading(true);
    const { error } = await createEvent({
      title: title.trim(),
      description: description.trim() || null,
      organizer_id: user.id,
      starts_at: new Date(Date.now() + 86400000).toISOString(), // tomorrow
      max_participants: 6,
    });
    setLoading(false);
    if (error) {
      Alert.alert('Eroare', 'Nu s-a putut crea evenimentul.');
      return;
    }
    router.back();
  }, [title, description, user, router]);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.header}>Creează eveniment</Text>
      <TextInput
        style={styles.input}
        placeholder="Titlu eveniment"
        placeholderTextColor={Colors.inkFaint}
        value={title}
        onChangeText={setTitle}
      />
      <TextInput
        style={[styles.input, styles.textArea]}
        placeholder="Descriere (opțional)"
        placeholderTextColor={Colors.inkFaint}
        value={description}
        onChangeText={setDescription}
        multiline
        numberOfLines={3}
      />
      <Pressable
        style={[styles.btn, loading && { opacity: 0.6 }]}
        onPress={handleCreate}
        disabled={loading}
      >
        <Text style={styles.btnText}>{loading ? 'Se creează...' : 'Creează →'}</Text>
      </Pressable>
      <Pressable onPress={() => router.back()} style={styles.cancelBtn}>
        <Text style={styles.cancelText}>Anulează</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  content: { padding: 24, gap: 16 },
  header: { fontFamily: Fonts.heading, fontSize: 24, fontWeight: '800', color: Colors.ink },
  input: {
    backgroundColor: Colors.white,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 14,
    fontFamily: Fonts.body,
    fontSize: 14,
    color: Colors.ink,
  },
  textArea: { height: 80, textAlignVertical: 'top' },
  btn: {
    backgroundColor: Colors.greenLight,
    borderRadius: 12,
    height: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnText: { fontFamily: Fonts.body, fontSize: 16, fontWeight: '700', color: Colors.white },
  cancelBtn: { alignItems: 'center', paddingVertical: 12 },
  cancelText: { fontFamily: Fonts.body, fontSize: 14, color: Colors.inkFaint },
});
