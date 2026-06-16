import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Pressable,
  Share,
  Image,
  ActivityIndicator,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  withDelay,
  withSequence,
  FadeInUp,
} from 'react-native-reanimated';
import { Lucide } from './Icon';
import { useTheme } from '../hooks/useTheme';
import type { ThemeColors } from '../theme';
import { Fonts, FontSize, FontWeight, Spacing, Radius, Shadows } from '../theme';
import { useI18n } from '../hooks/useI18n';
import { hapticSuccess } from '../lib/haptics';
import { sharePayload, venueUrl } from '../lib/shareLinks';
import { showAlert } from '../lib/dialogs';
import { Springs, Duration, Easings } from '../lib/motion';
import { VenueFreeTablesBlock } from './VenueFreeTablesBlock';
import { uploadMomentImage, postCheckinMoment } from '../features/checkinMoments';

/* ── Tiny particle burst (confetti-lite, no deps) ── */
const PARTICLE_COUNT = 8;
const PARTICLE_COLORS = ['#34C759', '#FFD60A', '#FF9F0A', '#30D158', '#64D2FF', '#BF5AF2'];

function CelebrationBurst({ visible }: { visible: boolean }) {
  const particles = useMemo(
    () =>
      Array.from({ length: PARTICLE_COUNT }, (_, i) => {
        const angle = (i / PARTICLE_COUNT) * 2 * Math.PI;
        return { angle, color: PARTICLE_COLORS[i % PARTICLE_COLORS.length] };
      }),
    [],
  );

  return (
    <>
      {particles.map((p, i) => (
        <ParticleDot key={i} angle={p.angle} color={p.color} visible={visible} index={i} />
      ))}
    </>
  );
}

function ParticleDot({ angle, color, visible, index }: { angle: number; color: string; visible: boolean; index: number }) {
  const scale = useSharedValue(0);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const opacity = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      const radius = 50 + Math.random() * 20;
      const targetX = Math.cos(angle) * radius;
      const targetY = Math.sin(angle) * radius;

      scale.value = 0;
      translateX.value = 0;
      translateY.value = 0;
      opacity.value = 0;

      // Delay particles until after checkmark springs in (~400ms)
      scale.value = withDelay(400, withSequence(
        withSpring(1, Springs.celebration),
        withDelay(300, withTiming(0, { duration: Duration.fast })),
      ));
      translateX.value = withDelay(400, withSpring(targetX, Springs.bouncy));
      translateY.value = withDelay(400, withSpring(targetY, Springs.bouncy));
      opacity.value = withDelay(400, withSequence(
        withTiming(1, { duration: Duration.instant }),
        withDelay(500, withTiming(0, { duration: Duration.base })),
      ));
    } else {
      scale.value = 0;
      opacity.value = 0;
    }
  }, [visible, angle, scale, translateX, translateY, opacity]);

  const style = useAnimatedStyle(() => ({
    position: 'absolute' as const,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: color,
    opacity: opacity.value,
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
  }));

  return <Animated.View style={style} />;
}

/* ── Main component ── */

interface CheckinSuccessSheetProps {
  visible: boolean;
  venueName: string;
  /** When provided, the share button includes an openable venue link (T061). */
  venueId?: number | null;
  /** F042: the just-created check-in id, enabling the "Add a moment" action.
      Null for offline check-ins (no fresh row to attach to). */
  checkinId?: number | null;
  endTime?: string;
  /** True when the check-in was queued offline and will sync later. */
  queuedOffline?: boolean;
  /** F011: venue table count, scales the free-table prompt options. */
  tablesCount?: number | null;
  /** F011: when provided, shows a one-tap free-table report prompt. */
  onReportFreeTables?: (freeCount: number, groupSize: number | null) => Promise<void> | void;
  /** F042: called after a moment is successfully posted (to refresh the strip). */
  onMomentPosted?: () => void;
  onDismiss: () => void;
}

