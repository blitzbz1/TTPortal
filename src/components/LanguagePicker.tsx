import React, { useMemo, useState } from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Lucide } from './Icon';
import { useI18n } from '../hooks/useI18n';
import {
  LANGUAGE_NAMES,
  SUPPORTED_LANGS,
  type Lang,
} from '../contexts/I18nProvider';
import { useTheme } from '../hooks/useTheme';
import { Fonts, FontSize, FontWeight, Spacing, type ThemeColors } from '../theme';

interface LanguagePickerProps {
  /** Accessibility label for the trigger pill. */
  accessibilityLabel?: string;
}

/**
 * Compact language switcher: a globe pill showing the current language that
 * opens a modal list of every supported language (by native name). Scales to
 * any number of languages, unlike the previous inline segmented toggle.
 */
export function LanguagePicker({ accessibilityLabel = 'Language' }: LanguagePickerProps) {
  const { lang, setLang, s } = useI18n();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [open, setOpen] = useState(false);

  const select = (next: Lang) => {
    setLang(next);
    setOpen(false);
  };

  return (
    <View>
      <TouchableOpacity
        style={styles.trigger}
        onPress={() => setOpen(true)}
        activeOpacity={0.78}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
      >
        <Lucide name="globe" size={14} color={colors.textMuted} />
        <Text style={styles.triggerText}>{LANGUAGE_NAMES[lang]}</Text>
      </TouchableOpacity>

      <Modal
        visible={open}
        transparent
        animationType="fade"
        onRequestClose={() => setOpen(false)}
      >
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <Pressable style={styles.card} onPress={() => {}}>
            <Text style={styles.cardTitle}>{s('language')}</Text>
            {SUPPORTED_LANGS.map((option) => {
              const active = option === lang;
              return (
                <TouchableOpacity
                  key={option}
                  style={[styles.option, active && styles.optionActive]}
                  onPress={() => select(option)}
                  activeOpacity={0.78}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                >
                  <Text style={[styles.optionText, active && styles.optionTextActive]}>
                    {LANGUAGE_NAMES[option]}
                  </Text>
                  {active ? <Lucide name="check" size={16} color={colors.primary} /> : null}
                </TouchableOpacity>
              );
            })}
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    trigger: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.bgAlt,
      paddingVertical: 6,
      paddingHorizontal: 12,
    },
    triggerText: {
      fontFamily: Fonts.body,
      fontSize: FontSize.md,
      fontWeight: FontWeight.semibold,
      color: colors.text,
    },
    backdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.4)',
      alignItems: 'center',
      justifyContent: 'center',
      padding: Spacing.lg,
    },
    card: {
      width: '100%',
      maxWidth: 320,
      backgroundColor: colors.bgAlt,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.borderLight,
      padding: Spacing.sm,
    },
    cardTitle: {
      fontFamily: Fonts.heading,
      fontSize: FontSize.xl,
      fontWeight: FontWeight.bold,
      color: colors.text,
      paddingHorizontal: Spacing.sm,
      paddingTop: Spacing.xs,
      paddingBottom: Spacing.sm,
    },
    option: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 12,
      paddingHorizontal: Spacing.sm,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: 'transparent',
    },
    optionActive: {
      backgroundColor: colors.primaryPale,
      borderColor: colors.primaryLight,
    },
    optionText: {
      fontFamily: Fonts.body,
      fontSize: FontSize.lg,
      fontWeight: FontWeight.medium,
      color: colors.text,
    },
    optionTextActive: {
      color: colors.primaryMid,
      fontWeight: FontWeight.semibold,
    },
  });
}
