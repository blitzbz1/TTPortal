import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  BottomSheetBackdrop,
  BottomSheetModal,
  BottomSheetTextInput,
  BottomSheetView,
} from '@gorhom/bottom-sheet';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { EquipmentSummaryCard } from '../components/EquipmentSummaryCard';
import { Lucide } from '../components/Icon';
import { useSession } from '../hooks/useSession';
import { useTheme } from '../hooks/useTheme';
import { useI18n } from '../hooks/useI18n';
import { getDateLocale } from '../contexts/I18nProvider';
import { getEquipmentHistory, saveEquipmentSelection } from '../services/equipment';
import { useEquipmentCatalogQuery } from '../hooks/queries/useEquipmentCatalogQuery';
import { loadCachedEquipmentHistory, saveCachedEquipmentHistory } from '../lib/equipmentCache';
import type {
  DominantHand,
  EquipmentManufacturer,
  EquipmentSelection,
  Grip,
  PlayingStyle,
  RubberColor,
} from '../types/database';
import type { ThemeColors } from '../theme';
import { createSelectStyles, createStyles } from './EquipmentScreen.styles';

type TabKey = 'edit' | 'current';
type EquipmentSide = 'forehand' | 'backhand';

interface PickedEquipment {
  manufacturerId: string;
  manufacturer: string;
  model: string;
}

const EMPTY_PICK: PickedEquipment = { manufacturerId: '', manufacturer: '', model: '' };

const FOREHAND_COLORS: RubberColor[] = ['red', 'black', 'pink', 'blue', 'purple', 'green'];
const BACKHAND_COLORS: RubberColor[] = FOREHAND_COLORS;

const COLOR_SWATCHES: Record<RubberColor, string> = {
  red: '#dc2626',
  black: '#111111',
  pink: '#ec4899',
  blue: '#2563eb',
  purple: '#7c3aed',
  green: '#16a34a',
};

const HAND_OPTIONS: { labelKey: string; value: DominantHand }[] = [
  { labelKey: 'equipmentHandRight', value: 'right' },
  { labelKey: 'equipmentHandLeft', value: 'left' },
];

const STYLE_OPTIONS: { labelKey: string; value: PlayingStyle }[] = [
  { labelKey: 'equipmentStyleAttacker', value: 'attacker' },
  { labelKey: 'equipmentStyleDefender', value: 'defender' },
  { labelKey: 'equipmentStyleAllRounder', value: 'all_rounder' },
];

const GRIP_OPTIONS: { labelKey: string; value: Grip }[] = [
  { labelKey: 'equipmentGripShakehand', value: 'shakehand' },
  { labelKey: 'equipmentGripPenhold', value: 'penhold' },
  { labelKey: 'equipmentGripOther', value: 'other' },
];

function filterText(value: string, query: string) {
  return value.toLowerCase().includes(query.trim().toLowerCase());
}

// Cache Intl.DateTimeFormat per locale — constructing the formatter is the
// expensive part. With this cache, repeated calls in lists are effectively free.
const _equipmentDateFmtByLocale = new Map<string, Intl.DateTimeFormat>();
function formatDate(value: string, locale: string) {
  let fmt = _equipmentDateFmtByLocale.get(locale);
  if (!fmt) {
    fmt = new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', year: 'numeric' });
    _equipmentDateFmtByLocale.set(locale, fmt);
  }
  return fmt.format(new Date(value));
}

function initialsFromName(value?: string | null) {
  const fallback = '?';
  const name = (value ?? '').trim();
  if (!name) return fallback;
  const parts = name.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
  }
  return (parts[0]?.[0] ?? fallback).toUpperCase();
}

function pickLabel(pick: PickedEquipment, fallback: string) {
  return pick.model ? `${pick.manufacturer} ${pick.model}` : fallback;
}

function equipmentSnapshot(
  blade: PickedEquipment,
  forehand: PickedEquipment,
  backhand: PickedEquipment,
  forehandColor: RubberColor,
  backhandColor: RubberColor,
  dominantHand: DominantHand,
  playingStyle: PlayingStyle,
  grip: Grip,
) {
  return JSON.stringify({
    bladeManufacturerId: blade.manufacturerId,
    bladeManufacturer: blade.manufacturer,
    bladeModel: blade.model,
    forehandManufacturerId: forehand.manufacturerId,
    forehandManufacturer: forehand.manufacturer,
    forehandModel: forehand.model,
    forehandColor,
    backhandManufacturerId: backhand.manufacturerId,
    backhandManufacturer: backhand.manufacturer,
    backhandModel: backhand.model,
    backhandColor,
    dominantHand,
    playingStyle,
    grip,
  });
}

