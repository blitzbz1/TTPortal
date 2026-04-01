import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Switch, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Lucide } from '../components/Icon';
import { useTheme } from '../hooks/useTheme';
import type { ThemeColors } from '../theme';
import { Fonts, Radius, Shadows } from '../theme';
import { useSession } from '../hooks/useSession';
import { useI18n } from '../hooks/useI18n';
import { getProfile, updateProfile } from '../services/profiles';

export function SettingsScreen() {
  const router = useRouter();
  const { user } = useSession();
  const { lang, setLang, s } = useI18n();
  const { colors, mode, setMode, isDark } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [notifyCheckins, setNotifyCheckins] = useState(true);

  useEffect(() => {
    if (!user) return;
    getProfile(user.id).then((res) => {
      if (res.data) setNotifyCheckins((res.data as any).notify_friend_checkins ?? true);
    });
  }, [user]);

  const handleToggleCheckinNotif = useCallback(async (value: boolean) => {
    setNotifyCheckins(value);
    if (user) {
      await updateProfile(user.id, { notify_friend_checkins: value });
    }
  }, [user]);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 10, right: 10, bottom: 10, left: 10 }}>
          <Lucide name="arrow-left" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{s('settings')}</Text>
        <View style={{ width: 22 }} />
      </View>

      <ScrollView style={styles.scroll}>
        {/* Notifications */}
        <TouchableOpacity style={styles.row} onPress={() => router.push('/(protected)/notifications' as any)}>
          <View style={[styles.rowIcon, { backgroundColor: colors.amberPale }]}>
            <Lucide name="bell" size={18} color={colors.accent} />
          </View>
          <Text style={styles.rowLabel}>{s('notifications')}</Text>
          <Lucide name="chevron-right" size={16} color={colors.textFaint} />
        </TouchableOpacity>

        {/* Check-in notifications */}
        <View style={styles.row}>
          <View style={[styles.rowIcon, { backgroundColor: colors.primaryPale }]}>
            <Lucide name="map-pin" size={18} color={colors.primaryMid} />
          </View>
          <View style={styles.rowContent}>
            <Text style={styles.rowLabel}>{s('notifyFriendCheckins')}</Text>
            <Text style={styles.rowDesc}>{s('notifyFriendCheckinsDesc')}</Text>
          </View>
          <Switch
            value={notifyCheckins}
            onValueChange={handleToggleCheckinNotif}
            trackColor={{ false: colors.border, true: colors.primaryLight }}
            thumbColor={colors.bgAlt}
          />
        </View>

        {/* Language */}
        <View style={styles.row}>
          <View style={[styles.rowIcon, { backgroundColor: colors.bluePale }]}>
            <Lucide name="globe" size={18} color={colors.blue} />
          </View>
          <Text style={styles.rowLabel}>{s('language')}</Text>
          <View style={styles.toggle}>
            {(['ro', 'en'] as const).map((l) => (
              <TouchableOpacity
                key={l}
                style={[styles.toggleOption, lang === l && styles.toggleOptionActive]}
                onPress={() => setLang(l)}
              >
                <Text style={[styles.toggleText, lang === l && styles.toggleTextActive]}>
                  {l.toUpperCase()}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Theme */}
        <View style={styles.row}>
          <View style={[styles.rowIcon, { backgroundColor: colors.purplePale }]}>
            <Lucide name={isDark ? 'moon' : 'sun'} size={18} color={colors.purple} />
          </View>
          <Text style={styles.rowLabel}>{s('theme')}</Text>
          <View style={styles.toggle}>
            {([{ key: 'light', icon: 'sun' }, { key: 'dark', icon: 'moon' }, { key: 'system', icon: 'monitor' }] as const).map(({ key: m, icon }) => (
              <TouchableOpacity
                key={m}
                style={[styles.toggleOption, mode === m && styles.toggleOptionActive]}
                onPress={() => setMode(m)}
              >
                <Lucide name={icon} size={14} color={mode === m ? colors.text : colors.textFaint} />
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Privacy */}
        <TouchableOpacity style={styles.row} onPress={() => Linking.openSettings()}>
          <View style={[styles.rowIcon, { backgroundColor: colors.bgMuted }]}>
            <Lucide name="shield" size={18} color={colors.textMuted} />
          </View>
          <Text style={styles.rowLabel}>{s('privacy')}</Text>
          <Lucide name="chevron-right" size={16} color={colors.textFaint} />
        </TouchableOpacity>

      </ScrollView>
    </SafeAreaView>
  );
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
      backgroundColor: colors.bgAlt,
      height: 52,
      paddingHorizontal: 16,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      ...Shadows.bar,
    },
    headerTitle: {
      fontFamily: Fonts.heading,
      fontSize: 18,
      fontWeight: '700',
      color: colors.text,
    },
    scroll: {
      flex: 1,
      paddingTop: 8,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 14,
      paddingHorizontal: 16,
      gap: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.borderLight,
    },
    rowIcon: {
      width: 36,
      height: 36,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
    },
    rowContent: {
      flex: 1,
      gap: 2,
    },
    rowLabel: {
      flex: 1,
      fontFamily: Fonts.body,
      fontSize: 15,
      fontWeight: '500',
      color: colors.text,
    },
    rowDesc: {
      fontFamily: Fonts.body,
      fontSize: 11,
      color: colors.textFaint,
    },
    toggle: {
      flexDirection: 'row',
      backgroundColor: colors.bgMuted,
      borderRadius: 8,
      padding: 2,
    },
    toggleOption: {
      paddingVertical: 6,
      paddingHorizontal: 10,
      borderRadius: 6,
    },
    toggleOptionActive: {
      backgroundColor: colors.bgAlt,
    },
    toggleText: {
      fontFamily: Fonts.body,
      fontSize: 11,
      fontWeight: '500',
      color: colors.textFaint,
    },
    toggleTextActive: {
      color: colors.text,
      fontWeight: '600',
    },
  });
}
