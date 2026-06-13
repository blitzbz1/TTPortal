// T052: shared venue form fields for AddVenueScreen and the admin
// VenueEditModal. The two screens render the same inputs with different
// stylesheets and field subsets, so this component takes a small style
// contract plus an ordered `fields` list; admin-only sections (condition,
// lighting, nets, verified, photos) only render when requested. The city
// field can be replaced via `renderCity` (AddVenue's typeahead).
import React from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Image,
  type StyleProp,
  type ViewStyle,
  type TextStyle,
  type ImageStyle,
} from 'react-native';
import { Lucide } from './Icon';
import { AddressPickerField } from './AddressPickerField';
import { useI18n } from '../hooks/useI18n';
import { useTheme } from '../hooks/useTheme';
import type { UseVenueFormReturn } from '../hooks/useVenueForm';
import type { VenueCondition } from '../types/database';

export const CONDITION_OPTIONS: { value: VenueCondition; labelKey: string }[] = [
  { value: 'buna', labelKey: 'conditionGood' },
  { value: 'acceptabila', labelKey: 'conditionAcceptable' },
  { value: 'deteriorata', labelKey: 'conditionDegraded' },
  { value: 'profesionala', labelKey: 'conditionPro' },
  { value: 'necunoscuta', labelKey: 'conditionUnknown' },
];

export const BOOLEAN_OPTIONS: { value: boolean | null; labelKey: string }[] = [
  { value: true, labelKey: 'yes' },
  { value: false, labelKey: 'no' },
  { value: null, labelKey: 'conditionUnknown' },
];

export const REQUIRED_BOOLEAN_OPTIONS: { value: boolean; labelKey: string }[] = [
  { value: true, labelKey: 'yes' },
  { value: false, labelKey: 'no' },
];

export interface VenueFormFieldStyles {
  field: StyleProp<ViewStyle>;
  label: StyleProp<TextStyle>;
  input: StyleProp<TextStyle>;
  textarea: StyleProp<TextStyle>;
  typeRow: StyleProp<ViewStyle>;
  typeBtn: StyleProp<ViewStyle>;
  typeBtnActive: StyleProp<ViewStyle>;
  typeBtnText: StyleProp<TextStyle>;
  typeBtnTextActive: StyleProp<TextStyle>;
  // Choice-grid sections (condition / lighting / nets / verified).
  choiceGrid?: StyleProp<ViewStyle>;
  choiceBtn?: StyleProp<ViewStyle>;
  choiceBtnActive?: StyleProp<ViewStyle>;
  choiceText?: StyleProp<TextStyle>;
  choiceTextActive?: StyleProp<TextStyle>;
  // Photos section.
  photoGrid?: StyleProp<ViewStyle>;
  photoItem?: StyleProp<ViewStyle>;
  photoImage?: StyleProp<ImageStyle>;
  photoRemoveBtn?: StyleProp<ViewStyle>;
  photoRemoveText?: StyleProp<TextStyle>;
  emptyText?: StyleProp<TextStyle>;
}

export type VenueFormFieldName =
  | 'name'
  | 'type'
  | 'tables'
  | 'city'
  | 'address'
  | 'condition'
  | 'lighting'
  | 'nets'
  | 'verified'
  | 'photos'
  | 'description';

type AddressPickerProps = React.ComponentProps<typeof AddressPickerField>;

export interface VenueFormFieldsProps {
  form: UseVenueFormReturn;
  /** Which fields to render, in order. */
  fields: VenueFormFieldName[];
  styles: VenueFormFieldStyles;
  knownCities: AddressPickerProps['knownCities'];
  knownCityRecords: AddressPickerProps['knownCityRecords'];
  parentScrollRef: AddressPickerProps['parentScrollRef'];
  placeholders?: Partial<Record<'name' | 'tables' | 'description', string>>;
  testIDs?: Partial<Record<'description', string>>;
  /** Replaces the whole city field block (AddVenue's typeahead). */
  renderCity?: () => React.ReactNode;
}

