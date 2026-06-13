import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Pressable, ActivityIndicator } from 'react-native';
import { Lucide } from '../Icon';
import { useTheme } from '../../hooks/useTheme';
import { useI18n } from '../../hooks/useI18n';
import type { ThemeColors } from '../../theme';
import { Fonts, FontSize, Radius, Shadows } from '../../theme';
import type { NominatimSuggestion } from '../../hooks/useAddressPicker';

interface SuggestionsListProps {
  visible: boolean;
  searching: boolean;
  suggestions: NominatimSuggestion[];
  onSelect: (item: NominatimSuggestion) => void;
}

/**
 * Dropdown under the address input: spinner while the debounced search is
 * in flight, then the ranked Nominatim suggestions. Shared by every
 * platform variant of AddressPickerField.
 */
export function SuggestionsList({ visible, searching, suggestions, onSelect }: SuggestionsListProps) {
  const { colors } = useTheme();
  const { s } = useI18n();
  const styles = useMemo(() => createStyles(colors), [colors]);

  if (!visible) return null;

  return (
    <View style={styles.suggestionsWrap}>
      {searching && suggestions.length === 0 ? (
        <View style={styles.suggestionLoading}>
          <ActivityIndicator size="small" color={colors.primaryMid} />
          <Text style={styles.suggestionLoadingText}>{s('searching') || 'Searching...'}</Text>
        </View>
      ) : (
        suggestions.map((item, idx) => (
          <Pressable
            key={`${item.lat}-${item.lon}`}
            style={({ pressed }) => [
              styles.suggestionItem,
              pressed && styles.suggestionItemPressed,
              idx < suggestions.length - 1 && styles.suggestionBorder,
            ]}
            onPress={() => onSelect(item)}
          >
            <View style={{ marginTop: 2 }}>
              <Lucide name="map-pin" size={14} color={colors.primaryMid} />
            </View>
            <Text style={styles.suggestionText} numberOfLines={2}>{item.display_name}</Text>
          </Pressable>
        ))
      )}
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    suggestionsWrap: {
      backgroundColor: colors.bgAlt,
      borderRadius: Radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      maxHeight: 200,
      overflow: 'hidden',
      marginTop: 6,
      ...Shadows.md,
    },
    suggestionItem: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 8,
      paddingHorizontal: 12,
      paddingVertical: 10,
    },
    suggestionItemPressed: {
      backgroundColor: colors.bgMuted,
    },
    suggestionBorder: {
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    suggestionText: {
      flex: 1,
      fontFamily: Fonts.body,
      fontSize: FontSize.sm,
      color: colors.textMuted,
    },
    suggestionLoading: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingHorizontal: 12,
      paddingVertical: 10,
    },
    suggestionLoadingText: {
      fontFamily: Fonts.body,
      fontSize: FontSize.sm,
      color: colors.textFaint,
    },
  });
}
