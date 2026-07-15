import React, { useMemo } from 'react';
import { Linking, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useI18n } from '../hooks/useI18n';
import { useTheme } from '../hooks/useTheme';
import { buildMapAppLinks, type MapDestination } from '../lib/mapLinks';
import { Fonts, FontSize, FontWeight, Radius, Shadows, Spacing } from '../theme';
import { Lucide } from './Icon';

interface Props {
  visible: boolean;
  destination: MapDestination | null;
  onClose: () => void;
}

export function MapAppChooserModal({ visible, destination, onClose }: Props) {
  const { s } = useI18n();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const links = destination ? buildMapAppLinks(destination) : null;
  const options = links
    ? ([
        { id: 'google', label: 'Google Maps', icon: 'map-pin', url: links.google, tone: colors.primaryMid, bg: colors.primaryPale },
        { id: 'apple', label: 'Apple Maps', icon: 'apple', url: links.apple, tone: colors.text, bg: colors.bgMuted },
        { id: 'waze', label: 'Waze', icon: 'navigation', url: links.waze, tone: colors.blue, bg: colors.bluePale },
      ] as const)
    : [];

  const open = async (url: string) => {
    onClose();
    await Linking.openURL(url);
  };

  return (
    <Modal visible={visible && !!links} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.card} onPress={() => {}}>
          <View style={styles.handle} />
          <View style={styles.hero}>
            <View style={styles.heroIcon}>
              <Lucide name="navigation" size={22} color={colors.textOnPrimary} />
            </View>
            <View style={styles.heroCopy}>
              <Text style={styles.kicker}>{s('vdRoute')}</Text>
              <Text style={styles.title} numberOfLines={1}>
                {destination?.name || s('vdRoute')}
              </Text>
              {destination?.address ? (
                <Text style={styles.subtitle} numberOfLines={1}>{destination.address}</Text>
              ) : null}
            </View>
          </View>
          {links ? (
            <View style={styles.options}>
              {options.map(({ id, label, icon, url, tone, bg }) => (
                <Pressable
                  key={id}
                  style={styles.option}
                  onPress={() => void open(url)}
                  testID={`map-app-${id}`}
                >
                  <View style={styles.optionLeft}>
                    <View style={[styles.optionIcon, { backgroundColor: bg, borderColor: tone + '33' }]}>
                      <Lucide name={icon} size={18} color={tone} />
                    </View>
                    <Text style={styles.optionText}>{label}</Text>
                  </View>
                  <View style={styles.optionArrow}>
                    <Lucide name="chevron-right" size={17} color={colors.textMuted} />
                  </View>
                </Pressable>
              ))}
            </View>
          ) : null}
          <Pressable style={styles.cancel} onPress={onClose}>
            <Text style={styles.cancelText}>{s('cancel')}</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function createStyles(colors: ReturnType<typeof useTheme>['colors']) {
  return StyleSheet.create({
    overlay: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'flex-end',
      padding: Spacing.lg,
      backgroundColor: 'rgba(0,0,0,0.62)',
    },
    card: {
      width: '100%',
      maxWidth: 390,
      padding: Spacing.md,
      borderRadius: Radius.xl,
      backgroundColor: colors.bgAlt,
      borderWidth: 1,
      borderColor: colors.borderLight,
      ...Shadows.lg,
    },
    handle: {
      alignSelf: 'center',
      width: 42,
      height: 4,
      borderRadius: 999,
      backgroundColor: colors.border,
      marginBottom: Spacing.md,
    },
    hero: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      padding: 12,
      borderRadius: Radius.lg,
      backgroundColor: colors.primaryPale,
      borderWidth: 1,
      borderColor: colors.primaryDim,
      marginBottom: Spacing.md,
    },
    heroIcon: {
      width: 48,
      height: 48,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.primary,
      ...Shadows.sm,
    },
    heroCopy: { flex: 1, minWidth: 0 },
    kicker: {
      fontFamily: Fonts.body,
      fontSize: 10,
      fontWeight: FontWeight.bold,
      letterSpacing: 0.9,
      textTransform: 'uppercase',
      color: colors.primaryMid,
    },
    title: {
      fontFamily: Fonts.heading,
      fontSize: FontSize.xl,
      fontWeight: FontWeight.bold,
      color: colors.text,
    },
    subtitle: {
      marginTop: 2,
      fontFamily: Fonts.body,
      fontSize: FontSize.sm,
      color: colors.textMuted,
    },
    options: { gap: 9 },
    option: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 12,
      paddingVertical: 11,
      borderRadius: Radius.lg,
      backgroundColor: colors.bgMuted,
      borderWidth: 1,
      borderColor: colors.borderLight,
    },
    optionLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    optionIcon: {
      width: 40,
      height: 40,
      borderRadius: 13,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
    },
    optionText: {
      fontFamily: Fonts.body,
      fontSize: FontSize.lg,
      fontWeight: FontWeight.semibold,
      color: colors.text,
    },
    optionArrow: {
      width: 28,
      height: 28,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.bgAlt,
    },
    cancel: { alignItems: 'center', paddingTop: 14 },
    cancelText: {
      fontFamily: Fonts.body,
      fontSize: FontSize.md,
      fontWeight: FontWeight.semibold,
      color: colors.textMuted,
    },
  });
}
