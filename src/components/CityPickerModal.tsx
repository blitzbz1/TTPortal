import React, { useMemo } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { Lucide } from '../components/Icon';
import { useTheme } from '../hooks/useTheme';
import type { ThemeColors } from '../theme';
import { Fonts, FontSize, FontWeight, Spacing, Radius, Shadows } from '../theme';
import { useI18n } from '../hooks/useI18n';
import { useCitiesQuery } from '../hooks/queries/useCitiesQuery';

interface CityPickerModalProps {
  visible: boolean;
  selectedCity: string | null;
  onSelect: (city: string | null) => void;
  onClose: () => void;
}

export function CityPickerModal({
  visible,
  selectedCity,
  onSelect,
  onClose,
}: CityPickerModalProps) {
  const { s } = useI18n();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { data: cityRows, isLoading } = useCitiesQuery();
  const cities = useMemo(
    () => (cityRows ?? []).map((c: { name: string }) => c.name),
    [cityRows],
  );
  const loading = isLoading && cities.length === 0;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <TouchableOpacity
          style={styles.backdropTouchable}
          activeOpacity={1}
          onPress={onClose}
        />
        <View style={styles.sheet}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>{s('cityModal')}</Text>
            <TouchableOpacity onPress={onClose} hitSlop={8}>
              <Lucide name="x" size={22} color={colors.textMuted} />
            </TouchableOpacity>
          </View>

          {loading ? (
            <View style={styles.loader}>
              <ActivityIndicator size="large" color={colors.primary} />
            </View>
          ) : (
            <ScrollView bounces={false}>
              {/* "All" option */}
              <TouchableOpacity
                style={styles.row}
                onPress={() => onSelect(null)}
                activeOpacity={0.6}
              >
                <Text
                  style={[
                    styles.rowText,
                    selectedCity === null && styles.rowTextSelected,
                  ]}
                >
                  {s('allRomania')}
                </Text>
                {selectedCity === null && (
                  <Lucide name="check" size={20} color={colors.primaryLight} />
                )}
              </TouchableOpacity>

              {/* City rows */}
              {cities.map((city) => (
                <TouchableOpacity
                  key={city}
                  style={styles.row}
                  onPress={() => onSelect(city)}
                  activeOpacity={0.6}
                >
                  <Text
                    style={[
                      styles.rowText,
                      selectedCity === city && styles.rowTextSelected,
                    ]}
                  >
                    {city}
                  </Text>
                  {selectedCity === city && (
                    <Lucide name="check" size={20} color={colors.primaryLight} />
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

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: colors.overlay,
      justifyContent: 'flex-end',
      alignItems: 'center',
    },
    backdropTouchable: {
      flex: 1,
    },
    sheet: {
      backgroundColor: colors.bgAlt,
      borderTopLeftRadius: Radius.xl,
      borderTopRightRadius: Radius.xl,
      maxHeight: '70%',
      width: '100%',
      maxWidth: 430,
      paddingBottom: Spacing.xxl,
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
    loader: {
      paddingVertical: 40,
      alignItems: 'center',
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: Spacing.lg,
      paddingVertical: 14,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.borderLight,
    },
    rowText: {
      fontSize: 15,
      fontFamily: Fonts.body,
      color: colors.text,
    },
    rowTextSelected: {
      fontWeight: FontWeight.semibold,
      color: colors.primary,
    },
  });
}
