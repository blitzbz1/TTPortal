import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Lucide } from '../components/Icon';
import { useTheme } from '../hooks/useTheme';
import { useI18n } from '../hooks/useI18n';
import { useEquipmentCatalogQuery } from '../hooks/queries/useEquipmentCatalogQuery';
import type { EquipmentCategory } from '../types/database';
import type { ThemeColors } from '../theme';
import { Fonts, FontSize, FontWeight, Radius, Spacing } from '../theme';

type GearTab = EquipmentCategory; // 'blade' | 'rubber'

function lc(value: string, query: string) {
  return value.toLowerCase().includes(query.trim().toLowerCase());
}

export function GearScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { s } = useI18n();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [tab, setTab] = useState<GearTab>('blade');
  const [query, setQuery] = useState('');
  const [openManufacturer, setOpenManufacturer] = useState<string | null>(null);

  const { data: bladeData, isLoading: bladeLoading } = useEquipmentCatalogQuery('blade');
  const { data: rubberData, isLoading: rubberLoading } = useEquipmentCatalogQuery('rubber');
  const catalog = useMemo(
    () => (tab === 'blade' ? bladeData ?? [] : rubberData ?? []),
    [tab, bladeData, rubberData],
  );
  const loading = (tab === 'blade' ? bladeLoading : rubberLoading) && catalog.length === 0;

  const filtered = useMemo(() => {
    const q = query.trim();
    if (!q) return catalog;
    return catalog
      .map((m) => {
        const manufacturerHit = lc(m.name, q);
        const models = manufacturerHit ? m.models : m.models.filter((mod) => lc(mod, q));
        return { ...m, models };
      })
      .filter((m) => lc(m.name, q) || m.models.length > 0);
  }, [catalog, query]);

  const openModel = (manufacturerId: string, manufacturer: string, model: string) => {
    // Model names can contain spaces/slashes — pass identity as query params on
    // a flat route rather than fragile nested path segments.
    router.push({
      pathname: '/(protected)/gear/model',
      params: { category: tab, manufacturerId, manufacturer, model },
    });
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel={s('back')}
        >
          <Lucide name="arrow-left" size={24} color={colors.text} />
        </TouchableOpacity>
        <View style={styles.headerCopy}>
          <Text style={styles.headerTitle}>{s('gearBrowseTitle')}</Text>
        </View>
        <View style={styles.headerSpacer} />
      </View>

      <View style={styles.tabs}>
        {([
          ['blade', s('equipmentBlade')],
          ['rubber', s('gearRubber')],
        ] as const).map(([key, label]) => (
          <TouchableOpacity
            key={key}
            testID={`gear-tab-${key}`}
            style={[styles.tab, tab === key && styles.tabActive]}
            onPress={() => {
              setTab(key);
              setOpenManufacturer(null);
            }}
          >
            <Text style={[styles.tabText, tab === key && styles.tabTextActive]}>{label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.searchWrap}>
        <Lucide name="search" size={16} color={colors.textFaint} />
        <TextInput
          style={styles.searchInput}
          placeholder={s('gearSearchPlaceholder')}
          placeholderTextColor={colors.textFaint}
          value={query}
          onChangeText={setQuery}
          autoCorrect={false}
          autoCapitalize="none"
        />
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 40 }} />
      ) : (
        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          {filtered.length === 0 ? (
            <Text style={styles.empty}>{s('equipmentNoMatches')}</Text>
          ) : (
            filtered.map((manufacturer) => {
              const expanded = openManufacturer === manufacturer.id || !!query.trim();
              return (
                <View key={manufacturer.id} style={styles.manufacturerBlock}>
                  <TouchableOpacity
                    testID={`gear-manufacturer-${manufacturer.id}`}
                    style={styles.manufacturerRow}
                    onPress={() =>
                      setOpenManufacturer((prev) => (prev === manufacturer.id ? null : manufacturer.id))
                    }
                  >
                    <Text style={styles.manufacturerName}>{manufacturer.name}</Text>
                    <Text style={styles.manufacturerCount}>{manufacturer.models.length}</Text>
                    <Lucide
                      name={expanded ? 'chevron-up' : 'chevron-down'}
                      size={16}
                      color={colors.textFaint}
                    />
                  </TouchableOpacity>
                  {expanded
                    ? manufacturer.models.map((model) => (
                        <TouchableOpacity
                          key={model}
                          testID={`gear-model-${manufacturer.id}-${model}`}
                          style={styles.modelRow}
                          onPress={() => openModel(manufacturer.id, manufacturer.name, model)}
                        >
                          <Text style={styles.modelName}>{model}</Text>
                          <Lucide name="chevron-right" size={16} color={colors.textFaint} />
                        </TouchableOpacity>
                      ))
                    : null}
                </View>
              );
            })
          )}
          <View style={{ height: 32 }} />
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.sm,
      gap: Spacing.sm,
    },
    backButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
    headerCopy: { flex: 1 },
    headerSpacer: { width: 40 },
    headerTitle: {
      fontFamily: Fonts.heading,
      fontSize: FontSize.display,
      fontWeight: FontWeight.bold,
      color: colors.text,
    },
    tabs: {
      flexDirection: 'row',
      gap: Spacing.xs,
      paddingHorizontal: Spacing.md,
      marginBottom: Spacing.sm,
    },
    tab: {
      flex: 1,
      alignItems: 'center',
      paddingVertical: 10,
      borderRadius: Radius.md,
      backgroundColor: colors.bgMuted,
    },
    tabActive: { backgroundColor: colors.primaryPale, borderWidth: 1, borderColor: colors.primaryDim },
    tabText: { fontFamily: Fonts.body, fontSize: FontSize.md, fontWeight: FontWeight.semibold, color: colors.textMuted },
    tabTextActive: { color: colors.primaryMid },
    searchWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginHorizontal: Spacing.md,
      marginBottom: Spacing.sm,
      paddingHorizontal: 12,
      height: 42,
      borderRadius: Radius.md,
      backgroundColor: colors.bgAlt,
      borderWidth: 1,
      borderColor: colors.border,
    },
    searchInput: { flex: 1, fontFamily: Fonts.body, fontSize: FontSize.md, color: colors.text },
    scroll: { flex: 1 },
    scrollContent: { paddingHorizontal: Spacing.md },
    empty: { fontFamily: Fonts.body, fontSize: FontSize.md, color: colors.textMuted, marginTop: 24, textAlign: 'center' },
    manufacturerBlock: { marginBottom: Spacing.xs },
    manufacturerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
      paddingVertical: 12,
      paddingHorizontal: 14,
      borderRadius: Radius.md,
      backgroundColor: colors.bgAlt,
      borderWidth: 1,
      borderColor: colors.border,
    },
    manufacturerName: { flex: 1, fontFamily: Fonts.body, fontSize: FontSize.lg, fontWeight: FontWeight.semibold, color: colors.text },
    manufacturerCount: { fontFamily: Fonts.body, fontSize: FontSize.sm, color: colors.textFaint },
    modelRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 11,
      paddingHorizontal: 14,
      marginLeft: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.borderLight,
    },
    modelName: { fontFamily: Fonts.body, fontSize: FontSize.md, color: colors.text },
  });
}
