import React, { useState, useEffect } from 'react';
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
import { Colors, Fonts, Radius } from '../theme';
import { useI18n } from '../hooks/useI18n';
import { getCities } from '../services/cities';

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
  const [cities, setCities] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function fetchCities() {
      setLoading(true);
      const { data } = await getCities();
      if (!cancelled && data) {
        setCities(data.map((c: { name: string }) => c.name));
      }
      if (!cancelled) setLoading(false);
    }

    fetchCities();
    return () => {
      cancelled = true;
    };
  }, []);

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
              <Lucide name="x" size={22} color={Colors.inkMuted} />
            </TouchableOpacity>
          </View>

          {loading ? (
            <View style={styles.loader}>
              <ActivityIndicator size="large" color={Colors.green} />
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
                  <Lucide name="check" size={20} color={Colors.greenLight} />
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
  backdropTouchable: {
    flex: 1,
  },
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
  loader: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.borderLight,
  },
  rowText: {
    fontSize: 15,
    fontFamily: Fonts.body,
    color: Colors.ink,
  },
  rowTextSelected: {
    fontWeight: '600',
    color: Colors.green,
  },
});