export function VenueFormFields({
  form,
  fields,
  styles,
  knownCities,
  knownCityRecords,
  parentScrollRef,
  placeholders,
  testIDs,
  renderCity,
}: VenueFormFieldsProps) {
  const { s } = useI18n();
  const { colors } = useTheme();
  const { values, set, applyAddressPatch } = form;

  const renderChoiceGrid = <V,>(
    field: string,
    label: string,
    options: { value: V; labelKey: string }[],
    selected: V,
    onSelect: (value: V) => void,
  ) => (
    <View key={field} style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.choiceGrid}>
        {options.map((option) => {
          const active = selected === option.value;
          return (
            <TouchableOpacity
              key={`${field}-${String(option.value)}`}
              style={[styles.choiceBtn, active && styles.choiceBtnActive]}
              onPress={() => onSelect(option.value)}
              testID={`${field}-${String(option.value)}`}
            >
              <Text style={[styles.choiceText, active && styles.choiceTextActive]}>
                {s(option.labelKey)}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );

  const renderField = (field: VenueFormFieldName): React.ReactNode => {
    switch (field) {
      case 'name':
        return (
          <View key="name" style={styles.field}>
            <Text style={styles.label}>{s('fieldName')}</Text>
            <TextInput
              style={styles.input}
              placeholder={placeholders?.name}
              placeholderTextColor={colors.textFaint}
              value={values.name}
              onChangeText={(text) => set({ name: text })}
              maxLength={100}
            />
          </View>
        );
      case 'type':
        return (
          <View key="type" style={styles.field}>
            <Text style={styles.label}>{s('fieldType')}</Text>
            <View style={styles.typeRow}>
              {(['parc_exterior', 'sala_indoor'] as const).map((type) => (
                <TouchableOpacity
                  key={type}
                  style={[styles.typeBtn, values.type === type && styles.typeBtnActive]}
                  onPress={() => set({ type })}
                >
                  <Text style={[styles.typeBtnText, values.type === type && styles.typeBtnTextActive]}>
                    {s(type === 'parc_exterior' ? 'typeParcExterior' : 'typeSalaIndoor')}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        );
      case 'tables':
        return (
          <View key="tables" style={styles.field}>
            <Text style={styles.label}>{s('fieldTables')}</Text>
            <TextInput
              style={styles.input}
              placeholder={placeholders?.tables}
              placeholderTextColor={colors.textFaint}
              value={values.tables}
              onChangeText={(text) => set({ tables: text })}
              keyboardType="numeric"
            />
          </View>
        );
      case 'city':
        if (renderCity) {
          return <React.Fragment key="city">{renderCity()}</React.Fragment>;
        }
        return (
          <View key="city" style={styles.field}>
            <Text style={styles.label}>{s('fieldCity')}</Text>
            <TextInput
              style={styles.input}
              value={values.city}
              onChangeText={(text) => set({ city: text })}
              maxLength={100}
            />
          </View>
        );
      case 'address':
        // zIndex keeps the address typeahead dropdown above later fields.
        return (
          <View key="address" style={[styles.field, { zIndex: 10 }]}>
            <Text style={styles.label}>{s('fieldAddress')}</Text>
            <AddressPickerField
              address={values.address}
              city={values.city}
              lat={values.lat}
              lng={values.lng}
              knownCities={knownCities}
              knownCityRecords={knownCityRecords}
              countryCode={values.countryCode}
              countryName={values.countryName}
              cityCenterLat={values.cityCenterLat}
              cityCenterLng={values.cityCenterLng}
              cityZoom={values.cityZoom}
              onChange={applyAddressPatch}
              parentScrollRef={parentScrollRef}
            />
          </View>
        );
      case 'condition':
        return renderChoiceGrid(
          'condition',
          s('fieldCondition'),
          CONDITION_OPTIONS,
          values.condition,
          (condition) => set({ condition }),
        );
      case 'lighting':
        return renderChoiceGrid(
          'lighting',
          s('fieldLighting'),
          BOOLEAN_OPTIONS,
          values.nightLighting,
          (nightLighting) => set({ nightLighting }),
        );
      case 'nets':
        return renderChoiceGrid(
          'nets',
          s('fieldNets'),
          BOOLEAN_OPTIONS,
          values.nets,
          (nets) => set({ nets }),
        );
      case 'verified':
        return renderChoiceGrid(
          'verified',
          s('verified').toUpperCase(),
          REQUIRED_BOOLEAN_OPTIONS,
          values.verified,
          (verified) => set({ verified }),
        );
      case 'photos':
        return (
          <View key="photos" style={styles.field}>
            <Text style={styles.label}>{s('photos').toUpperCase()}</Text>
            {values.photos.length === 0 ? (
              <Text style={styles.emptyText}>{s('noPhotosYet')}</Text>
            ) : (
              <View style={styles.photoGrid}>
                {values.photos.map((photoUrl, index) => (
                  <View key={photoUrl} style={styles.photoItem}>
                    <Image source={{ uri: photoUrl }} style={styles.photoImage} />
                    <TouchableOpacity
                      style={styles.photoRemoveBtn}
                      onPress={() => set({ photos: values.photos.filter((url) => url !== photoUrl) })}
                      testID={`remove-photo-${index}`}
                    >
                      <Lucide name="trash-2" size={14} color={colors.textOnPrimary} />
                      <Text style={styles.photoRemoveText}>{s('deleteBtn')}</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}
          </View>
        );
      case 'description':
        return (
          <View key="description" style={styles.field}>
            <Text style={styles.label}>{s('fieldNotes')}</Text>
            <TextInput
              style={styles.textarea}
              placeholder={placeholders?.description}
              placeholderTextColor={colors.textFaint}
              value={values.description}
              onChangeText={(text) => set({ description: text })}
              testID={testIDs?.description}
              multiline
              maxLength={500}
              textAlignVertical="top"
            />
          </View>
        );
      default:
        return null;
    }
  };

  return <>{fields.map(renderField)}</>;
}
