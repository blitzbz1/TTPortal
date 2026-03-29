import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { Lucide } from './Icon';
import { Colors, Fonts, Radius } from '../theme';
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
      <View style={styles.backdrop}>
        <TouchableOpacity style={styles.backdropTouchable} activeOpacity={1} onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.title}>Alege locația</Text>
            <TouchableOpacity onPress={onClose} hitSlop={8}>
              <Lucide name="x" size={22} color={Colors.inkMuted} />
            </TouchableOpacity>
          </View>

          <View style={styles.searchRow}>
            <Lucide name="search" size={18} color={Colors.inkFaint} />
            <TextInput
              style={styles.searchInput}
              placeholder="Caută locație..."
              placeholderTextColor={Colors.inkFaint}
              value={query}
              onChangeText={setQuery}
              autoCorrect={false}
            />
          </View>

          {loading ? (
            <View style={styles.loader}>
              <ActivityIndicator size="large" color={Colors.green} />
            </View>
          ) : venues.length === 0 ? (
            <View style={styles.loader}>
              <Text style={styles.emptyText}>Nicio locație găsită</Text>
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
                    <Lucide name="check" size={20} color={Colors.greenLight} />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  backdropTouchable: { flex: 1 },
  sheet: {
    backgroundColor: Colors.white,
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    maxHeight: '70%',
    paddingBottom: 32,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    fontFamily: Fonts.heading,
    color: Colors.ink,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 20,
    marginVertical: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: Colors.bgDark,
    borderRadius: Radius.md,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontFamily: Fonts.body,
    fontSize: 14,
    color: Colors.ink,
    padding: 0,
  },
  loader: { paddingVertical: 40, alignItems: 'center' },
  emptyText: { fontFamily: Fonts.body, fontSize: 14, color: Colors.inkFaint },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.borderLight,
  },
  rowContent: { flex: 1 },
  rowText: { fontSize: 15, fontFamily: Fonts.body, color: Colors.ink },
  rowTextSelected: { fontWeight: '600', color: Colors.green },
  rowSubtext: { fontSize: 13, fontFamily: Fonts.body, color: Colors.inkFaint, marginTop: 2 },
});