export function CheckinSuccessSheet({
  visible,
  venueName,
  venueId = null,
  checkinId = null,
  endTime,
  queuedOffline = false,
  tablesCount = null,
  onReportFreeTables,
  onMomentPosted,
  onDismiss,
}: CheckinSuccessSheetProps) {
  const { colors } = useTheme();
  const { s } = useI18n();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const checkScale = useSharedValue(0);

  // F042: "Add a moment" state.
  const [momentUri, setMomentUri] = useState<string | null>(null);
  const [momentAsset, setMomentAsset] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [caption, setCaption] = useState('');
  const [momentPosting, setMomentPosting] = useState(false);
  const [momentPosted, setMomentPosted] = useState(false);
  // Moments can attach only to a fresh online check-in.
  const canAddMoment = checkinId != null && venueId != null && !queuedOffline;

  useEffect(() => {
    if (visible) {
      hapticSuccess();
      checkScale.value = 0;
      checkScale.value = withSpring(1, Springs.celebration);
      // Reset the moment composer each time the sheet opens.
      setMomentUri(null);
      setMomentAsset(null);
      setCaption('');
      setMomentPosting(false);
      setMomentPosted(false);
    }
  }, [visible, checkScale]);

  const pickMomentPhoto = useCallback(async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      showAlert(s('error'), s('photoPermissionDenied'));
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      quality: 0.8,
    });
    if (result.canceled || result.assets.length === 0) return;
    setMomentUri(result.assets[0].uri);
    setMomentAsset(result.assets[0]);
  }, [s]);

  const postMoment = useCallback(async () => {
    if (!momentAsset || checkinId == null || venueId == null) return;
    setMomentPosting(true);
    const uploaded = await uploadMomentImage({
      uri: momentAsset.uri,
      width: momentAsset.width,
      height: momentAsset.height,
    });
    if (!uploaded.ok) {
      setMomentPosting(false);
      showAlert(
        s('error'),
        uploaded.reason === 'rate_limited'
          ? s('momentRateLimited')
          : uploaded.reason === 'processing_unavailable'
            ? s('photoProcessingUnavailable')
            : s('momentUploadError'),
      );
      return;
    }
    const { error } = await postCheckinMoment(checkinId, venueId, uploaded.url, caption.trim() || null);
    setMomentPosting(false);
    if (error) {
      showAlert(s('error'), s('momentUploadError'));
      return;
    }
    setMomentPosted(true);
    onMomentPosted?.();
  }, [momentAsset, checkinId, venueId, caption, s, onMomentPosted]);

  const checkStyle = useAnimatedStyle(() => ({
    transform: [{ scale: checkScale.value }],
  }));

  if (!visible) return null;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onDismiss}>
      <Pressable style={styles.overlay} onPress={onDismiss}>
        <Pressable style={styles.sheet} onPress={() => {}}>
          <View style={styles.handleWrap}>
            <View style={styles.handle} />
          </View>

          {/* Animated checkmark with particle burst */}
          <View style={{ alignItems: 'center', justifyContent: 'center' }}>
            <CelebrationBurst visible={visible} />
            <Animated.View style={[styles.checkCircle, checkStyle]}>
              <Lucide name="check" size={36} color={colors.textOnPrimary} />
            </Animated.View>
          </View>

          <Text style={styles.title}>{s('checkinSuccess')}</Text>
          <Text style={styles.venue}>{venueName}</Text>

          {endTime && (
            <View style={styles.timeRow}>
              <Lucide name="clock" size={14} color={colors.textFaint} />
              <Text style={styles.timeText}>{s('untilTime')} {endTime}</Text>
            </View>
          )}

          {queuedOffline && (
            <View style={styles.timeRow} testID="checkin-queued-note">
              <Lucide name="cloud-off" size={14} color={colors.textFaint} />
              <Text style={styles.timeText}>{s('checkinQueuedNote')}</Text>
            </View>
          )}

          {/* XP animation — slides up after checkmark */}
          <Animated.View
            entering={FadeInUp.delay(600).duration(400).easing(Easings.decelerate)}
            style={styles.xpRow}
          >
            <Text style={styles.xpText}>+10 XP</Text>
          </Animated.View>

          {/* F011: one-tap free-table report while we know they're on-site.
              Offline check-ins can't report (no fresh write). */}
          {onReportFreeTables && !queuedOffline ? (
            <VenueFreeTablesBlock
              compact
              canReport
              tablesCount={tablesCount}
              onReport={onReportFreeTables}
            />
          ) : null}

          {/* F042: add a session moment (one photo + optional caption). */}
          {canAddMoment ? (
            <View style={styles.momentBlock} testID="checkin-moment-block">
              {momentPosted ? (
                <View style={styles.momentDoneRow}>
                  <Lucide name="check-circle" size={16} color={colors.primaryLight} />
                  <Text style={styles.momentDoneText}>{s('momentPosted')}</Text>
                </View>
              ) : momentUri ? (
                <>
                  <Image source={{ uri: momentUri }} style={styles.momentPreview} resizeMode="cover" />
                  <TextInput
                    style={styles.momentCaption}
                    value={caption}
                    onChangeText={setCaption}
                    placeholder={s('momentCaptionPlaceholder')}
                    placeholderTextColor={colors.textFaint}
                    maxLength={280}
                    multiline
                    testID="checkin-moment-caption"
                  />
                  <TouchableOpacity
                    accessibilityRole="button"
                    style={[styles.momentPostBtn, momentPosting && { opacity: 0.6 }]}
                    onPress={postMoment}
                    disabled={momentPosting}
                    testID="checkin-moment-post"
                  >
                    {momentPosting ? (
                      <ActivityIndicator size="small" color={colors.textOnPrimary} />
                    ) : (
                      <>
                        <Lucide name="camera" size={16} color={colors.textOnPrimary} />
                        <Text style={styles.momentPostText}>{s('momentPostAction')}</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </>
              ) : (
                <TouchableOpacity
                  accessibilityRole="button"
                  style={styles.momentAddBtn}
                  onPress={pickMomentPhoto}
                  testID="checkin-add-moment"
                >
                  <Lucide name="camera" size={16} color={colors.primaryMid} />
                  <Text style={styles.momentAddText}>{s('momentAddAction')}</Text>
                </TouchableOpacity>
              )}
            </View>
          ) : null}

          <TouchableOpacity accessibilityRole="button" style={styles.shareBtn} onPress={() => {
            Share.share(
              venueId != null
                ? sharePayload(`${s('checkinSuccess')} ${venueName} | TT Portal`, venueUrl(venueId))
                : { message: `${s('checkinSuccess')} ${venueName} | TT Portal` },
            );
          }} testID="checkin-success-share">
            <Lucide name="share-2" size={16} color={colors.textOnPrimary} />
            <Text style={styles.shareBtnText}>{s('shareCard')}</Text>
          </TouchableOpacity>

          <TouchableOpacity accessibilityRole="button" accessibilityLabel={s('close')} style={styles.dismissBtn} onPress={onDismiss} testID="checkin-success-dismiss">
            <Text style={styles.dismissText}>{s('close')}</Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: colors.overlayHeavy,
      justifyContent: 'flex-end',
      alignItems: 'center',
    },
    sheet: {
      backgroundColor: colors.bgAlt,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      paddingHorizontal: Spacing.xl,
      paddingBottom: Spacing.xxl,
      width: '100%',
      maxWidth: 430,
      alignItems: 'center',
      ...Shadows.lg,
    },
    handleWrap: {
      alignItems: 'center',
      paddingVertical: 10,
    },
    handle: {
      width: 36,
      height: 4,
      borderRadius: 2,
      backgroundColor: colors.border,
    },
    checkCircle: {
      width: 72,
      height: 72,
      borderRadius: 36,
      backgroundColor: colors.primaryLight,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: Spacing.md,
      marginBottom: Spacing.md,
      ...Shadows.md,
    },
    title: {
      fontFamily: Fonts.heading,
      fontSize: FontSize.xxxl,
      fontWeight: FontWeight.bold,
      color: colors.text,
    },
    venue: {
      fontFamily: Fonts.body,
      fontSize: FontSize.lg,
      color: colors.textMuted,
      marginTop: 4,
    },
    timeRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginTop: Spacing.xs,
    },
    timeText: {
      fontFamily: Fonts.body,
      fontSize: FontSize.md,
      color: colors.textFaint,
    },
    xpRow: {
      marginTop: Spacing.md,
      backgroundColor: colors.primaryPale,
      borderRadius: Radius.md,
      paddingVertical: Spacing.xs,
      paddingHorizontal: Spacing.lg,
      borderWidth: 1,
      borderColor: colors.primaryDim,
    },
    xpText: {
      fontFamily: Fonts.heading,
      fontSize: FontSize.xxl,
      fontWeight: FontWeight.bold,
      color: colors.primaryLight,
    },
    momentBlock: {
      width: '100%',
      marginTop: Spacing.md,
      gap: Spacing.sm,
    },
    momentAddBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: Spacing.xs,
      borderRadius: Radius.lg,
      paddingVertical: 12,
      borderWidth: 1,
      borderColor: colors.primaryDim,
      backgroundColor: colors.primaryPale,
    },
    momentAddText: {
      fontFamily: Fonts.body,
      fontSize: FontSize.md,
      fontWeight: FontWeight.semibold,
      color: colors.primaryMid,
    },
    momentPreview: {
      width: '100%',
      height: 180,
      borderRadius: Radius.md,
      backgroundColor: colors.bg,
    },
    momentCaption: {
      backgroundColor: colors.bg,
      borderRadius: Radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: 12,
      paddingVertical: 8,
      minHeight: 40,
      fontFamily: Fonts.body,
      fontSize: FontSize.md,
      color: colors.text,
      textAlignVertical: 'top',
    },
    momentPostBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: Spacing.xs,
      backgroundColor: colors.primary,
      borderRadius: Radius.lg,
      paddingVertical: 12,
    },
    momentPostText: {
      fontFamily: Fonts.body,
      fontSize: FontSize.md,
      fontWeight: FontWeight.semibold,
      color: colors.textOnPrimary,
    },
    momentDoneRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: Spacing.xs,
      paddingVertical: 10,
    },
    momentDoneText: {
      fontFamily: Fonts.body,
      fontSize: FontSize.md,
      fontWeight: FontWeight.semibold,
      color: colors.primaryLight,
    },
    shareBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.primary,
      borderRadius: Radius.lg,
      paddingVertical: 14,
      paddingHorizontal: Spacing.xxl,
      gap: Spacing.xs,
      marginTop: Spacing.lg,
      ...Shadows.md,
    },
    shareBtnText: {
      fontFamily: Fonts.body,
      fontSize: FontSize.lg,
      fontWeight: FontWeight.semibold,
      color: colors.textOnPrimary,
    },
    dismissBtn: {
      marginTop: Spacing.sm,
      borderRadius: Radius.lg,
      paddingVertical: 14,
      paddingHorizontal: 48,
      borderWidth: 1,
      borderColor: colors.border,
    },
    dismissText: {
      fontFamily: Fonts.body,
      fontSize: FontSize.lg,
      fontWeight: FontWeight.semibold,
      color: colors.textMuted,
    },
  });
}