function snapshotFromSelection(selection: EquipmentSelection | undefined | null) {
  if (!selection) return null;
  return equipmentSnapshot(
    {
      manufacturerId: selection.blade_manufacturer_id,
      manufacturer: selection.blade_manufacturer,
      model: selection.blade_model,
    },
    {
      manufacturerId: selection.forehand_rubber_manufacturer_id,
      manufacturer: selection.forehand_rubber_manufacturer,
      model: selection.forehand_rubber_model,
    },
    {
      manufacturerId: selection.backhand_rubber_manufacturer_id,
      manufacturer: selection.backhand_rubber_manufacturer,
      model: selection.backhand_rubber_model,
    },
    selection.forehand_rubber_color,
    selection.backhand_rubber_color,
    selection.dominant_hand,
    selection.playing_style,
    selection.grip,
  );
}

function gripIcon(value: Grip) {
  if (value === 'shakehand') return 'handshake';
  if (value === 'penhold') return 'pen';
  return 'circle-dot';
}

interface SearchableSelectProps {
  label: string;
  placeholder: string;
  emptyText: string;
  options: readonly { id: string; name: string }[];
  value: string;
  disabled?: boolean;
  onSelect: (option: { id: string; name: string }) => void;
  colors: ThemeColors;
}

interface OptionRowProps {
  item: { id: string; name: string };
  onPress: (item: { id: string; name: string }) => void;
  rowStyle: any;
  pressedStyle: any;
  textStyle: any;
}
const OptionRow = React.memo(function OptionRow({
  item, onPress, rowStyle, pressedStyle, textStyle,
}: OptionRowProps) {
  return (
    <Pressable
      style={({ pressed }) => [rowStyle, pressed && pressedStyle]}
      onPress={() => onPress(item)}
      accessibilityRole="button"
      accessibilityLabel={`Select ${item.name}`}
    >
      <Text style={textStyle}>{item.name}</Text>
    </Pressable>
  );
});

interface ColorSelectProps {
  value: RubberColor;
  options: readonly RubberColor[];
  onSelect: (color: RubberColor) => void;
  getLabel: (color: RubberColor) => string;
  colors: ThemeColors;
}

