import React from 'react';
import { Modal, Pressable, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { Lucide } from '../../components/Icon';
import { useTheme } from '../../hooks/useTheme';
import { useI18n } from '../../hooks/useI18n';
import { createStyles } from '../VenueDetailScreen.styles';

export type CheckinCustomMode = 'none' | 'minutes' | 'until';

interface Props {
  visible: boolean;
  customMode: CheckinCustomMode;
  setCustomMode: (mode: CheckinCustomMode) => void;
  customMinutes: string;
  setCustomMinutes: (value: string) => void;
  untilHour: string;
  setUntilHour: (value: string) => void;
  untilMinute: string;
  setUntilMinute: (value: string) => void;
  lookingForPlayers: boolean;
  setLookingForPlayers: (value: boolean) => void;
  sessionNote: string;
  setSessionNote: (value: string) => void;
  onDismiss: () => void;
  onPickDuration: (minutes: number) => void;
  onConfirmCustom: () => void;
}

export function CheckinDurationModal({
  visible,
  customMode,
  setCustomMode,
  customMinutes,
  setCustomMinutes,
  untilHour,
  setUntilHour,
  untilMinute,
  setUntilMinute,
  lookingForPlayers,
  setLookingForPlayers,
  sessionNote,
  setSessionNote,
  onDismiss,
  onPickDuration,
  onConfirmCustom,
}: Props) {
  const { s } = useI18n();
  const { colors } = useTheme();
  const { cm } = React.useMemo(() => createStyles(colors), [colors]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onDismiss}>
      <Pressable style={cm.overlay} onPress={onDismiss}>
        <Pressable style={cm.sheet} onPress={() => {}}>
          <View style={cm.handleWrap}><View style={cm.handle} /></View>

          <Text style={cm.title}>{s('checkinDuration')}</Text>

          <KeyboardAwareScrollView
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            bottomOffset={20}
            showsVerticalScrollIndicator={false}
          >
          {customMode === 'none' && (
            <>
            <View style={cm.options}>
              <TouchableOpacity style={cm.optionBtn} onPress={() => onPickDuration(60)}>
                <Lucide name="clock" size={18} color={colors.primary} />
                <Text style={cm.optionText}>{s('oneHour')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={cm.optionBtn} onPress={() => onPickDuration(120)}>
                <Lucide name="clock" size={18} color={colors.primary} />
                <Text style={cm.optionText}>{s('twoHours')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={cm.optionBtn} onPress={() => onPickDuration(180)}>
                <Lucide name="clock" size={18} color={colors.primary} />
                <Text style={cm.optionText}>{s('threeHours')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={cm.optionBtn} onPress={() => setCustomMode('minutes')}>
                <Lucide name="timer" size={18} color={colors.accentBright} />
                <Text style={cm.optionText}>{s('customTime')}</Text>
                <View style={{ marginLeft: 'auto' }}><Lucide name="chevron-right" size={14} color={colors.textFaint} /></View>
              </TouchableOpacity>
              <TouchableOpacity style={cm.optionBtn} onPress={() => setCustomMode('until')}>
                <Lucide name="alarm-clock" size={18} color={colors.purple} />
                <Text style={cm.optionText}>{s('untilTime')}</Text>
                <View style={{ marginLeft: 'auto' }}><Lucide name="chevron-right" size={14} color={colors.textFaint} /></View>
              </TouchableOpacity>

              {/* F020: "looking for players" — subtle tint when on, thin stroke (no solid fill). */}
              <TouchableOpacity
                style={[
                  cm.optionBtn,
                  lookingForPlayers && { borderWidth: 1, borderColor: colors.primary, backgroundColor: colors.primaryPale },
                ]}
                onPress={() => setLookingForPlayers(!lookingForPlayers)}
                accessibilityRole="switch"
                accessibilityState={{ checked: lookingForPlayers }}
                testID="checkin-looking-for-players"
              >
                <Lucide name="users" size={18} color={lookingForPlayers ? colors.primary : colors.textMuted} />
                <Text style={cm.optionText}>{s('checkinLookingForPlayers')}</Text>
                <View style={{ marginLeft: 'auto' }}>
                  <Lucide name={lookingForPlayers ? 'check' : 'circle'} size={16}
                    color={lookingForPlayers ? colors.primary : colors.textFaint} />
                </View>
              </TouchableOpacity>
            </View>

            {lookingForPlayers && (
              <TextInput
                style={cm.input}
                placeholder={s('checkinSessionNotePlaceholder')}
                placeholderTextColor={colors.textFaint}
                value={sessionNote}
                onChangeText={setSessionNote}
                maxLength={120}
                accessibilityLabel={s('checkinSessionNotePlaceholder')}
              />
            )}
            </>
          )}

          {customMode === 'minutes' && (
            <View style={cm.customSection}>
              <Text style={cm.customLabel}>{s('customMinutes')}</Text>
              <TextInput
                style={cm.input}
                keyboardType="number-pad"
                placeholder={s('customMinutesPlaceholder')}
                placeholderTextColor={colors.textFaint}
                value={customMinutes}
                onChangeText={setCustomMinutes}
                autoFocus
              />
              <View style={cm.customActions}>
                <TouchableOpacity style={cm.backBtn} onPress={() => setCustomMode('none')}>
                  <Text style={cm.backBtnText}>{s('cancel')}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={cm.confirmBtn} onPress={onConfirmCustom}>
                  <Text style={cm.confirmBtnText}>{s('confirm')}</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {customMode === 'until' && (
            <View style={cm.customSection}>
              <Text style={cm.customLabel}>{s('selectEndTime')}</Text>
              <View style={cm.timeRow}>
                <TextInput
                  style={[cm.input, cm.timeInput]}
                  keyboardType="number-pad"
                  placeholder="HH"
                  placeholderTextColor={colors.textFaint}
                  value={untilHour}
                  onChangeText={(t) => setUntilHour(t.replace(/\D/g, '').slice(0, 2))}
                  maxLength={2}
                  autoFocus
                />
                <Text style={cm.timeSep}>:</Text>
                <TextInput
                  style={[cm.input, cm.timeInput]}
                  keyboardType="number-pad"
                  placeholder="MM"
                  placeholderTextColor={colors.textFaint}
                  value={untilMinute}
                  onChangeText={(t) => setUntilMinute(t.replace(/\D/g, '').slice(0, 2))}
                  maxLength={2}
                />
              </View>
              <View style={cm.customActions}>
                <TouchableOpacity style={cm.backBtn} onPress={() => setCustomMode('none')}>
                  <Text style={cm.backBtnText}>{s('cancel')}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={cm.confirmBtn} onPress={onConfirmCustom}>
                  <Text style={cm.confirmBtnText}>{s('confirm')}</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
          </KeyboardAwareScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
