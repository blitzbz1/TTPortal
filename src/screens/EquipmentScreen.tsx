import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { Lucide } from '../components/Icon';
import { useSession } from '../hooks/useSession';
import { useTheme } from '../hooks/useTheme';
import { useI18n } from '../hooks/useI18n';
import { getEquipmentCatalog, getEquipmentHistory, saveEquipmentSelection } from '../services/equipment';
import type {
  DominantHand,
  EquipmentManufacturer,
  EquipmentSelection,
  Grip,
  PlayingStyle,
  RubberColor,
} from '../types/database';
import type { ThemeColors } from '../theme';
import { Fonts, FontSize, FontWeight, Shadows, Spacing } from '../theme';

type TabKey = 'edit' | 'current';
type EquipmentSide = 'forehand' | 'backhand';

interface PickedEquipment {
  manufacturerId: string;
  manufacturer: string;
  model: string;
}

const EMPTY_PICK: PickedEquipment = { manufacturerId: '', manufacturer: '', model: '' };

const FOREHAND_COLORS: RubberColor[] = ['red', 'black', 'pink', 'blue', 'purple', 'green'];
const BACKHAND_COLORS: Extract<RubberColor, 'red' | 'black'>[] = ['red', 'black'];

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

function formatDate(value: string, locale: string) {
  return new Date(value).toLocaleDateString(locale, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function labelFromValue<T extends string>(
  options: { labelKey: string; value: T }[],
  value: T,
  translate: (key: string) => string,
) {
  const option = options.find((item) => item.value === value);
  return option ? translate(option.labelKey) : value;
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

interface ColorSelectProps {
  value: RubberColor;
  options: readonly RubberColor[];
  onSelect: (color: RubberColor) => void;
  getLabel: (color: RubberColor) => string;
  colors: ThemeColors;
}

function ColorSelect({ value, options, onSelect, getLabel, colors }: ColorSelectProps) {
  const anchorRef = useRef<View>(null);
  const [open, setOpen] = useState(false);
  const [anchor, setAnchor] = useState({ x: 0, y: 0, width: 0, height: 0 });
  const styles = useMemo(() => createSelectStyles(colors), [colors]);

  const openDropdown = () => {
    anchorRef.current?.measureInWindow((x, y, width, height) => {
      setAnchor({ x, y, width, height });
      setOpen(true);
    });
  };

  return (
    <>
      <Pressable ref={anchorRef} style={styles.colorSelect} onPress={openDropdown}>
        <View style={[styles.colorSelectDot, { backgroundColor: COLOR_SWATCHES[value] }]} />
        <Text style={styles.colorSelectText}>{getLabel(value)}</Text>
        <Lucide name="chevron-down" size={14} color={colors.textFaint} />
      </Pressable>

      <Modal visible={open} transparent animationType="none" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.dropdownBackdrop} onPress={() => setOpen(false)} />
        <View
          style={[
            styles.colorDropdown,
            {
              left: anchor.x,
              top: anchor.y + anchor.height + 6,
              minWidth: Math.max(anchor.width, 132),
            },
          ]}
        >
          {options.map((color) => (
            <Pressable
              key={color}
              style={({ pressed }) => [
                styles.colorOption,
                pressed && styles.optionRowPressed,
                value === color && styles.colorOptionActive,
              ]}
              onPress={() => {
                onSelect(color);
                setOpen(false);
              }}
            >
              <View style={[styles.colorSelectDot, { backgroundColor: COLOR_SWATCHES[color] }]} />
              <Text style={[styles.colorOptionText, value === color && styles.colorOptionTextActive]}>
                {getLabel(color)}
              </Text>
            </Pressable>
          ))}
        </View>
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
  const anchorRef = useRef<View>(null);
  const [query, setQuery] = useState(value);
  const [open, setOpen] = useState(false);
  const [anchor, setAnchor] = useState({ x: 0, y: 0, width: 0, height: 0 });

  useEffect(() => {
    setQuery(value);
  }, [value]);

  const suggestions = useMemo(() => {
    if (disabled) return [];
    const filtered = query.trim()
      ? options.filter((option) => filterText(option.name, query))
      : options;
    return filtered.slice(0, 8);
  }, [disabled, options, query]);

  const styles = useMemo(() => createSelectStyles(colors), [colors]);
  const handleSelect = (option: { id: string; name: string }) => {
    onSelect(option);
    setQuery(option.name);
    setOpen(false);
  };

  const openDropdown = () => {
    if (disabled) return;
    anchorRef.current?.measureInWindow((x, y, width, height) => {
      setAnchor({ x, y, width, height });
      setOpen(true);
    });
  };

  const windowHeight = Dimensions.get('window').height;
  const belowTop = anchor.y + anchor.height + 6;
  const roomBelow = windowHeight - belowTop - Spacing.md;
  const dropdownMaxHeight = Math.max(150, Math.min(260, roomBelow));
  const dropdownTop = roomBelow >= 150 ? belowTop : Math.max(Spacing.md, anchor.y - 266);

  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <Pressable
        ref={anchorRef}
        disabled={disabled}
        style={[styles.inputWrap, disabled && styles.inputDisabled]}
        onPress={openDropdown}
      >
        <Text style={[styles.inputValue, !value && styles.placeholder]} numberOfLines={1}>
          {value || placeholder}
        </Text>
        <Lucide name="chevron-down" size={16} color={colors.textFaint} />
      </Pressable>

      <Modal visible={open} transparent animationType="none" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.dropdownBackdrop} onPress={() => setOpen(false)} />
        <View
          style={[
            styles.dropdown,
            {
              left: anchor.x,
              top: dropdownTop,
              width: anchor.width,
              maxHeight: dropdownMaxHeight,
            },
          ]}
        >
          <TextInput
            value={query}
            autoFocus
            placeholder={placeholder}
            placeholderTextColor={colors.textFaint}
            autoComplete="off"
            autoCorrect={false}
            importantForAutofill="no"
            spellCheck={false}
            textContentType="none"
            style={styles.dropdownSearch}
            onChangeText={setQuery}
            onSubmitEditing={() => {
              if (suggestions[0]) handleSelect(suggestions[0]);
            }}
          />
          <ScrollView keyboardShouldPersistTaps="always" showsVerticalScrollIndicator={suggestions.length > 5}>
            {suggestions.length > 0 ? suggestions.map((option) => (
              <Pressable
                key={option.id}
                style={({ pressed }) => [styles.optionRow, pressed && styles.optionRowPressed]}
                onPress={() => handleSelect(option)}
                accessibilityRole="button"
                accessibilityLabel={`Select ${option.name}`}
              >
                <Text style={styles.optionText}>{option.name}</Text>
              </Pressable>
            )) : (
              <Text style={styles.emptyOption}>{emptyText}</Text>
            )}
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

export function EquipmentScreen() {
  const router = useRouter();
  const { user } = useSession();
  const { colors } = useTheme();
  const { s, lang } = useI18n();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const dateLocale = lang === 'ro' ? 'ro-RO' : 'en-US';
  const colorLabel = useCallback((color: RubberColor) => s(`equipmentColor_${color}`), [s]);

  const [activeTab, setActiveTab] = useState<TabKey>('edit');
  const [history, setHistory] = useState<EquipmentSelection[]>([]);
  const [bladeCatalog, setBladeCatalog] = useState<EquipmentManufacturer[]>([]);
  const [rubberCatalog, setRubberCatalog] = useState<EquipmentManufacturer[]>([]);
  const [loading, setLoading] = useState(true);
  const [catalogError, setCatalogError] = useState(false);
  const [saving, setSaving] = useState(false);

  const [blade, setBlade] = useState<PickedEquipment>(EMPTY_PICK);
  const [forehand, setForehand] = useState<PickedEquipment>(EMPTY_PICK);
  const [backhand, setBackhand] = useState<PickedEquipment>(EMPTY_PICK);
  const [forehandColor, setForehandColor] = useState<RubberColor>('red');
  const [backhandColor, setBackhandColor] = useState<Extract<RubberColor, 'red' | 'black'>>('black');
  const [dominantHand, setDominantHand] = useState<DominantHand>('right');
  const [playingStyle, setPlayingStyle] = useState<PlayingStyle>('attacker');
  const [grip, setGrip] = useState<Grip>('shakehand');

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
    setLoading(true);
    setCatalogError(false);
    const [historyRes, bladeRes, rubberRes] = await Promise.all([
      getEquipmentHistory(user.id, 4),
      getEquipmentCatalog('blade'),
      getEquipmentCatalog('rubber'),
    ]);

    if (bladeRes.error || rubberRes.error) {
      setCatalogError(true);
    }

    setBladeCatalog(bladeRes.data ?? []);
    setRubberCatalog(rubberRes.data ?? []);
    const { data } = historyRes;
    setHistory((data ?? []) as EquipmentSelection[]);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  useEffect(() => {
    const latest = history[0];
    if (!latest) return;

    setBlade({
      manufacturerId: latest.blade_manufacturer_id,
      manufacturer: latest.blade_manufacturer,
      model: latest.blade_model,
    });
    setForehand({
      manufacturerId: latest.forehand_rubber_manufacturer_id,
      manufacturer: latest.forehand_rubber_manufacturer,
      model: latest.forehand_rubber_model,
    });
    setBackhand({
      manufacturerId: latest.backhand_rubber_manufacturer_id,
      manufacturer: latest.backhand_rubber_manufacturer,
      model: latest.backhand_rubber_model,
    });
    setForehandColor(latest.forehand_rubber_color);
    setBackhandColor(latest.backhand_rubber_color);
    setDominantHand(latest.dominant_hand);
    setPlayingStyle(latest.playing_style);
    setGrip(latest.grip);
  }, [history]);

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

  const canSave =
    blade.manufacturer &&
    blade.model &&
    forehand.manufacturer &&
    forehand.model &&
    backhand.manufacturer &&
    backhand.model;

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
            {pick.model ? `${pick.manufacturer} ${pick.model}` : s('equipmentSearchGlobal')}
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
  ) => (
    <View style={styles.segmentGroup}>
      <View style={styles.inlineHeader}>
        <Lucide
          name={label === s('equipmentHand') ? 'hand' : label === s('equipmentPlayingStyle') ? 'activity' : 'badge'}
          size={16}
          color={colors.textMuted}
        />
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

  const renderEquipmentCard = (item: EquipmentSelection, index: number) => (
    <View key={item.id} style={[styles.equipmentCard, index === 0 && styles.currentCard]}>
      <View style={styles.cardHeader}>
        <View style={styles.cardTitleBlock}>
          <Text style={styles.cardEyebrow}>
            {index === 0 ? s('equipmentLatestSetup') : s('equipmentPreviousSetup', formatDate(item.created_at, dateLocale))}
          </Text>
        </View>
        {index === 0 && (
          <View style={styles.latestPill}>
            <Text style={styles.latestText}>{s('equipmentCurrent')}</Text>
          </View>
        )}
      </View>
      <View style={styles.bladeStrip}>
        <View style={styles.bladeIcon}>
          <Lucide name="scan-line" size={18} color={colors.primary} />
        </View>
        <View style={styles.bladeTextWrap}>
          <Text style={styles.bladeLabel}>{s('equipmentBlade')}</Text>
          <Text style={styles.bladeValue}>{item.blade_manufacturer} {item.blade_model}</Text>
        </View>
      </View>
      <View style={styles.detailGrid}>
        <View style={styles.detailTile}>
          <View style={styles.detailTileHeader}>
            <View style={[styles.tinyColorDot, { backgroundColor: COLOR_SWATCHES[item.forehand_rubber_color] }]} />
            <Text style={styles.detailLabel}>{s('equipmentForehand')}</Text>
          </View>
          <Text style={styles.detailValue}>{item.forehand_rubber_manufacturer} {item.forehand_rubber_model}</Text>
        </View>
        <View style={styles.detailTile}>
          <View style={styles.detailTileHeader}>
            <View style={[styles.tinyColorDot, { backgroundColor: COLOR_SWATCHES[item.backhand_rubber_color] }]} />
            <Text style={styles.detailLabel}>{s('equipmentBackhand')}</Text>
          </View>
          <Text style={styles.detailValue}>{item.backhand_rubber_manufacturer} {item.backhand_rubber_model}</Text>
        </View>
      </View>
      <View style={styles.metaRow}>
        <View style={styles.metaPill}>
          <Lucide name="hand" size={13} color={colors.primaryMid} />
          <Text style={styles.metaPillText}>{labelFromValue(HAND_OPTIONS, item.dominant_hand, s)}</Text>
        </View>
        <View style={styles.metaPill}>
          <Lucide name="activity" size={13} color={colors.primaryMid} />
          <Text style={styles.metaPillText}>{labelFromValue(STYLE_OPTIONS, item.playing_style, s)}</Text>
        </View>
        <View style={styles.metaPill}>
          <Lucide name="badge" size={13} color={colors.primaryMid} />
          <Text style={styles.metaPillText}>{labelFromValue(GRIP_OPTIONS, item.grip, s)}</Text>
        </View>
      </View>
    </View>
  );

  const latest = history[0];
  const previous = history.slice(1, 4);

  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient
        colors={[colors.primary, colors.greenDeep]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.header}
      >
        <TouchableOpacity onPress={() => router.back()}>
          <Lucide name="arrow-left" size={24} color={colors.textOnPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{s('equipment')}</Text>
        <View style={{ width: 24 }} />
      </LinearGradient>

      <View style={styles.tabs}>
        {([
          ['edit', s('equipmentEdit')],
          ['current', s('equipmentCurrentTab')],
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
                onSelect: (color) => {
                  if (color === 'red' || color === 'black') setBackhandColor(color);
                },
              })}

              <View style={styles.group}>
                <View style={styles.groupHeader}>
                  <View style={[styles.groupIcon, { backgroundColor: colors.accent }]}>
                    <Lucide name="user-round" size={18} color={colors.textOnPrimary} />
                  </View>
                  <View style={styles.groupTitleWrap}>
                    <Text style={styles.groupTitle}>{s('equipmentPlayerProfile')}</Text>
                    <Text style={styles.groupSubtitle}>{s('equipmentPlayerProfileDesc')}</Text>
                  </View>
                </View>
                {renderSegmented(s('equipmentHand'), HAND_OPTIONS, dominantHand, setDominantHand)}
                {renderSegmented(s('equipmentPlayingStyle'), STYLE_OPTIONS, playingStyle, setPlayingStyle)}
                {renderSegmented(s('equipmentGrip'), GRIP_OPTIONS, grip, setGrip)}
              </View>

              <TouchableOpacity
                style={[styles.saveButton, (!canSave || saving) && styles.saveButtonDisabled]}
                onPress={handleSave}
                disabled={!canSave || saving}
              >
                {saving ? (
                  <ActivityIndicator size="small" color={colors.textOnPrimary} />
                ) : (
                  <Text style={styles.saveButtonText}>{s('equipmentSave')}</Text>
                )}
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.content}>
              {latest ? (
                <>
                  {renderEquipmentCard(latest, 0)}
                  <Text style={styles.sectionTitle}>{s('equipmentPrevious')}</Text>
                  {previous.length > 0 ? (
                    previous.map((item, index) => renderEquipmentCard(item, index + 1))
                  ) : (
                    <Text style={styles.emptyText}>{s('equipmentPreviousEmpty')}</Text>
                  )}
                </>
              ) : (
                <View style={styles.emptyState}>
                  <Lucide name="circle-dot" size={28} color={colors.textFaint} />
                  <Text style={styles.emptyTitle}>{s('equipmentEmptyTitle')}</Text>
                  <Text style={styles.emptyText}>{s('equipmentEmptyDesc')}</Text>
                  <TouchableOpacity style={styles.secondaryButton} onPress={() => setActiveTab('edit')}>
                    <Text style={styles.secondaryButtonText}>{s('equipment')}</Text>
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

function createSelectStyles(colors: ThemeColors) {
  return StyleSheet.create({
    field: {
      gap: 6,
    },
    label: {
      fontFamily: Fonts.body,
      fontSize: FontSize.sm,
      fontWeight: FontWeight.semibold,
      color: colors.textMuted,
      textTransform: 'uppercase',
      letterSpacing: 0.4,
    },
    inputWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      height: 46,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.bgAlt,
      paddingHorizontal: Spacing.sm,
      gap: Spacing.xs,
    },
    inputValue: {
      flex: 1,
      fontFamily: Fonts.body,
      fontSize: FontSize.lg,
      color: colors.text,
    },
    placeholder: {
      color: colors.textFaint,
    },
    inputDisabled: {
      opacity: 0.55,
      backgroundColor: colors.bgMuted,
    },
    dropdownBackdrop: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'transparent',
    },
    dropdown: {
      position: 'absolute',
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.bgAlt,
      overflow: 'hidden',
      elevation: 16,
      ...Shadows.sm,
    },
    dropdownSearch: {
      height: 44,
      borderBottomWidth: 1,
      borderBottomColor: colors.borderLight,
      backgroundColor: colors.bgAlt,
      paddingHorizontal: Spacing.sm,
      fontFamily: Fonts.body,
      fontSize: FontSize.lg,
      color: colors.text,
      outlineStyle: 'none' as any,
    },
    optionRow: {
      minHeight: 42,
      justifyContent: 'center',
      paddingVertical: 10,
      paddingHorizontal: Spacing.sm,
      borderBottomWidth: 1,
      borderBottomColor: colors.borderLight,
    },
    optionRowPressed: {
      backgroundColor: colors.primaryPale,
    },
    optionText: {
      fontFamily: Fonts.body,
      fontSize: FontSize.md,
      color: colors.text,
    },
    emptyOption: {
      paddingVertical: Spacing.md,
      paddingHorizontal: Spacing.sm,
      textAlign: 'center',
      fontFamily: Fonts.body,
      fontSize: FontSize.md,
      color: colors.textFaint,
    },
    colorSelect: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.bgMuted,
      paddingVertical: 7,
      paddingHorizontal: 9,
      minHeight: 34,
    },
    colorSelectDot: {
      width: 11,
      height: 11,
      borderRadius: 6,
      borderWidth: 1,
      borderColor: colors.border,
    },
    colorSelectText: {
      fontFamily: Fonts.body,
      fontSize: FontSize.base,
      fontWeight: FontWeight.semibold,
      color: colors.text,
      textTransform: 'capitalize',
    },
    colorDropdown: {
      position: 'absolute',
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.bgAlt,
      overflow: 'hidden',
      elevation: 16,
      ...Shadows.sm,
    },
    colorOption: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      minHeight: 38,
      paddingVertical: 9,
      paddingHorizontal: 10,
      borderBottomWidth: 1,
      borderBottomColor: colors.borderLight,
    },
    colorOptionActive: {
      backgroundColor: colors.primaryPale,
    },
    colorOptionText: {
      fontFamily: Fonts.body,
      fontSize: FontSize.md,
      fontWeight: FontWeight.medium,
      color: colors.textMuted,
      textTransform: 'capitalize',
    },
    colorOptionTextActive: {
      color: colors.primary,
      fontWeight: FontWeight.bold,
    },
  });
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.bg,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      minHeight: 58,
      paddingHorizontal: Spacing.md,
      ...Shadows.bar,
    },
    headerTitle: {
      fontFamily: Fonts.heading,
      fontSize: FontSize.xxl,
      fontWeight: FontWeight.bold,
      color: colors.textOnPrimary,
    },
    hero: {
      alignItems: 'flex-start',
      marginHorizontal: Spacing.md,
      marginTop: Spacing.md,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.borderLight,
      backgroundColor: colors.bgAlt,
      paddingVertical: Spacing.lg,
      paddingHorizontal: Spacing.md,
      ...Shadows.md,
    },
    heroCopy: {
      gap: 6,
    },
    heroTitle: {
      fontFamily: Fonts.heading,
      fontSize: 28,
      fontWeight: FontWeight.extrabold,
      color: colors.text,
    },
    heroText: {
      fontFamily: Fonts.body,
      fontSize: FontSize.lg,
      lineHeight: 21,
      color: colors.textMuted,
    },
    tabs: {
      flexDirection: 'row',
      gap: 8,
      paddingHorizontal: Spacing.md,
      paddingTop: Spacing.sm,
      paddingBottom: Spacing.md,
      backgroundColor: colors.bg,
    },
    tab: {
      flex: 1,
      alignItems: 'center',
      borderRadius: 8,
      paddingVertical: 10,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.bgAlt,
      ...Shadows.sm,
    },
    tabActive: {
      backgroundColor: colors.primaryPale,
      borderColor: colors.primaryDim,
    },
    tabText: {
      fontFamily: Fonts.body,
      fontSize: FontSize.md,
      fontWeight: FontWeight.semibold,
      color: colors.textMuted,
    },
    tabTextActive: {
      color: colors.primary,
    },
    scroll: {
      flex: 1,
    },
    content: {
      paddingHorizontal: Spacing.md,
      gap: Spacing.md,
    },
    inlineError: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.xs,
      marginHorizontal: Spacing.md,
      marginBottom: Spacing.sm,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.redBorder,
      backgroundColor: colors.redPale,
      padding: Spacing.sm,
    },
    inlineErrorText: {
      flex: 1,
      fontFamily: Fonts.body,
      fontSize: FontSize.md,
      fontWeight: FontWeight.medium,
      color: colors.red,
    },
    group: {
      gap: Spacing.md,
      backgroundColor: colors.bgAlt,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.borderLight,
      padding: Spacing.md,
      ...Shadows.sm,
    },
    groupHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
    },
    groupIcon: {
      width: 38,
      height: 38,
      borderRadius: 8,
      alignItems: 'center',
      justifyContent: 'center',
      ...Shadows.sm,
    },
    groupTitleWrap: {
      flex: 1,
      gap: 2,
    },
    groupTitle: {
      fontFamily: Fonts.heading,
      fontSize: FontSize.xl,
      fontWeight: FontWeight.bold,
      color: colors.text,
    },
    groupSubtitle: {
      fontFamily: Fonts.body,
      fontSize: FontSize.base,
      color: colors.textFaint,
    },
    inlineHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    inputLabel: {
      fontFamily: Fonts.body,
      fontSize: FontSize.sm,
      fontWeight: FontWeight.semibold,
      color: colors.textMuted,
      textTransform: 'uppercase',
      letterSpacing: 0.4,
    },
    colorGroup: {
      gap: 10,
      backgroundColor: colors.bgAlt,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.borderLight,
      padding: Spacing.md,
      ...Shadows.sm,
    },
    colorRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    colorChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.border,
      paddingVertical: 9,
      paddingHorizontal: 11,
      backgroundColor: colors.bgMuted,
    },
    colorChipActive: {
      borderColor: colors.primary,
      backgroundColor: colors.primaryPale,
    },
    colorDot: {
      width: 12,
      height: 12,
      borderRadius: 6,
      borderWidth: 1,
      borderColor: colors.border,
    },
    colorText: {
      fontFamily: Fonts.body,
      fontSize: FontSize.md,
      fontWeight: FontWeight.medium,
      color: colors.textMuted,
      textTransform: 'capitalize',
    },
    colorTextActive: {
      color: colors.primary,
      fontWeight: FontWeight.semibold,
    },
    segmentGroup: {
      gap: 8,
    },
    segmentRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    segment: {
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.border,
      paddingVertical: 10,
      paddingHorizontal: 12,
      backgroundColor: colors.bgMuted,
    },
    segmentActive: {
      backgroundColor: colors.primaryPale,
      borderColor: colors.primaryDim,
    },
    segmentText: {
      fontFamily: Fonts.body,
      fontSize: FontSize.md,
      fontWeight: FontWeight.medium,
      color: colors.textMuted,
    },
    segmentTextActive: {
      color: colors.primary,
      fontWeight: FontWeight.semibold,
    },
    saveButton: {
      alignItems: 'center',
      justifyContent: 'center',
      height: 52,
      borderRadius: 8,
      backgroundColor: colors.primary,
      ...Shadows.md,
    },
    saveButtonDisabled: {
      opacity: 0.55,
    },
    saveButtonText: {
      fontFamily: Fonts.body,
      fontSize: FontSize.lg,
      fontWeight: FontWeight.bold,
      color: colors.textOnPrimary,
    },
    equipmentCard: {
      gap: Spacing.md,
      backgroundColor: colors.bgAlt,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.borderLight,
      padding: Spacing.md,
      ...Shadows.sm,
    },
    currentCard: {
      borderColor: colors.primaryDim,
      backgroundColor: colors.primaryPale,
    },
    cardHeader: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: Spacing.sm,
    },
    cardTitleBlock: {
      flex: 1,
      gap: 3,
    },
    cardEyebrow: {
      fontFamily: Fonts.body,
      fontSize: FontSize.sm,
      fontWeight: FontWeight.semibold,
      color: colors.textFaint,
      textTransform: 'uppercase',
      letterSpacing: 0.4,
    },
    cardTitle: {
      fontFamily: Fonts.heading,
      fontSize: FontSize.xxl,
      fontWeight: FontWeight.bold,
      color: colors.text,
      marginTop: 2,
    },
    cardSubtitle: {
      fontFamily: Fonts.body,
      fontSize: FontSize.md,
      fontWeight: FontWeight.medium,
      color: colors.textMuted,
    },
    latestPill: {
      borderRadius: 8,
      backgroundColor: colors.primary,
      paddingVertical: 4,
      paddingHorizontal: 8,
    },
    latestText: {
      fontFamily: Fonts.body,
      fontSize: FontSize.sm,
      fontWeight: FontWeight.bold,
      color: colors.textOnPrimary,
    },
    bladeStrip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.primaryDim,
      backgroundColor: colors.bgAlt,
      padding: Spacing.sm,
    },
    bladeIcon: {
      width: 36,
      height: 36,
      borderRadius: 8,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.primaryPale,
    },
    bladeTextWrap: {
      flex: 1,
      gap: 2,
    },
    bladeLabel: {
      fontFamily: Fonts.body,
      fontSize: FontSize.xs,
      fontWeight: FontWeight.bold,
      color: colors.textFaint,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    bladeValue: {
      fontFamily: Fonts.body,
      fontSize: FontSize.md,
      fontWeight: FontWeight.semibold,
      color: colors.text,
    },
    detailGrid: {
      flexDirection: 'row',
      gap: Spacing.sm,
    },
    detailTile: {
      flex: 1,
      gap: 3,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.borderLight,
      backgroundColor: colors.bgAlt,
      padding: Spacing.sm,
    },
    detailTileHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    tinyColorDot: {
      width: 9,
      height: 9,
      borderRadius: 5,
      borderWidth: 1,
      borderColor: colors.border,
    },
    detailLabel: {
      fontFamily: Fonts.body,
      fontSize: FontSize.sm,
      fontWeight: FontWeight.semibold,
      color: colors.textMuted,
      textTransform: 'uppercase',
      letterSpacing: 0.4,
    },
    detailValue: {
      fontFamily: Fonts.body,
      fontSize: FontSize.lg,
      fontWeight: FontWeight.semibold,
      color: colors.text,
    },
    metaRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    metaPill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      borderRadius: 8,
      backgroundColor: colors.bgMuted,
      paddingVertical: 7,
      paddingHorizontal: 9,
      borderWidth: 1,
      borderColor: colors.borderLight,
    },
    metaPillText: {
      fontFamily: Fonts.body,
      fontSize: FontSize.base,
      fontWeight: FontWeight.semibold,
      color: colors.textMuted,
    },
    sectionTitle: {
      fontFamily: Fonts.body,
      fontSize: FontSize.md,
      fontWeight: FontWeight.semibold,
      color: colors.textMuted,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      marginTop: Spacing.xs,
    },
    emptyState: {
      alignItems: 'center',
      gap: Spacing.xs,
      backgroundColor: colors.bgAlt,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.borderLight,
      padding: Spacing.lg,
      ...Shadows.sm,
    },
    emptyTitle: {
      fontFamily: Fonts.heading,
      fontSize: FontSize.xl,
      fontWeight: FontWeight.bold,
      color: colors.text,
      textAlign: 'center',
    },
    emptyText: {
      fontFamily: Fonts.body,
      fontSize: FontSize.md,
      color: colors.textFaint,
      textAlign: 'center',
    },
    secondaryButton: {
      marginTop: Spacing.xs,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.primaryDim,
      backgroundColor: colors.primaryPale,
      paddingVertical: 9,
      paddingHorizontal: Spacing.md,
    },
    secondaryButtonText: {
      fontFamily: Fonts.body,
      fontSize: FontSize.md,
      fontWeight: FontWeight.semibold,
      color: colors.primary,
    },
  });
}
