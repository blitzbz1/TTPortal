// F012: structured amenities / fees / access on venue detail. Each row shows
// ✓ / ✗ / "unknown — tell us"; unknown rows (and the footer) open the existing
// Suggest-an-Edit modal so the value flows through the moderation queue.
import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Lucide } from './Icon';
import { Card } from './Card';
import { useTheme } from '../hooks/useTheme';
import { useI18n } from '../hooks/useI18n';
import type { ThemeColors } from '../theme';
import { Fonts, FontSize, FontWeight, Spacing } from '../theme';
import {
  AMENITY_KEYS,
  AMENITY_LABEL_KEYS,
  ENTRY_FEE_LABEL_KEYS,
  type VenueAmenities,
} from '../lib/amenities';

interface Props {
  amenities: VenueAmenities | null | undefined;
  /** Opens the Suggest-an-Edit modal (handles signed-out bounce). */
  onSuggestEdit: () => void;
}

export function VenueAmenitiesGrid({ amenities, onSuggestEdit }: Props) {
  const { colors } = useTheme();
  const { s } = useI18n();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const a = amenities ?? {};

  const renderStatus = (value: boolean | null | undefined, testID: string) => {
    if (value === true) {
      return (
        <View style={styles.statusRow}>
          <Lucide name="check" size={15} color={colors.primaryLight} />
        </View>
      );
    }
    if (value === false) {
      return (
        <View style={styles.statusRow}>
          <Lucide name="x" size={15} color={colors.textFaint} />
        </View>
      );
    }
    return (
      <TouchableOpacity
        onPress={onSuggestEdit}
        accessibilityRole="button"
        testID={testID}
        hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
      >
        <Text style={styles.tellUs}>{s('amenityUnknownTellUs')}</Text>
      </TouchableOpacity>
    );
  };

  return (
    <Card shadow="sm" borderRadius={0} style={styles.section}>
      <View style={styles.titleRow}>
        <Lucide name="list-checks" size={16} color={colors.textMuted} />
        <Text style={styles.title}>{s('amenitiesTitle')}</Text>
      </View>

      {AMENITY_KEYS.map((key) => (
        <View key={key} style={styles.row}>
          <Text style={styles.label}>{s(AMENITY_LABEL_KEYS[key])}</Text>
          {renderStatus(a[key], `amenity-unknown-${key}`)}
        </View>
      ))}

      {/* Entry fee — a value, not a boolean. */}
      <View style={styles.row}>
        <Text style={styles.label}>{s('amenityEntryLabel')}</Text>
        {a.entry_fee ? (
          <Text style={styles.value}>{s(ENTRY_FEE_LABEL_KEYS[a.entry_fee])}</Text>
        ) : (
          <TouchableOpacity onPress={onSuggestEdit} accessibilityRole="button" testID="amenity-unknown-entry_fee">
            <Text style={styles.tellUs}>{s('amenityUnknownTellUs')}</Text>
          </TouchableOpacity>
        )}
      </View>
    </Card>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    section: { backgroundColor: colors.bgAlt, padding: Spacing.md, gap: 8 },
    titleRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 },
    title: {
      fontFamily: Fonts.body,
      fontSize: FontSize.md,
      fontWeight: FontWeight.semibold,
      color: colors.text,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 4,
    },
    label: { fontFamily: Fonts.body, fontSize: FontSize.md, color: colors.textMuted, flex: 1 },
    value: {
      fontFamily: Fonts.body,
      fontSize: FontSize.md,
      fontWeight: FontWeight.semibold,
      color: colors.text,
    },
    statusRow: { flexDirection: 'row', alignItems: 'center' },
    tellUs: {
      fontFamily: Fonts.body,
      fontSize: FontSize.sm,
      fontWeight: FontWeight.medium,
      color: colors.primaryMid,
    },
  });
}
