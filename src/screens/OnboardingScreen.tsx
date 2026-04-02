import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
} from 'react-native';
import Animated, {
  FadeInRight,
  FadeOutLeft,
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import { Springs } from '../lib/motion';
import { hapticSelection } from '../lib/haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useI18n } from '../hooks/useI18n';
import { useTheme } from '../hooks/useTheme';
import type { ThemeColors } from '../theme';
import { Fonts, FontSize, FontWeight, Spacing, Radius, Shadows } from '../theme';
import { CityPickerModal } from '../components/CityPickerModal';
import { Lucide } from '../components/Icon';

const INTEREST_KEYS = [
  'onboardingInterest1',
  'onboardingInterest2',
  'onboardingInterest3',
  'onboardingInterest4',
] as const;

const TOTAL_STEPS = 3;

export function OnboardingScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { s } = useI18n();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [step, setStep] = useState(0);
  const [selectedCity, setSelectedCity] = useState<string | null>(null);
  const [cityPickerVisible, setCityPickerVisible] = useState(false);
  const [selectedInterests, setSelectedInterests] = useState<Set<string>>(
    new Set(),
  );

  const finish = () => {
    router.replace('/(tabs)/' as any);
  };

  const handleSkip = () => {
    finish();
  };

  const handleContinue = () => {
    if (step < TOTAL_STEPS - 1) {
      setStep(step + 1);
    } else {
      finish();
    }
  };

  const toggleInterest = (key: string) => {
    hapticSelection();
    setSelectedInterests((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const renderDots = () => (
    <View style={styles.dots}>
      {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
        <DotIndicator key={i} active={i === step} colors={colors} styles={styles} />
      ))}
    </View>
  );

  const renderStep0 = () => (
    <View style={styles.stepContent}>
      <Text style={styles.heading}>{s('onboardingWelcome')}</Text>
      <Text style={styles.logo}>TT PORTAL</Text>

      <View style={styles.citySection}>
        <Text style={styles.label}>{s('onboardingCityLabel')}</Text>
        <Pressable
          style={styles.cityButton}
          onPress={() => setCityPickerVisible(true)}
          testID="city-picker-button"
        >
          <Lucide name="map-pin" size={18} color={colors.primary} />
          <Text style={styles.cityButtonText}>
            {selectedCity || s('onboardingSelectCity')}
          </Text>
          <Lucide name="chevron-down" size={18} color={colors.textMuted} />
        </Pressable>
      </View>

      <CityPickerModal
        visible={cityPickerVisible}
        selectedCity={selectedCity}
        onSelect={(city) => {
          setSelectedCity(city);
          setCityPickerVisible(false);
        }}
        onClose={() => setCityPickerVisible(false)}
      />
    </View>
  );

  const renderStep1 = () => (
    <View style={styles.stepContent}>
      <Text style={styles.heading}>{s('onboardingInterestsTitle')}</Text>

      <View style={styles.pillsContainer}>
        {INTEREST_KEYS.map((key) => {
          const active = selectedInterests.has(key);
          return (
            <Pressable
              key={key}
              style={[styles.pill, active && styles.pillActive]}
              onPress={() => toggleInterest(key)}
              testID={`interest-${key}`}
            >
              <Text
                style={[
                  styles.pillText,
                  active && styles.pillTextActive,
                ]}
              >
                {s(key)}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );

  const renderStep2 = () => (
    <View style={styles.stepContent}>
      <Text style={styles.heading}>{s('onboardingReadyTitle')}</Text>
      <Text style={styles.description}>{s('onboardingReadyDesc')}</Text>
    </View>
  );

  const stepRenderers = [renderStep0, renderStep1, renderStep2];

  return (
    <View
      style={[
        styles.container,
        { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 },
      ]}
      testID="onboarding-screen"
    >
      {renderDots()}

      <View style={styles.body}>
        <Animated.View
          key={`step-${step}`}
          entering={FadeInRight.duration(300)}
          exiting={FadeOutLeft.duration(200)}
        >
          {stepRenderers[step]()}
        </Animated.View>
      </View>

      <View style={styles.footer}>
        <Pressable
          style={styles.primaryButton}
          onPress={handleContinue}
          testID="onboarding-continue"
        >
          <Text style={styles.primaryButtonText}>
            {step === TOTAL_STEPS - 1
              ? s('onboardingStart')
              : s('onboardingContinue')}
          </Text>
        </Pressable>

        <Pressable
          style={styles.skipButton}
          onPress={handleSkip}
          testID="onboarding-skip"
        >
          <Text style={styles.skipText}>{s('onboardingSkip')}</Text>
        </Pressable>
      </View>
    </View>
  );
}

function DotIndicator({ active, colors, styles: s }: { active: boolean; colors: ThemeColors; styles: ReturnType<typeof createStyles> }) {
  const width = useSharedValue(active ? 24 : 8);
  const bg = useSharedValue(active ? 1 : 0);

  React.useEffect(() => {
    width.value = withSpring(active ? 24 : 8, Springs.snappy);
    bg.value = withSpring(active ? 1 : 0, Springs.snappy);
  }, [active, width, bg]);

  const animStyle = useAnimatedStyle(() => ({
    width: width.value,
    backgroundColor: bg.value > 0.5 ? colors.primary : colors.borderLight,
  }));

  return <Animated.View style={[s.dot, animStyle]} />;
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.bg,
      paddingHorizontal: 28,
    },
    dots: {
      flexDirection: 'row',
      justifyContent: 'center',
      gap: Spacing.xs,
      marginBottom: Spacing.md,
    },
    dot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: colors.borderLight,
    },
    dotActive: {
      // Kept for type compat; animation handles width + color
    },
    body: {
      flex: 1,
      justifyContent: 'center',
    },
    stepContent: {
      alignItems: 'center',
      gap: Spacing.lg,
    },
    heading: {
      fontFamily: Fonts.heading,
      fontSize: 28,
      fontWeight: FontWeight.bold,
      color: colors.text,
      textAlign: 'center',
    },
    logo: {
      fontFamily: Fonts.heading,
      fontSize: 36,
      fontWeight: FontWeight.extrabold,
      color: colors.primary,
      textAlign: 'center',
    },
    label: {
      fontFamily: Fonts.body,
      fontSize: FontSize.md,
      fontWeight: FontWeight.medium,
      color: colors.textMuted,
      textTransform: 'uppercase',
      letterSpacing: 1,
      marginBottom: 4,
    },
    citySection: {
      width: '100%',
      marginTop: 12,
    },
    cityButton: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.bgAlt,
      borderRadius: Radius.md,
      paddingHorizontal: Spacing.md,
      paddingVertical: 14,
      gap: 10,
      borderWidth: 1,
      borderColor: colors.border,
      ...Shadows.sm,
    },
    cityButtonText: {
      flex: 1,
      fontFamily: Fonts.body,
      fontSize: 15,
      color: colors.text,
    },
    pillsContainer: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'center',
      gap: Spacing.sm,
      marginTop: Spacing.sm,
    },
    pill: {
      paddingHorizontal: Spacing.lg,
      paddingVertical: Spacing.sm,
      borderRadius: Radius.full,
      backgroundColor: colors.bgAlt,
      borderWidth: 1,
      borderColor: colors.border,
      ...Shadows.sm,
    },
    pillActive: {
      backgroundColor: colors.primaryPale,
      borderColor: colors.primary,
    },
    pillText: {
      fontFamily: Fonts.body,
      fontSize: FontSize.lg,
      fontWeight: FontWeight.medium,
      color: colors.textMuted,
    },
    pillTextActive: {
      color: colors.primary,
      fontWeight: FontWeight.semibold,
    },
    description: {
      fontFamily: Fonts.body,
      fontSize: FontSize.xl,
      color: colors.textMuted,
      textAlign: 'center',
      lineHeight: 24,
      paddingHorizontal: Spacing.md,
    },
    footer: {
      alignItems: 'center',
      gap: Spacing.md,
    },
    primaryButton: {
      width: '100%',
      backgroundColor: colors.primary,
      borderRadius: Radius.md,
      height: 52,
      alignItems: 'center',
      justifyContent: 'center',
      ...Shadows.md,
    },
    primaryButtonText: {
      fontFamily: Fonts.body,
      fontSize: FontSize.xl,
      fontWeight: FontWeight.bold,
      color: colors.textOnPrimary,
    },
    skipButton: {
      paddingVertical: Spacing.xs,
    },
    skipText: {
      fontFamily: Fonts.body,
      fontSize: FontSize.lg,
      color: colors.textFaint,
    },
  });
}
