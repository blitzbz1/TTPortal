import React, { useState, useEffect, useMemo } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Lucide } from './Icon';
import { useTheme } from '../hooks/useTheme';
import { useI18n } from '../hooks/useI18n';
import type { ThemeColors } from '../theme';
import { Fonts, FontSize, FontWeight, Spacing, Radius, Shadows } from '../theme';
import { getVenues, searchVenues } from '../services/venues';

interface VenueOption {
  id: number;
  name: string;
  city: string | null;
  type: string;
}

interface VenuePickerModalProps {
  visible: boolean;
  selectedVenueId: number | null;
  onSelect: (venue: VenueOption | null) => void;
  onClose: () => void;
}

export function VenuePickerModal({
  visible,
  selectedVenueId,
  onSelect,
  onClose,
}: VenuePickerModalProps) {
  const { colors } = useTheme();
  const { s } = useI18n();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [venues, setVenues] = useState<VenueOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;

    async function fetch() {
      setLoading(true);
      const result = query.trim()
        ? await searchVenues(query.trim())
        : await getVenues();
      if (!cancelled && result.data) {
        setVenues(result.data.map((v) => ({ id: v.id, name: v.name, city: v.city, type: v.type })));
      }
      if (!cancelled) setLoading(false);
    }

    const timeout = setTimeout(fetch, query ? 300 : 0);
    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [visible, query]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.backdrop} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <TouchableOpacity style={styles.backdropTouchable} activeOpacity={1} onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.title}>{s('venuePickerTitle')}</Text>
            <TouchableOpacity onPress={onClose} hitSlop={8}>
              <Lucide name="x" size={22} color={colors.textMuted} />
            </TouchableOpacity>
          </View>

          <View style={styles.searchRow}>
            <Lucide name="search" size={18} color={colors.textFaint} />
            <TextInput
              style={styles.searchInput}
              placeholder={s('venuePickerSearch')}
              placeholderTextColor={colors.textFaint}
              value={query}
              onChangeText={setQuery}
              autoCorrect={false}
            />
          </View>

          {loading ? (
            <View style={styles.loader}>
              <ActivityIndicator size="large" color={colors.primary} />
            </View>
          ) : venues.length === 0 ? (
            <View style={styles.loader}>
              <Text style={styles.emptyText}>{s('venuePickerEmpty')}</Text>
            </View>
          ) : (
            <ScrollView bounces={false}>
              {venues.map((venue) => (
                <TouchableOpacity
                  key={venue.id}
                  style={styles.row}
                  onPress={() => onSelect(venue)}
                  activeOpacity={0.6}
                >
                  <View style={styles.rowContent}>
                    <Text
                      style={[
                        styles.rowText,
                        selectedVenueId === venue.id && styles.rowTextSelected,
                      ]}
                    >
                      {venue.name}
                    </Text>
                    {venue.city && (
                      <Text style={styles.rowSubtext}>{venue.city}</Text>
                    )}
                  </View>
                  {selectedVenueId === venue.id && (
                    <Lucide name="check" size={20} color={colors.primaryLight} />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: colors.overlay,
      justifyContent: 'flex-end',
      alignItems: 'center',
    },
    backdropTouchable: { flex: 1 },
    sheet: {
      backgroundColor: colors.bgAlt,
      borderTopLeftRadius: Radius.xl,
      borderTopRightRadius: Radius.xl,
      maxHeight: '70%',
      paddingBottom: Spacing.xxl,
      width: '100%',
      maxWidth: 430,
      ...Shadows.lg,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: Spacing.lg,
      paddingVertical: Spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    title: {
      fontSize: FontSize.xxl,
      fontWeight: FontWeight.bold,
      fontFamily: Fonts.heading,
      color: colors.text,
    },
    searchRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginHorizontal: Spacing.lg,
      marginVertical: Spacing.sm,
      paddingHorizontal: Spacing.sm,
      paddingVertical: 10,
      backgroundColor: colors.bgMuted,
      borderRadius: Radius.md,
      gap: Spacing.xs,
      ...Shadows.sm,
    },
    searchInput: {
      flex: 1,
      fontFamily: Fonts.body,
      fontSize: FontSize.lg,
      color: colors.text,
      padding: 0,
    },
    loader: { paddingVertical: 40, alignItems: 'center' },
    emptyText: { fontFamily: Fonts.body, fontSize: FontSize.lg, color: colors.textFaint },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: Spacing.lg,
      paddingVertical: 14,
      marginHorizontal: 4,
      marginVertical: 2,
      borderRadius: Radius.md,
      ...Shadows.sm,
    },
    rowContent: { flex: 1 },
    rowText: { fontSize: 15, fontFamily: Fonts.body, color: colors.text },
    rowTextSelected: { fontWeight: FontWeight.semibold, color: colors.primary },
    rowSubtext: { fontSize: FontSize.md, fontFamily: Fonts.body, color: colors.textFaint, marginTop: 2 },
  });
}
