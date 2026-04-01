import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Alert, ActivityIndicator, Image } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Lucide } from '../components/Icon';
import { useTheme } from '../hooks/useTheme';
import type { ThemeColors } from '../theme';
import { Fonts, FontSize, FontWeight, Spacing, Radius, Shadows } from '../theme';
import { useSession } from '../hooks/useSession';
import { useI18n } from '../hooks/useI18n';
import { getVenueById } from '../services/venues';
import { submitVote, getVoteSummary } from '../services/conditions';
import type { ConditionVoteValue } from '../types/database';

type ConditionOption = 'good' | 'acceptable' | 'damaged';

const CONDITION_MAP: Record<ConditionOption, ConditionVoteValue> = {
  good: 'buna',
  acceptable: 'acceptabila',
  damaged: 'deteriorata',
};

interface Props {
  venueId?: string;
}

export function ConditionVotingScreen({ venueId }: Props) {
  const router = useRouter();
  const { user } = useSession();
  const { s } = useI18n();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const OPTIONS: { key: ConditionOption; color: string; label: string; desc: string }[] = [
    { key: 'good', color: colors.primaryLight, label: s('conditionGood'), desc: s('goodDesc') },
    { key: 'acceptable', color: colors.amber, label: s('conditionAcceptable'), desc: s('acceptableDesc') },
    { key: 'damaged', color: colors.red, label: s('conditionDegraded'), desc: s('damagedDesc') },
  ];

  const [selected, setSelected] = useState<ConditionOption>('good');
  const [venueName, setVenueName] = useState('');
  const [voteStatsText, setVoteStatsText] = useState('');
  const [loading, setLoading] = useState(false);
  const [photoUri, setPhotoUri] = useState<string | null>(null);

  useEffect(() => {
    if (!venueId) return;
    let cancelled = false;

    async function load() {
      const [venueRes, votesRes] = await Promise.all([
        getVenueById(Number(venueId)),
        getVoteSummary(Number(venueId)),
      ]);
      if (cancelled) return;

      if (venueRes.data) {
        setVenueName(venueRes.data.name);
      }

      if (votesRes.data && votesRes.data.length > 0) {
        const votes = votesRes.data;
        const total = votes.length;
        const bunaCount = votes.filter((v: any) => v.condition === 'buna').length;
        const pct = total > 0 ? Math.round((bunaCount / total) * 100) : 0;
        setVoteStatsText(total + ' ' + s('evaluations') + ' \u00B7 ' + pct + s('pctGood'));
      } else {
        setVoteStatsText(s('noVotesYet'));
      }
    }

    load();
    return () => { cancelled = true; };
  }, [venueId]);

  const handlePickPhoto = useCallback(async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(s('error'), 'Photo library permission denied');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      quality: 0.7,
    });
    if (!result.canceled && result.assets.length > 0) {
      setPhotoUri(result.assets[0].uri);
    }
  }, [s]);

  const handleSubmit = useCallback(async () => {
    if (!user || !venueId) return;
    setLoading(true);
    const { error } = await submitVote({
      user_id: user.id,
      venue_id: Number(venueId),
      condition: CONDITION_MAP[selected],
      photo_url: photoUri,
    });
    setLoading(false);
    if (error) { Alert.alert(s('error'), error.message); return; }
    Alert.alert(s('success'), s('voteRecorded'));
    router.back();
  }, [user, venueId, selected, router, photoUri]);

  return (
    <SafeAreaView style={styles.container}>
      {/* Map bg placeholder */}
      <View style={styles.mapBg} />

      {/* Voting Sheet */}
      <View style={styles.sheet}>
        {/* Handle */}
        <View style={styles.handleWrap}>
          <View style={styles.handleBar} />
        </View>

        {/* Header */}
        <View style={styles.sheetHeader}>
          <Text style={styles.sheetTitle}>{s('conditionTitle')}</Text>
          <TouchableOpacity style={styles.closeBtn} onPress={() => router.back()}>
            <Lucide name="x" size={16} color={colors.textMuted} />
          </TouchableOpacity>
        </View>

        {/* Venue Context */}
        <View style={styles.venueCtx}>
          <View style={styles.venueIcon}>
            <Lucide name="map-pin" size={20} color={colors.primaryLight} />
          </View>
          <View style={styles.venueInfo}>
            <Text style={styles.venueNameStyle}>{venueName || s('loading')}</Text>
            <Text style={styles.venueSub}>{s('evaluateCurrent')}</Text>
          </View>
        </View>

        <ScrollView style={styles.voteForm}>
          {/* Options */}
          <Text style={styles.label}>{s('howDoYouRate')}</Text>
          <View style={styles.optGrid}>
            {OPTIONS.map((opt) => (
              <TouchableOpacity
                key={opt.key}
                style={[
                  styles.optCard,
                  selected === opt.key && { borderColor: opt.color, borderWidth: 2, backgroundColor: opt.key === 'good' ? colors.primaryPale : undefined },
                ]}
                onPress={() => setSelected(opt.key)}
              >
                <View style={[styles.optDot, { backgroundColor: opt.color }]} />
                <View style={styles.optInfo}>
                  <Text style={styles.optLabel}>{opt.label}</Text>
                  <Text style={styles.optDesc}>{opt.desc}</Text>
                </View>
                {selected === opt.key && (
                  <Lucide name="check-circle" size={22} color={opt.color} />
                )}
              </TouchableOpacity>
            ))}
          </View>

          {/* Photo */}
          <Text style={styles.label}>{s('addPhotoOptional')}</Text>
          <TouchableOpacity style={styles.photoBtn} onPress={handlePickPhoto}>
            {photoUri ? (
              <Image source={{ uri: photoUri }} style={{ width: 48, height: 48, borderRadius: 8 }} />
            ) : (
              <Lucide name="camera" size={20} color={colors.textFaint} />
            )}
            <Text style={styles.photoBtnText}>
              {photoUri ? s('changePhoto') || 'Change photo' : s('photographTable')}
            </Text>
          </TouchableOpacity>

          {/* Vote Stats */}
          <View style={styles.voteStats}>
            <Lucide name="bar-chart-3" size={16} color={colors.textMuted} />
            <Text style={styles.voteStatsTextStyle}>{voteStatsText}</Text>
          </View>
        </ScrollView>

        {/* Footer */}
        <View style={styles.footer}>
          <TouchableOpacity style={styles.cancelBtn} onPress={() => router.back()}>
            <Text style={styles.cancelText}>{s('cancel')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.submitBtn, loading && { opacity: 0.6 }]} onPress={handleSubmit} disabled={loading}>
            {loading ? (
              <ActivityIndicator size="small" color={colors.textOnPrimary} />
            ) : (
              <>
                <Text style={styles.submitText}>{s('submitVote')}</Text>
                <Lucide name="send" size={16} color={colors.textOnPrimary} />
              </>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: {
      flex: 1,
    },
    mapBg: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: colors.mapBg,
    },
    sheet: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      height: 620,
      backgroundColor: colors.bgAlt,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      ...Shadows.lg,
    },
    handleWrap: {
      alignItems: 'center',
      justifyContent: 'center',
      height: 28,
    },
    handleBar: {
      width: 36,
      height: 4,
      borderRadius: 2,
      backgroundColor: colors.border,
    },
    sheetHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: Spacing.lg,
      paddingBottom: Spacing.sm,
    },
    sheetTitle: {
      fontFamily: Fonts.heading,
      fontSize: 19,
      fontWeight: FontWeight.bold,
      color: colors.text,
    },
    closeBtn: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: colors.bgMuted,
      alignItems: 'center',
      justifyContent: 'center',
    },
    venueCtx: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: Spacing.lg,
      paddingBottom: Spacing.md,
      gap: 10,
    },
    venueIcon: {
      width: 40,
      height: 40,
      borderRadius: Radius.md,
      backgroundColor: colors.primaryPale,
      alignItems: 'center',
      justifyContent: 'center',
    },
    venueInfo: {
      flex: 1,
      gap: 2,
    },
    venueNameStyle: {
      fontFamily: Fonts.body,
      fontSize: FontSize.lg,
      fontWeight: FontWeight.semibold,
      color: colors.text,
    },
    venueSub: {
      fontFamily: Fonts.body,
      fontSize: FontSize.base,
      color: colors.textFaint,
    },
    voteForm: {
      flex: 1,
      paddingHorizontal: Spacing.lg,
    },
    label: {
      fontFamily: Fonts.body,
      fontSize: FontSize.md,
      fontWeight: FontWeight.semibold,
      color: colors.textMuted,
      marginBottom: Spacing.xs,
      marginTop: Spacing.md,
    },
    optGrid: {
      gap: Spacing.xs,
    },
    optCard: {
      flexDirection: 'row',
      alignItems: 'center',
      borderRadius: 12,
      padding: 14,
      gap: Spacing.sm,
      borderWidth: 1,
      borderColor: colors.border,
      ...Shadows.sm,
    },
    optDot: {
      width: 20,
      height: 20,
      borderRadius: 10,
    },
    optInfo: {
      flex: 1,
      gap: 2,
    },
    optLabel: {
      fontFamily: Fonts.body,
      fontSize: FontSize.lg,
      fontWeight: FontWeight.semibold,
      color: colors.text,
    },
    optDesc: {
      fontFamily: Fonts.body,
      fontSize: FontSize.base,
      color: colors.textFaint,
    },
    photoBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: Radius.md,
      height: 60,
      gap: Spacing.xs,
      borderWidth: 1.5,
      borderColor: colors.border,
      borderStyle: 'dashed',
      ...Shadows.sm,
    },
    photoBtnText: {
      fontFamily: Fonts.body,
      fontSize: FontSize.md,
      fontWeight: FontWeight.medium,
      color: colors.textFaint,
    },
    voteStats: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.bgMuted,
      borderRadius: Radius.md,
      padding: Spacing.sm,
      gap: Spacing.xs,
      marginTop: Spacing.md,
      marginBottom: Spacing.md,
    },
    voteStatsTextStyle: {
      flex: 1,
      fontFamily: Fonts.body,
      fontSize: FontSize.base,
      color: colors.textMuted,
    },
    footer: {
      flexDirection: 'row',
      paddingHorizontal: Spacing.lg,
      paddingVertical: Spacing.sm,
      gap: Spacing.xs,
      borderTopWidth: 1,
      borderTopColor: colors.borderLight,
    },
    cancelBtn: {
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: Radius.md,
      paddingVertical: 10,
      paddingHorizontal: 16,
      borderWidth: 1,
      borderColor: colors.border,
    },
    cancelText: {
      fontFamily: Fonts.body,
      fontSize: FontSize.md,
      fontWeight: FontWeight.medium,
      color: colors.textMuted,
    },
    submitBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.primary,
      borderRadius: Radius.md,
      paddingVertical: 10,
      paddingHorizontal: Spacing.lg,
      gap: 6,
      ...Shadows.md,
    },
    submitText: {
      fontFamily: Fonts.body,
      fontSize: FontSize.md,
      fontWeight: FontWeight.semibold,
      color: colors.textOnPrimary,
    },
  });
}