function ColorSelect({ value, options, onSelect, getLabel, colors }: ColorSelectProps) {
  const [open, setOpen] = useState(false);
  const styles = useMemo(() => createSelectStyles(colors), [colors]);

  return (
    <>
      <Pressable style={styles.colorSelect} onPress={() => setOpen(true)}>
        <View style={[styles.colorSelectDot, { backgroundColor: COLOR_SWATCHES[value] }]} />
        <Text style={styles.colorSelectText}>{getLabel(value)}</Text>
        <Lucide name="chevron-down" size={14} color={colors.textFaint} />
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.colorPickerBackdrop} onPress={() => setOpen(false)}>
          <Pressable style={styles.colorPickerPanel} onPress={(event) => event.stopPropagation()}>
            <ScrollView
              style={styles.colorPickerScroll}
              contentContainerStyle={styles.colorPickerGrid}
              keyboardShouldPersistTaps="always"
            >
              {options.map((color) => {
                const active = value === color;
                return (
                  <Pressable
                    key={color}
                    style={({ pressed }) => [
                      styles.colorChip,
                      pressed && styles.optionRowPressed,
                      active && styles.colorChipActive,
                    ]}
                    onPress={() => {
                      onSelect(color);
                      setOpen(false);
                    }}
                  >
                    <View style={[styles.colorChipSwatch, { backgroundColor: COLOR_SWATCHES[color] }]}>
                      {active ? <Lucide name="check" size={13} color="#FFFFFF" /> : null}
                    </View>
                    <Text style={[styles.colorChipText, active && styles.colorChipTextActive]} numberOfLines={1}>
                      {getLabel(color)}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

function SearchableSelect({
  label,
  placeholder,
  emptyText,
  options,
  value,
  disabled = false,
  onSelect,
  colors,
}: SearchableSelectProps) {
  const sheetRef = useRef<BottomSheetModal>(null);
  const [query, setQuery] = useState('');
  const [webOpen, setWebOpen] = useState(false);
  const styles = useMemo(() => createSelectStyles(colors), [colors]);

  const suggestions = useMemo(() => {
    const q = query.trim();
    if (!q) return options;
    return options.filter((option) => filterText(option.name, q));
  }, [options, query]);

  const open = () => {
    if (disabled) return;
    setQuery('');
    if (Platform.OS === 'web') {
      setWebOpen(true);
    } else {
      sheetRef.current?.present();
    }
  };

  const handleSelect = useCallback(
    (option: { id: string; name: string }) => {
      onSelect(option);
      if (Platform.OS === 'web') setWebOpen(false);
      else sheetRef.current?.dismiss();
    },
    [onSelect],
  );

  const renderBackdrop = useCallback(
    (props: React.ComponentProps<typeof BottomSheetBackdrop>) => (
      <BottomSheetBackdrop {...props} appearsOnIndex={0} disappearsOnIndex={-1} opacity={0.45} />
    ),
    [],
  );

  const renderOption = useCallback(
    ({ item }: { item: { id: string; name: string } }) => (
      <OptionRow
        item={item}
        onPress={handleSelect}
        rowStyle={styles.optionRow}
        pressedStyle={styles.optionRowPressed}
        textStyle={styles.optionText}
      />
    ),
    // styles is per-theme; handleSelect closes over `onSelect` and `sheetRef`
    // (refs are stable, onSelect is the parent's callback)
    [styles.optionRow, styles.optionRowPressed, styles.optionText, handleSelect],
  );

  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <Pressable
        disabled={disabled}
        style={[styles.inputWrap, disabled && styles.inputDisabled]}
        onPress={open}
      >
        <Text style={[styles.inputValue, !value && styles.placeholder]} numberOfLines={1}>
          {value || placeholder}
        </Text>
        <Lucide name="chevron-down" size={16} color={colors.textFaint} />
      </Pressable>

      {Platform.OS === 'web' ? (
        <Modal
          visible={webOpen}
          transparent
          animationType="fade"
          onRequestClose={() => setWebOpen(false)}
        >
          <Pressable
            style={[styles.webBackdrop, { backgroundColor: colors.overlay }]}
            onPress={() => setWebOpen(false)}
          >
            <Pressable
              style={[styles.webSheet, { backgroundColor: colors.bgAlt }]}
              onPress={(e) => e.stopPropagation()}
            >
              <View style={[styles.sheetHeader, { backgroundColor: colors.bgAlt }]}>
                <Text style={styles.sheetTitle}>{label}</Text>
                <TextInput
                  value={query}
                  placeholder={placeholder}
                  placeholderTextColor={colors.textFaint}
                  autoFocus
                  autoComplete="off"
                  autoCorrect={false}
                  spellCheck={false}
                  style={styles.sheetSearch}
                  onChangeText={setQuery}
                  onSubmitEditing={() => {
                    if (suggestions[0]) handleSelect(suggestions[0]);
                  }}
                />
              </View>
              <FlatList
                style={styles.optionList}
                data={suggestions}
                keyExtractor={(option: { id: string }) => option.id}
                keyboardShouldPersistTaps="always"
                contentContainerStyle={styles.optionListContent}
                ListEmptyComponent={<Text style={styles.emptyOption}>{emptyText}</Text>}
                renderItem={renderOption}
              />
            </Pressable>
          </Pressable>
        </Modal>
      ) : (
        <BottomSheetModal
          ref={sheetRef}
          snapPoints={['65%']}
          enableDynamicSizing={false}
          keyboardBehavior="interactive"
          keyboardBlurBehavior="restore"
          android_keyboardInputMode="adjustResize"
          backdropComponent={renderBackdrop}
          backgroundStyle={{ backgroundColor: colors.bgAlt }}
          handleIndicatorStyle={{ backgroundColor: colors.border }}
        >
          <BottomSheetView style={styles.sheetContent}>
            <View style={[styles.sheetHeader, { backgroundColor: colors.bgAlt }]}>
              <Text style={styles.sheetTitle}>{label}</Text>
              <BottomSheetTextInput
                value={query}
                placeholder={placeholder}
                placeholderTextColor={colors.textFaint}
                autoFocus
                autoComplete="off"
                autoCorrect={false}
                spellCheck={false}
                style={styles.sheetSearch}
                onChangeText={setQuery}
                onSubmitEditing={() => {
                  if (suggestions[0]) handleSelect(suggestions[0]);
                }}
              />
            </View>
            <FlatList
              style={styles.optionList}
              data={suggestions}
              keyExtractor={(option: { id: string }) => option.id}
              keyboardShouldPersistTaps="always"
              contentContainerStyle={styles.optionListContent}
              ListEmptyComponent={<Text style={styles.emptyOption}>{emptyText}</Text>}
              renderItem={renderOption}
            />
          </BottomSheetView>
        </BottomSheetModal>
      )}
    </View>
  );
}

export function EquipmentScreen() {
  const router = useRouter();
  const { user } = useSession();
  const { colors } = useTheme();
  const { s, lang } = useI18n();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const dateLocale = getDateLocale(lang);
  const colorLabel = useCallback((color: RubberColor) => s(`equipmentColor_${color}`), [s]);

  const [activeTab, setActiveTab] = useState<TabKey>('edit');
  const [history, setHistory] = useState<EquipmentSelection[]>([]);
  const { data: bladeCatalogData, isError: bladeErr } = useEquipmentCatalogQuery('blade');
  const { data: rubberCatalogData, isError: rubberErr } = useEquipmentCatalogQuery('rubber');
  const bladeCatalog = useMemo(() => bladeCatalogData ?? [], [bladeCatalogData]);
  const rubberCatalog = useMemo(() => rubberCatalogData ?? [], [rubberCatalogData]);
  const [loading, setLoading] = useState(true);
  const catalogError = bladeErr || rubberErr;
  const [saving, setSaving] = useState(false);

  const [blade, setBlade] = useState<PickedEquipment>(EMPTY_PICK);
  const [forehand, setForehand] = useState<PickedEquipment>(EMPTY_PICK);
  const [backhand, setBackhand] = useState<PickedEquipment>(EMPTY_PICK);
  const [forehandColor, setForehandColor] = useState<RubberColor>('red');
  const [backhandColor, setBackhandColor] = useState<RubberColor>('black');
  const [dominantHand, setDominantHand] = useState<DominantHand>('right');
  const [playingStyle, setPlayingStyle] = useState<PlayingStyle>('attacker');
  const [grip, setGrip] = useState<Grip>('shakehand');
  const latest = history[0];
  const previous = history.slice(1, 4);
  const userDisplayName = user?.user_metadata?.full_name || user?.user_metadata?.name || user?.email || '';
  const userInitials = useMemo(() => initialsFromName(userDisplayName), [userDisplayName]);

  const bladeModelOptions = useMemo(() => {
    const manufacturer = bladeCatalog.find((item) => item.id === blade.manufacturerId);
    return (manufacturer?.models ?? []).map((name) => ({ id: name, name }));
  }, [blade.manufacturerId, bladeCatalog]);

  const forehandModelOptions = useMemo(() => {
    const manufacturer = rubberCatalog.find((item) => item.id === forehand.manufacturerId);
    return (manufacturer?.models ?? []).map((name) => ({ id: name, name }));
  }, [forehand.manufacturerId, rubberCatalog]);

  const backhandModelOptions = useMemo(() => {
    const manufacturer = rubberCatalog.find((item) => item.id === backhand.manufacturerId);
    return (manufacturer?.models ?? []).map((name) => ({ id: name, name }));
  }, [backhand.manufacturerId, rubberCatalog]);

  const loadHistory = useCallback(async () => {
    if (!user) return;
    // Cache-first: paint history immediately. Catalogs come from
    // useEquipmentCatalogQuery (delta-synced + persistent).
    const cached = loadCachedEquipmentHistory<EquipmentSelection>(user.id, 4);
    if (cached) {
      setHistory(cached.data);
      if (!cached.fresh) setLoading(true);
    } else {
      setLoading(true);
    }
    const historyRes = await getEquipmentHistory(user.id, 4);
    const { data } = historyRes;
    const histList = (data ?? []) as EquipmentSelection[];
    setHistory(histList);
    saveCachedEquipmentHistory(user.id, 4, histList);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  const applySelectionToForm = useCallback((selection: EquipmentSelection | null | undefined) => {
    if (!selection) {
      setBlade(EMPTY_PICK);
      setForehand(EMPTY_PICK);
      setBackhand(EMPTY_PICK);
      setForehandColor('red');
      setBackhandColor('black');
      setDominantHand('right');
      setPlayingStyle('attacker');
      setGrip('shakehand');
      return;
    }

    setBlade({
      manufacturerId: selection.blade_manufacturer_id,
      manufacturer: selection.blade_manufacturer,
      model: selection.blade_model,
    });
    setForehand({
      manufacturerId: selection.forehand_rubber_manufacturer_id,
      manufacturer: selection.forehand_rubber_manufacturer,
      model: selection.forehand_rubber_model,
    });
    setBackhand({
      manufacturerId: selection.backhand_rubber_manufacturer_id,
      manufacturer: selection.backhand_rubber_manufacturer,
      model: selection.backhand_rubber_model,
    });
    setForehandColor(selection.forehand_rubber_color);
    setBackhandColor(selection.backhand_rubber_color);
    setDominantHand(selection.dominant_hand);
    setPlayingStyle(selection.playing_style);
    setGrip(selection.grip);
  }, []);

  useEffect(() => {
    if (latest) applySelectionToForm(latest);
  }, [applySelectionToForm, latest]);

  const selectManufacturer = (type: 'blade' | EquipmentSide, manufacturer: Pick<EquipmentManufacturer, 'id' | 'name'>) => {
    const next = {
      manufacturerId: manufacturer.id,
      manufacturer: manufacturer.name,
      model: '',
    };

    if (type === 'blade') setBlade(next);
    if (type === 'forehand') setForehand(next);
    if (type === 'backhand') setBackhand(next);
  };

  const selectModel = (type: 'blade' | EquipmentSide, model: string) => {
    if (type === 'blade') setBlade((prev) => ({ ...prev, model }));
    if (type === 'forehand') setForehand((prev) => ({ ...prev, model }));
    if (type === 'backhand') setBackhand((prev) => ({ ...prev, model }));
  };

  const canSave = Boolean(
    blade.manufacturer &&
    blade.model &&
    forehand.manufacturer &&
    forehand.model &&
    backhand.manufacturer &&
    backhand.model,
  );
  const currentSnapshot = equipmentSnapshot(blade, forehand, backhand, forehandColor, backhandColor, dominantHand, playingStyle, grip);
  const savedSnapshot = snapshotFromSelection(latest);
  const defaultSnapshot = equipmentSnapshot(EMPTY_PICK, EMPTY_PICK, EMPTY_PICK, 'red', 'black', 'right', 'attacker', 'shakehand');
  const isDirty = latest ? currentSnapshot !== savedSnapshot : currentSnapshot !== defaultSnapshot;
  const handleSave = async () => {
    if (!user || !canSave) {
      Alert.alert(s('equipment'), s('equipmentCompleteRequired'));
      return;
    }

    setSaving(true);
    const { data, error } = await saveEquipmentSelection({
      user_id: user.id,
      blade_manufacturer_id: blade.manufacturerId,
      blade_manufacturer: blade.manufacturer,
      blade_model: blade.model,
      forehand_rubber_manufacturer_id: forehand.manufacturerId,
      forehand_rubber_manufacturer: forehand.manufacturer,
      forehand_rubber_model: forehand.model,
      forehand_rubber_color: forehandColor,
      backhand_rubber_manufacturer_id: backhand.manufacturerId,
      backhand_rubber_manufacturer: backhand.manufacturer,
      backhand_rubber_model: backhand.model,
      backhand_rubber_color: backhandColor,
      dominant_hand: dominantHand,
      playing_style: playingStyle,
      grip,
    });
    setSaving(false);

    if (error || !data) {
      Alert.alert(s('equipment'), s('equipmentSaveError'));
      return;
    }

    setHistory((prev) => [data as EquipmentSelection, ...prev].slice(0, 4));
    setActiveTab('current');
  };

  const handleResetChanges = () => {
    applySelectionToForm(latest);
  };

  const renderPickGroup = (
    title: string,
    type: 'blade' | EquipmentSide,
    catalog: readonly EquipmentManufacturer[],
    pick: PickedEquipment,
    modelOptions: readonly { id: string; name: string }[],
    icon: string,
    accentColor: string,
    colorPicker?: {
      value: RubberColor;
      options: readonly RubberColor[];
      onSelect: (color: RubberColor) => void;
    },
  ) => (
    <View style={styles.group}>
      <View style={styles.groupHeader}>
        <View style={[styles.groupIcon, { backgroundColor: accentColor }]}>
          <Lucide name={icon} size={18} color={colors.textOnPrimary} />
        </View>
        <View style={styles.groupTitleWrap}>
          <Text style={styles.groupTitle}>{title}</Text>
          <Text style={styles.groupSubtitle}>
            {pickLabel(pick, s('equipmentSearchGlobal'))}
          </Text>
        </View>
        {colorPicker ? (
          <ColorSelect
            value={colorPicker.value}
            options={colorPicker.options}
            onSelect={colorPicker.onSelect}
            getLabel={colorLabel}
            colors={colors}
          />
        ) : null}
      </View>
      <SearchableSelect
        label={s('equipmentManufacturer')}
        placeholder={s('equipmentSearchManufacturer')}
        emptyText={s('equipmentNoMatches')}
        options={catalog}
        value={pick.manufacturer}
        onSelect={(option) => selectManufacturer(type, option)}
        colors={colors}
      />
      <SearchableSelect
        label={s('equipmentModel')}
        placeholder={pick.manufacturer ? s('equipmentSearchModel') : s('equipmentChooseManufacturerFirst')}
        emptyText={s('equipmentNoMatches')}
        options={modelOptions}
        value={pick.model}
        disabled={!pick.manufacturerId}
        onSelect={(option) => selectModel(type, option.name)}
        colors={colors}
      />
    </View>
  );

  const renderSegmented = <T extends string>(
    label: string,
    options: { labelKey: string; value: T }[],
    selected: T,
    onSelect: (value: T) => void,
  ) => {
    const iconName =
      label === s('equipmentHand')
        ? 'hand'
        : label === s('equipmentPlayingStyle')
          ? 'activity'
          : gripIcon(grip);

    return (
      <View style={styles.segmentGroup}>
        <View style={styles.inlineHeader}>
          <Lucide name={iconName} size={16} color={colors.textMuted} />
          <Text style={styles.inputLabel}>{label}</Text>
        </View>
        <View style={styles.segmentRow}>
          {options.map((option) => (
            <TouchableOpacity
              key={option.value}
              style={[styles.segment, selected === option.value && styles.segmentActive]}
              onPress={() => onSelect(option.value)}
            >
              <Text style={[styles.segmentText, selected === option.value && styles.segmentTextActive]}>
                {s(option.labelKey)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    );
  };

  const renderSavePanel = (dock = false) => (
    <View style={[styles.savePanel, dock && styles.savePanelDock]}>
      <View style={styles.savePanelCopy}>
        <Text style={styles.savePanelTitle}>
          {isDirty ? s('equipmentUnsavedTitle') : s('equipmentSavedTitle')}
        </Text>
        <Text style={styles.savePanelText}>
          {canSave ? s(isDirty ? 'equipmentSaveHint' : 'equipmentSavedHint') : s('equipmentIncompleteHint')}
        </Text>
      </View>
      <View style={styles.savePanelActions}>
        {isDirty ? (
          <TouchableOpacity style={styles.resetButton} onPress={handleResetChanges} disabled={saving}>
            <Text style={styles.resetButtonText}>{s('equipmentReset')}</Text>
          </TouchableOpacity>
        ) : null}
        <TouchableOpacity
          style={[styles.saveButton, (!canSave || saving || !isDirty) && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={!canSave || saving || !isDirty}
        >
          {saving ? (
            <ActivityIndicator size="small" color={colors.textOnPrimary} />
          ) : (
            <Text style={styles.saveButtonText}>{s('equipmentSave')}</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()} accessibilityRole="button" accessibilityLabel={s('back')}>
          <Lucide name="arrow-left" size={24} color={colors.text} />
        </TouchableOpacity>
        <View style={styles.headerCopy}>
          <Text style={styles.headerTitle}>{s('equipment')}</Text>
        </View>
        <View style={styles.headerSpacer} />
      </View>

      <View style={styles.tabs}>
        {([
          ['edit', s('equipmentEditShort')],
          ['current', s('equipmentCurrentTabShort')],
        ] as const).map(([key, label]) => (
          <TouchableOpacity
            key={key}
            style={[styles.tab, activeTab === key && styles.tabActive]}
            onPress={() => setActiveTab(key)}
          >
            <Text style={[styles.tabText, activeTab === key && styles.tabTextActive]}>{label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 40 }} />
      ) : (
        <ScrollView style={styles.scroll} keyboardShouldPersistTaps="always">
          {catalogError && (
            <View style={styles.inlineError}>
              <Lucide name="alert-triangle" size={18} color={colors.red} />
              <Text style={styles.inlineErrorText}>{s('equipmentCatalogError')}</Text>
            </View>
          )}
          {activeTab === 'edit' ? (
            <View style={styles.content}>
              {renderPickGroup(s('equipmentBlade'), 'blade', bladeCatalog, blade, bladeModelOptions, 'scan-line', colors.primary)}
              {renderPickGroup(s('equipmentForehandRubber'), 'forehand', rubberCatalog, forehand, forehandModelOptions, 'zap', colors.red, {
                value: forehandColor,
                options: FOREHAND_COLORS,
                onSelect: setForehandColor,
              })}
              {renderPickGroup(s('equipmentBackhandRubber'), 'backhand', rubberCatalog, backhand, backhandModelOptions, 'shield', colors.black, {
                value: backhandColor,
                options: BACKHAND_COLORS,
                onSelect: setBackhandColor,
              })}

              <View style={[styles.group, styles.playerProfileGroup]}>
                <View style={[styles.groupHeader, styles.playerProfileHeader]}>
                  <View style={styles.playerProfileAvatar}>
                    <Text style={styles.playerProfileAvatarText}>{userInitials}</Text>
                  </View>
                  <View style={styles.groupTitleWrap}>
                    <Text style={styles.groupTitle}>{s('equipmentPlayerProfile')}</Text>
                    <Text style={styles.groupSubtitle}>{s('equipmentPlayerProfileDesc')}</Text>
                  </View>
                </View>
                <View style={styles.playerProfileControls}>
                  {renderSegmented(s('equipmentHand'), HAND_OPTIONS, dominantHand, setDominantHand)}
                  {renderSegmented(s('equipmentPlayingStyle'), STYLE_OPTIONS, playingStyle, setPlayingStyle)}
                  {renderSegmented(s('equipmentGrip'), GRIP_OPTIONS, grip, setGrip)}
                </View>
              </View>

              {renderSavePanel(true)}
            </View>
          ) : (
            <View style={styles.content}>
              {latest ? (
                <>
                  <EquipmentSummaryCard equipment={latest} title={s('equipmentYourSetup')} variant="owner" />
                  <View style={styles.historyHeader}>
                    <Text style={styles.sectionTitle}>{s('equipmentPrevious')}</Text>
                  </View>
                  {previous.length > 0 ? (
                    previous.map((item) => (
                      <EquipmentSummaryCard
                        key={item.id}
                        equipment={item}
                        title={formatDate(item.created_at, dateLocale)}
                        variant="history"
                        savedAt={s('equipmentPreviousSetup', formatDate(item.created_at, dateLocale))}
                      />
                    ))
                  ) : (
                    <View style={styles.historyEmpty}>
                      <Text style={styles.emptyText}>{s('equipmentPreviousEmpty')}</Text>
                    </View>
                  )}
                </>
              ) : (
                <View style={styles.emptyState}>
                  <Lucide name="circle-dot" size={28} color={colors.textFaint} />
                  <Text style={styles.emptyTitle}>{s('equipmentEmptyTitle')}</Text>
                  <Text style={styles.emptyText}>{s('equipmentEmptyDesc')}</Text>
                  <TouchableOpacity style={styles.secondaryButton} onPress={() => setActiveTab('edit')}>
                    <Text style={styles.secondaryButtonText}>{s('equipmentConfigure')}</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          )}
          <View style={{ height: 32 }} />
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
