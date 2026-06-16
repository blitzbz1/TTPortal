import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  Image,
  ActivityIndicator,
  Share,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { showAlert } from '../lib/dialogs';
import { Lucide } from '../components/Icon';
import { useTheme } from '../hooks/useTheme';
import type { ThemeColors } from '../theme';
import { Fonts, FontSize, FontWeight, Spacing, Radius, Shadows } from '../theme';
import { useI18n } from '../hooks/useI18n';
import { useSession } from '../hooks/useSession';
import { CityPickerModal } from '../components/CityPickerModal';
import { VenuePickerModal } from '../components/VenuePickerModal';
import { useCreateClub, getClubDetail, uploadClubAvatar } from '../features/clubs';
import { clubUrl, sharePayload } from '../lib/shareLinks';
import { venueImageUrl } from '../lib/imageTransforms';

export function CreateClubScreen() {
  const router = useRouter();
  const { s } = useI18n();
  const { user } = useSession();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const createClub = useCreateClub();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [cityId, setCityId] = useState<number | null>(null);
  const [cityName, setCityName] = useState<string | null>(null);
  const [cityPickerVisible, setCityPickerVisible] = useState(false);
  const [homeVenueId, setHomeVenueId] = useState<number | null>(null);
  const [homeVenueName, setHomeVenueName] = useState<string | null>(null);
  const [venuePickerVisible, setVenuePickerVisible] = useState(false);

  // post-create success state
  const [createdClubId, setCreatedClubId] = useState<number | null>(null);
  const [joinCode, setJoinCode] = useState<string | null>(null);

  const handlePickAvatar = useCallback(async () => {
    if (!user) return;
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      showAlert(s('error'), s('photoPermissionDenied'));
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (result.canceled || result.assets.length === 0) return;

    setUploadingAvatar(true);
    try {
      const asset = result.assets[0];
      const res = await uploadClubAvatar(user.id, {
        uri: asset.uri,
        width: asset.width,
        height: asset.height,
      });
      if (res.ok) {
        setAvatarUrl(res.url);
      } else if (res.reason === 'processing_unavailable') {
        showAlert(s('error'), s('photoProcessingUnavailable'));
      } else {
        showAlert(s('error'), s('photoUploadError'));
      }
    } finally {
      setUploadingAvatar(false);
    }
  }, [user, s]);

  const handleCreate = useCallback(async () => {
    if (!name.trim() || !user) return;
    try {
      const clubId = await createClub.mutateAsync({
        name: name.trim(),
        description: description.trim() || null,
        avatarUrl,
        cityId,
        homeVenueId,
      });
      const { data } = await getClubDetail(clubId);
      setCreatedClubId(clubId);
      setJoinCode(data?.join_code ?? null);
    } catch {
      showAlert(s('error'), s('clubCreateFailed'));
    }
  }, [name, description, avatarUrl, cityId, homeVenueId, user, createClub, s]);

  const handleShare = useCallback(() => {
    if (!joinCode) return;
    Share.share(sharePayload(s('clubShareMessage', joinCode), clubUrl(joinCode)));
  }, [joinCode, s]);

  // -- Success view: show the join code + share + go-to-club --
  if (createdClubId && joinCode) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <View style={{ width: 22 }} />
          <Text style={styles.headerTitle}>{s('clubCreatedTitle')}</Text>
          <View style={{ width: 22 }} />
        </View>
        <View style={styles.successWrap} testID="club-created">
          <View style={styles.successIcon}>
            <Lucide name="party-popper" size={36} color={colors.primary} />
          </View>
          <Text style={styles.successTitle}>{s('clubCreatedHeading')}</Text>
          <Text style={styles.successBody}>{s('clubCreatedShareHint')}</Text>

          <View style={styles.codeCard}>
            <Text style={styles.codeLabel}>{s('clubJoinCodeLabel')}</Text>
            <Text style={styles.codeValue} testID="club-join-code-value">{joinCode}</Text>
          </View>

          <Pressable style={styles.primaryBtn} onPress={handleShare} testID="club-share">
            <Lucide name="share-2" size={18} color={colors.textOnPrimary} />
            <Text style={styles.primaryBtnText}>{s('clubShareCta')}</Text>
          </Pressable>
          <Pressable
            style={styles.secondaryBtn}
            onPress={() =>
              router.replace({ pathname: '/(protected)/clubs/[id]', params: { id: String(createdClubId) } })
            }
            testID="club-goto"
          >
            <Text style={styles.secondaryBtnText}>{s('clubOpenCta')}</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          hitSlop={{ top: 10, right: 10, bottom: 10, left: 10 }}
          accessibilityLabel={s('back')}
          testID="create-club-back"
        >
          <Lucide name="arrow-left" size={22} color={colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>{s('clubCreateTitle')}</Text>
        <View style={{ width: 22 }} />
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView style={styles.scroll} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {/* Avatar */}
          <Pressable style={styles.avatarPicker} onPress={handlePickAvatar} testID="create-club-avatar">
            {avatarUrl ? (
              <Image
                source={{ uri: venueImageUrl(avatarUrl, { width: 160, quality: 80 }) ?? avatarUrl }}
                style={styles.avatar}
              />
            ) : (
              <View style={[styles.avatar, styles.avatarPlaceholder]}>
                {uploadingAvatar ? (
                  <ActivityIndicator color={colors.primary} />
                ) : (
                  <Lucide name="camera" size={24} color={colors.textFaint} />
                )}
              </View>
            )}
            <Text style={styles.avatarHint}>{s('clubAvatarHint')}</Text>
          </Pressable>

          {/* Name */}
          <Text style={styles.label}>{s('clubNameLabel')}</Text>
          <TextInput
            style={styles.input}
            placeholder={s('clubNamePlaceholder')}
            placeholderTextColor={colors.textFaint}
            value={name}
            onChangeText={setName}
            maxLength={60}
            testID="create-club-name"
          />

          {/* Description */}
          <Text style={styles.label}>{s('clubDescriptionLabel')}</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder={s('clubDescriptionPlaceholder')}
            placeholderTextColor={colors.textFaint}
            value={description}
            onChangeText={setDescription}
            multiline
            numberOfLines={3}
            maxLength={500}
            testID="create-club-description"
          />

          {/* City */}
          <Text style={styles.label}>{s('clubCityLabel')}</Text>
          <Pressable style={styles.pickerRow} onPress={() => setCityPickerVisible(true)} testID="create-club-city">
            <Lucide name="map-pin" size={18} color={cityName ? colors.primary : colors.textFaint} />
            <Text style={[styles.pickerText, cityName && styles.pickerTextSelected]}>
              {cityName ?? s('clubCityPick')}
            </Text>
            <Lucide name="chevron-right" size={18} color={colors.textFaint} />
          </Pressable>

          {/* Home venue (optional) */}
          <Text style={styles.label}>{s('clubHomeVenueLabel')}</Text>
          <Pressable style={styles.pickerRow} onPress={() => setVenuePickerVisible(true)} testID="create-club-venue">
            <Lucide name="home" size={18} color={homeVenueName ? colors.primary : colors.textFaint} />
            <Text style={[styles.pickerText, homeVenueName && styles.pickerTextSelected]}>
              {homeVenueName ?? s('clubHomeVenuePick')}
            </Text>
            <Lucide name="chevron-right" size={18} color={colors.textFaint} />
          </Pressable>

          <Pressable
            style={[styles.primaryBtn, (!name.trim() || createClub.isPending) && styles.btnDisabled]}
            onPress={handleCreate}
            disabled={!name.trim() || createClub.isPending}
            testID="create-club-submit"
          >
            {createClub.isPending ? (
              <ActivityIndicator size="small" color={colors.textOnPrimary} />
            ) : (
              <Text style={styles.primaryBtnText}>{s('clubCreateSubmit')}</Text>
            )}
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>

      <CityPickerModal
        visible={cityPickerVisible}
        selectedCity={cityName}
        selectedCityId={cityId}
        onSelect={() => setCityPickerVisible(false)}
        onSelectCity={(city) => {
          setCityId(city?.id ?? null);
          setCityName(city?.name ?? null);
          setCityPickerVisible(false);
        }}
        onClose={() => setCityPickerVisible(false)}
      />
      <VenuePickerModal
        visible={venuePickerVisible}
        selectedVenueId={homeVenueId}
        onSelect={(venue) => {
          setHomeVenueId(venue?.id ?? null);
          setHomeVenueName(venue?.name ?? null);
          setVenuePickerVisible(false);
        }}
        onClose={() => setVenuePickerVisible(false)}
      />
    </SafeAreaView>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: colors.bgAlt,
      height: 52,
      paddingHorizontal: Spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      ...Shadows.bar,
    },
    headerTitle: {
      fontFamily: Fonts.heading,
      fontSize: FontSize.xxl,
      fontWeight: FontWeight.bold,
      color: colors.text,
    },
    scroll: { flex: 1 },
    content: { padding: Spacing.md, gap: Spacing.sm },
    avatarPicker: { alignItems: 'center', gap: 8, marginBottom: Spacing.sm },
    avatar: { width: 88, height: 88, borderRadius: 44, backgroundColor: colors.bgMuted },
    avatarPlaceholder: {
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: colors.border,
      borderStyle: 'dashed',
    },
    avatarHint: { fontFamily: Fonts.body, fontSize: 13, color: colors.textMuted },
    label: {
      fontFamily: Fonts.body,
      fontSize: 13,
      fontWeight: FontWeight.semibold,
      color: colors.textMuted,
      marginTop: Spacing.xs,
    },
    input: {
      backgroundColor: colors.bgAlt,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: Radius.md,
      paddingHorizontal: 14,
      paddingVertical: 12,
      fontFamily: Fonts.body,
      fontSize: 16,
      color: colors.text,
    },
    textArea: { minHeight: 76, textAlignVertical: 'top' },
    pickerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      backgroundColor: colors.bgAlt,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: Radius.md,
      paddingHorizontal: 14,
      paddingVertical: 13,
    },
    pickerText: { flex: 1, fontFamily: Fonts.body, fontSize: 15, color: colors.textFaint },
    pickerTextSelected: { color: colors.text, fontWeight: FontWeight.semibold },
    primaryBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      backgroundColor: colors.primary,
      borderRadius: Radius.md,
      paddingVertical: 15,
      marginTop: Spacing.md,
    },
    primaryBtnText: {
      fontFamily: Fonts.body,
      fontSize: 15,
      fontWeight: FontWeight.bold,
      color: colors.textOnPrimary,
    },
    btnDisabled: { opacity: 0.6 },
    secondaryBtn: { paddingVertical: 14, alignItems: 'center', marginTop: 4 },
    secondaryBtnText: {
      fontFamily: Fonts.body,
      fontSize: 15,
      fontWeight: FontWeight.semibold,
      color: colors.textMuted,
    },
    // success view
    successWrap: { flex: 1, alignItems: 'center', padding: Spacing.lg, gap: 14 },
    successIcon: {
      width: 80,
      height: 80,
      borderRadius: 40,
      backgroundColor: colors.primaryPale,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 20,
    },
    successTitle: {
      fontFamily: Fonts.heading,
      fontSize: FontSize.xxl,
      fontWeight: FontWeight.bold,
      color: colors.text,
      textAlign: 'center',
    },
    successBody: {
      fontFamily: Fonts.body,
      fontSize: 15,
      color: colors.textMuted,
      textAlign: 'center',
    },
    codeCard: {
      width: '100%',
      alignItems: 'center',
      gap: 6,
      backgroundColor: colors.bgAlt,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: Radius.lg,
      paddingVertical: 20,
      marginVertical: 8,
    },
    codeLabel: {
      fontFamily: Fonts.body,
      fontSize: 12,
      fontWeight: FontWeight.bold,
      color: colors.textFaint,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    codeValue: {
      fontFamily: Fonts.heading,
      fontSize: 36,
      fontWeight: FontWeight.bold,
      color: colors.primary,
      letterSpacing: 6,
    },
  });
}
