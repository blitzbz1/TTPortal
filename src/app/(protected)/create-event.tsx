import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { View, Text, TextInput, Pressable, ScrollView, KeyboardAvoidingView, Alert, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSession } from '@/src/hooks/useSession';
import { useTheme } from '@/src/hooks/useTheme';
import { useI18n } from '@/src/hooks/useI18n';
import type { ThemeColors } from '@/src/theme';
import { Fonts } from '@/src/theme';
import { createStyles } from './create-event.styles';
import { createEvent, joinEvent, sendEventInvites } from '@/src/services/events';
import { invalidateEventsCache } from '@/src/lib/eventsCache';
import { rateLimitMessageFor } from '@/src/lib/rateLimit';
import {
  addChallengeToEvent,
  getChallengeById,
  requiresOtherPlayer,
  resolveChallengeTitle,
  type ChallengeCategory,
  type DbChallenge,
  setCurrentSelectedChallenge,
  useChallengeChoices,
  useCurrentSelectedChallenge,
} from '@/src/features/challenges';
import { BADGE_TRACKS } from '@/src/lib/badgeChallenges';
import { BadgeTrackIcon } from '@/src/components/BadgeTrackIcon';
import { Lucide } from '@/src/components/Icon';
import { VenuePickerModal } from '@/src/components/VenuePickerModal';
import { FriendPickerModal } from '@/src/components/FriendPickerModal';
import type { EventType, RecurrenceRule } from '@/src/types/database';

function getDefaultDate() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(18, 0, 0, 0);
  return d;
}

function getDefaultEndDate() {
  const d = new Date();
  d.setDate(d.getDate() + 2);
  d.setHours(20, 0, 0, 0);
  return d;
}

const DURATION_OPTIONS: { label: string; value: number | null }[] = [
  { label: 'Fără', value: null },
  { label: '1h', value: 1 },
  { label: '1.5h', value: 1.5 },
  { label: '2h', value: 2 },
  { label: '3h', value: 3 },
];

const RECURRENCE_OPTIONS: { label: string; value: RecurrenceRule | null }[] = [
  { label: 'Niciuna', value: null },
  { label: 'Zilnic', value: 'daily' },
  { label: 'Săptămânal', value: 'weekly' },
  { label: 'Lunar', value: 'monthly' },
];

const TRACK_ROWS = [
  BADGE_TRACKS.slice(0, 4),
  BADGE_TRACKS.slice(4, 8),
];

/* -- Collapsible section -- */
function Section({ title, icon, summary, children, defaultOpen = false, colors, s: sStyles, onToggle, onOpenChange }: {
  title: string; icon: string; summary?: string; children: React.ReactNode; defaultOpen?: boolean; colors: ThemeColors; s: ReturnType<typeof createStyles>; onToggle?: () => void; onOpenChange?: (open: boolean) => void;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <View style={sStyles.section}>
      <Pressable
        style={sStyles.sectionHeader}
        onPress={() => {
          onToggle?.();
          setOpen((value) => {
            const nextOpen = !value;
            onOpenChange?.(nextOpen);
            return nextOpen;
          });
        }}
      >
        <View style={sStyles.sectionHeaderLeft}>
          <Lucide name={icon} size={16} color={colors.textMuted} />
          <View>
            <Text style={sStyles.sectionTitle}>{title}</Text>
            {!open && summary ? <Text style={sStyles.sectionSummary}>{summary}</Text> : null}
          </View>
        </View>
        <Lucide name={open ? 'chevron-up' : 'chevron-down'} size={18} color={colors.textFaint} />
      </Pressable>
      {open && <View style={sStyles.sectionBody}>{children}</View>}
    </View>
  );
}

/* -- Inline dropdown -- */
function Dropdown<T>({ value, options, onSelect, label, colors, s: sStyles }: {
  value: T; options: { label: string; value: T }[]; onSelect: (v: T) => void; label: string; colors: ThemeColors; s: ReturnType<typeof createStyles>;
}) {
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.value === value);
  return (
    <View>
      <Text style={sStyles.fieldLabel}>{label}</Text>
      <Pressable style={sStyles.dropdown} onPress={() => setOpen((v) => !v)}>
        <Text style={sStyles.dropdownText}>{selected?.label ?? '—'}</Text>
        <Lucide name={open ? 'chevron-up' : 'chevron-down'} size={18} color={colors.textFaint} />
      </Pressable>
      {open && (
        <View style={sStyles.dropdownMenu}>
          {options.map((opt) => (
            <Pressable
              key={String(opt.value ?? 'none')}
              style={[sStyles.dropdownItem, value === opt.value && sStyles.dropdownItemActive]}
              onPress={() => { onSelect(opt.value); setOpen(false); }}
            >
              <Text style={[sStyles.dropdownItemText, value === opt.value && sStyles.dropdownItemTextActive]}>
                {opt.label}
              </Text>
              {value === opt.value && <Lucide name="check" size={16} color={colors.primary} />}
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}

export default function CreateEventRoute() {
  const router = useRouter();
  const params = useLocalSearchParams<{ challengeId?: string }>();
  const { user } = useSession();
  const { colors, isDark } = useTheme();
  const { s: t } = useI18n();
  const s = useMemo(() => createStyles(colors), [colors]);
  const currentSelectedChallenge = useCurrentSelectedChallenge();

  /* form state */
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(getDefaultDate);
  const [venueId, setVenueId] = useState<number | null>(null);
  const [venueName, setVenueName] = useState<string | null>(null);
  const [venuePickerVisible, setVenuePickerVisible] = useState(false);
  const [eventType, setEventType] = useState<EventType>('casual');
  const [durationHours, setDurationHours] = useState<number | null>(null);
  const [recurrenceRule, setRecurrenceRule] = useState<RecurrenceRule | null>(null);
  const [endDate, setEndDate] = useState(getDefaultEndDate);
  const [maxParticipantsText, setMaxParticipantsText] = useState('');
  const [selectedChallenge, setSelectedChallenge] = useState<DbChallenge | null>(null);
  const [attachChallenge, setAttachChallenge] = useState(false);
  const [eventChallengeTrackId, setEventChallengeTrackId] = useState(BADGE_TRACKS[0].id);
  const [challengeFieldOpen, setChallengeFieldOpen] = useState(false);

  /* picker visibility (tap-to-toggle on all platforms) */
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [showEndDatePicker, setShowEndDatePicker] = useState(false);

  /* post-creation */
  const [loading, setLoading] = useState(false);
  const [createdEventId, setCreatedEventId] = useState<number | null>(null);
  const [friendPickerVisible, setFriendPickerVisible] = useState(false);

  const closePickers = useCallback(() => {
    setShowDatePicker(false);
    setShowTimePicker(false);
    setShowEndDatePicker(false);
  }, []);

  const challengeTitle = useCallback((challenge: DbChallenge) => (
    resolveChallengeTitle(t, challenge)
  ), [t]);
  const eventChallengeTrack = BADGE_TRACKS.find((badge) => badge.id === eventChallengeTrackId) ?? BADGE_TRACKS[0];
  const currentEventChallenge = currentSelectedChallenge && requiresOtherPlayer(currentSelectedChallenge)
    ? currentSelectedChallenge
    : null;
  const effectiveSelectedChallenge = selectedChallenge ?? currentEventChallenge;
  const {
    choices: eventChallengeChoices,
    isLoading: challengeChoicesLoading,
  } = useChallengeChoices(eventChallengeTrack.category as ChallengeCategory, {
    enabled: challengeFieldOpen && !effectiveSelectedChallenge,
    onlyOtherPlayer: true,
    visibleCount: 4,
  });
  const challengeSectionSummary = attachChallenge && effectiveSelectedChallenge
    ? challengeTitle(effectiveSelectedChallenge)
    : t('eventChallengeOnCreateDesc');

  useEffect(() => {
    if (!params.challengeId) return;
    let alive = true;
    getChallengeById(params.challengeId).then(({ data }) => {
      if (!alive || !data) return;
      const challenge = data as DbChallenge;
      if (challenge.verification_type === 'other') {
        setSelectedChallenge(challenge);
        setAttachChallenge(true);
      }
    });
    return () => {
      alive = false;
    };
  }, [params.challengeId]);

  /* -- date/time handlers -- */
  const onDateChange = useCallback((e: DateTimePickerEvent, sel?: Date) => {
    if (Platform.OS === 'android' || e.type === 'set' || e.type === 'dismissed') setShowDatePicker(false);
    if (sel) setDate((prev) => { const d = new Date(sel); d.setHours(prev.getHours(), prev.getMinutes(), 0, 0); return d; });
  }, []);

  const onTimeChange = useCallback((e: DateTimePickerEvent, sel?: Date) => {
    if (Platform.OS === 'android' || e.type === 'set' || e.type === 'dismissed') setShowTimePicker(false);
    if (sel) setDate((prev) => { const d = new Date(prev); d.setHours(sel.getHours(), sel.getMinutes(), 0, 0); return d; });
  }, []);

  const onEndDateChange = useCallback((e: DateTimePickerEvent, sel?: Date) => {
    if (Platform.OS === 'android' || e.type === 'set' || e.type === 'dismissed') setShowEndDatePicker(false);
    if (sel) setEndDate(sel);
  }, []);

  const fmtDate = (d: Date) => d.toLocaleDateString('ro-RO', { weekday: 'short', day: 'numeric', month: 'short' });
  const fmtTime = (d: Date) => d.toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' });

  /* -- submit -- */
  const handleCreate = useCallback(async () => {
    if (!title.trim() || !user) return;
    if (date <= new Date()) { Alert.alert('Eroare', 'Data evenimentului trebuie să fie în viitor.'); return; }
    if (eventType === 'tournament' && endDate <= date) { Alert.alert('Eroare', 'Data de final trebuie să fie după data de start.'); return; }

    setLoading(true);
    let endsAt: string | undefined;
    if (eventType === 'tournament') endsAt = endDate.toISOString();
    else if (durationHours) endsAt = new Date(date.getTime() + durationHours * 3600000).toISOString();

    let recurrenceDay: number | undefined;
    if (recurrenceRule === 'weekly') recurrenceDay = date.getDay();
    else if (recurrenceRule === 'monthly') recurrenceDay = date.getDate();

    const { data, error } = await createEvent({
      title: title.trim(),
      description: description.trim() || null,
      organizer_id: user.id,
      starts_at: date.toISOString(),
      ends_at: endsAt,
      max_participants: maxParticipantsText ? parseInt(maxParticipantsText, 10) || undefined : undefined,
      venue_id: venueId ?? undefined,
      event_type: eventType,
      recurrence_rule: recurrenceRule ?? undefined,
      recurrence_day: recurrenceDay,
    });
    setLoading(false);
    if (error) {
      const rateMsg = rateLimitMessageFor(error, t);
      Alert.alert(t('error'), rateMsg ?? 'Nu s-a putut crea evenimentul.');
      return;
    }
    // The new event will appear in the user's "mine" tab and (if it starts in
    // the future) on the global "upcoming" tab — drop both caches so the next
    // visit re-fetches.
    invalidateEventsCache(user.id, ['mine', 'upcoming']);
    await joinEvent(data.id, user.id);
    if (effectiveSelectedChallenge && attachChallenge) {
      const challengeRes = await addChallengeToEvent(data.id, effectiveSelectedChallenge.id);
      if (challengeRes.error) {
        Alert.alert(t('error'), challengeRes.error.message);
      } else if (currentEventChallenge?.id === effectiveSelectedChallenge.id) {
        setCurrentSelectedChallenge(null);
      }
    }
    setCreatedEventId(data.id);
    setFriendPickerVisible(true);
  }, [title, description, user, venueId, date, maxParticipantsText, durationHours, eventType, endDate, recurrenceRule, effectiveSelectedChallenge, attachChallenge, currentEventChallenge?.id, t]);

  const handleInviteConfirm = useCallback(async (selectedIds: string[]) => {
    setFriendPickerVisible(false);
    if (selectedIds.length > 0 && createdEventId) await sendEventInvites(createdEventId, selectedIds, user!.id);
    router.back();
  }, [createdEventId, router, user]);

  const handleInviteSkip = useCallback(() => { setFriendPickerVisible(false); router.back(); }, [router]);

  const themeVariant = isDark ? 'dark' : 'light';

  /* -- render -- */
  return (
    <SafeAreaView style={s.container} edges={['top']}>
    <KeyboardAvoidingView style={s.scroll} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
    <ScrollView style={s.scroll} contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">

      {/* -- Header -- */}
      <Text style={s.header}>Creează eveniment</Text>

      {/* -- Essentials (always visible) -- */}
      <View style={s.inputWrap}>
        <TextInput
          style={s.input}
          placeholder="Titlu eveniment *"
          placeholderTextColor={colors.textFaint}
          value={title}
          onChangeText={setTitle}
          onFocus={closePickers}
        />
      </View>
      <View style={s.inputWrap}>
        <TextInput
          style={[s.input, s.textArea]}
          placeholder="Descriere (opțional)"
          placeholderTextColor={colors.textFaint}
          value={description}
          onChangeText={setDescription}
          multiline
          numberOfLines={2}
        onFocus={closePickers}
      />
      </View>

      {/* -- Date & Time -- */}
      {Platform.OS === 'web' ? (
        <View style={s.dateTimeRow}>
          <View style={[s.dateBtn, { flex: 1 }]}>
            <Lucide name="calendar" size={16} color={colors.accentBright} />
            <input
              type="date"
              value={date.toISOString().split('T')[0]}
              min={new Date().toISOString().split('T')[0]}
              onChange={(e) => {
                const [y, m, d] = (e.target as any).value.split('-').map(Number);
                setDate((prev) => { const next = new Date(prev); next.setFullYear(y, m - 1, d); return next; });
              }}
              style={{ fontFamily: Fonts.body, fontSize: 16, border: 'none', background: 'transparent', color: colors.text, colorScheme: isDark ? 'dark' : 'light', width: '100%' }}
            />
          </View>
          <View style={s.dateBtn}>
            <Lucide name="clock" size={16} color={colors.accentBright} />
            <input
              type="time"
              value={`${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`}
              step="900"
              onChange={(e) => {
                const [h, m] = (e.target as any).value.split(':').map(Number);
                setDate((prev) => { const next = new Date(prev); next.setHours(h, m, 0, 0); return next; });
              }}
              style={{ fontFamily: Fonts.body, fontSize: 16, border: 'none', background: 'transparent', color: colors.text, colorScheme: isDark ? 'dark' : 'light', width: '100%' }}
            />
          </View>
        </View>
      ) : (
        <>
          <View style={s.dateTimeRow}>
            <Pressable style={[s.dateBtn, showDatePicker && s.dateBtnActive, { flex: 1 }]} onPress={() => { setShowDatePicker((v) => !v); setShowTimePicker(false); }}>
              <Lucide name="calendar" size={16} color={colors.accentBright} />
              <Text style={s.dateBtnText}>{fmtDate(date)}</Text>
            </Pressable>
            <Pressable style={[s.dateBtn, showTimePicker && s.dateBtnActive]} onPress={() => { setShowTimePicker((v) => !v); setShowDatePicker(false); }}>
              <Lucide name="clock" size={16} color={colors.accentBright} />
              <Text style={s.dateBtnText}>{fmtTime(date)}</Text>
            </Pressable>
          </View>
          {showDatePicker && (
            <DateTimePicker value={date} mode="date" display={Platform.OS === 'ios' ? 'inline' : 'default'} minimumDate={new Date()} onChange={onDateChange} themeVariant={themeVariant} />
          )}
          {showTimePicker && (
            <DateTimePicker value={date} mode="time" display={Platform.OS === 'ios' ? 'spinner' : 'default'} minuteInterval={15} onChange={onTimeChange} themeVariant={themeVariant} />
          )}
        </>
      )}

      {/* -- Location -- */}
      <Pressable style={s.venuePicker} onPress={() => { closePickers(); setVenuePickerVisible(true); }}>
        <View style={s.venuePickerContent}>
          <Lucide name="map-pin" size={18} color={venueName ? colors.primary : colors.textFaint} />
          <Text style={[s.venuePickerText, venueName && s.venuePickerTextSelected]}>
            {venueName ?? 'Alege locația'}
          </Text>
        </View>
        <Lucide name="chevron-right" size={18} color={colors.textFaint} />
      </Pressable>

      <VenuePickerModal
        visible={venuePickerVisible}
        selectedVenueId={venueId}
        onSelect={(venue) => { setVenueId(venue?.id ?? null); setVenueName(venue?.name ?? null); setVenuePickerVisible(false); }}
        onClose={() => setVenuePickerVisible(false)}
      />

      <Section
        title={t('eventChallengeOnCreate')}
        icon="award"
        defaultOpen={false}
        colors={colors}
        s={s}
        onToggle={closePickers}
        onOpenChange={setChallengeFieldOpen}
        summary={challengeSectionSummary}
      >
        {params.challengeId && !effectiveSelectedChallenge ? (
          <Text style={s.hint}>{t('eventCurrentChallengeLoading')}</Text>
        ) : effectiveSelectedChallenge ? (
          <>
            <View style={s.challengeModeIntro}>
              <View style={s.challengeModeIcon}>
                <Lucide name="target" size={15} color={colors.primary} />
              </View>
              <View style={s.challengeModeCopy}>
                <Text style={s.challengeModeTitle}>{t('eventCurrentChallengeFromTab')}</Text>
                <Text style={s.challengeModeText}>{t('eventCurrentChallengeFromTabDesc')}</Text>
              </View>
            </View>
            <View style={[s.challengePreview, attachChallenge && s.challengePreviewActive]}>
              <View style={s.challengePreviewIcon}>
                <Lucide name="award" size={18} color={colors.primary} />
              </View>
              <View style={s.challengePreviewCopy}>
                <Text style={s.challengeChoiceTitle}>{challengeTitle(effectiveSelectedChallenge)}</Text>
                <Text style={s.challengeChoiceMeta}>{t('challengeVerificationWithValue', t('challengeVerificationOther'))}</Text>
              </View>
            </View>
            <Pressable
              style={[s.challengeAttachBtn, attachChallenge && s.challengeAttachBtnActive]}
              onPress={() => setAttachChallenge((value) => !value)}
            >
              <Lucide name={attachChallenge ? 'check' : 'plus'} size={16} color={attachChallenge ? colors.textOnPrimary : colors.primary} />
              <Text style={[s.challengeAttachText, attachChallenge && s.challengeAttachTextActive]}>
                {attachChallenge ? t('eventChallengeAlreadyAdded') : t('eventAddChallenge')}
              </Text>
            </Pressable>
          </>
        ) : (
          <>
            <View style={s.challengeModeIntro}>
              <View style={s.challengeModeIcon}>
                <Lucide name="sparkles" size={15} color={colors.primary} />
              </View>
              <View style={s.challengeModeCopy}>
                <Text style={s.challengeModeTitle}>{t('eventChooseChallengeTrack')}</Text>
                <Text style={s.challengeModeText}>{t('eventChooseChallengeTrackDesc')}</Text>
              </View>
            </View>
            <View style={s.challengeTrackGrid}>
              {TRACK_ROWS.map((row, rowIndex) => (
                <View key={rowIndex} style={s.challengeTrackRow}>
                  {row.map((track) => {
                    const active = track.id === eventChallengeTrack.id;
                    return (
                      <Pressable
                        key={track.id}
                        style={[
                          s.challengeTrackChip,
                          { borderColor: active ? track.color : track.paleColor, backgroundColor: active ? track.paleColor : colors.bg },
                        ]}
                        onPress={() => {
                          setEventChallengeTrackId(track.id);
                          setSelectedChallenge(null);
                          setAttachChallenge(false);
                        }}
                        >
                          <View style={[s.challengeTrackIcon, { backgroundColor: track.paleColor }]}>
                            <BadgeTrackIcon
                              badge={track}
                              size={32}
                              variant="picker"
                              fallbackColor={track.color}
                            />
                          </View>
                          <Text style={[s.challengeTrackText, { color: active ? track.color : colors.text }]} adjustsFontSizeToFit minimumFontScale={0.82}>
                            {t(`badgeTrack_${track.id}_short`)}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              ))}
            </View>
            {challengeChoicesLoading ? (
              <Text style={s.hint}>{t('loading')}</Text>
            ) : eventChallengeChoices.length > 0 ? (
              <View style={s.challengeChoiceList}>
                {eventChallengeChoices.map((challenge) => (
                  <Pressable
                    key={challenge.id}
                    style={s.challengeChoiceCard}
                    onPress={() => {
                      setSelectedChallenge(challenge);
                      setAttachChallenge(true);
                    }}
                  >
                    <View style={s.challengeChoiceTop}>
                      <Text style={s.challengeChoiceTitle}>{challengeTitle(challenge)}</Text>
                      <View style={s.challengeChoiceBadge}>
                        <Text style={s.challengeChoiceBadgeText}>{t('challengeVerificationOther')}</Text>
                      </View>
                    </View>
                    <Text style={s.challengeChoiceCta}>{t('eventAttachChallenge')}</Text>
                  </Pressable>
                ))}
              </View>
            ) : (
              <Text style={s.hint}>{t('eventNoOtherChallenges')}</Text>
            )}
          </>
        )}
      </Section>

      {/* -- Options section (collapsible) -- */}
      <Section
        title="Opțiuni"
        icon="sliders"
        defaultOpen={false}
        colors={colors}
        s={s}
        onToggle={closePickers}
        summary={[
          eventType === 'casual' ? 'Casual' : 'Turneu',
          durationHours ? `${durationHours}h` : null,
          recurrenceRule ? RECURRENCE_OPTIONS.find((o) => o.value === recurrenceRule)?.label : null,
          maxParticipantsText ? `${maxParticipantsText} locuri` : null,
        ].filter(Boolean).join(' · ')}
      >
        {/* Event type */}
        <Text style={s.fieldLabel}>Tip eveniment</Text>
        <View style={s.typeRow}>
          <Pressable
            style={[s.typeBtn, eventType === 'casual' && s.typeBtnSelected]}
            onPress={() => setEventType('casual')}
          >
            <Lucide name="coffee" size={16} color={eventType === 'casual' ? colors.textOnPrimary : colors.text} />
            <Text style={[s.typeBtnText, eventType === 'casual' && s.typeBtnTextSelected]}>Casual</Text>
          </Pressable>
          <Pressable
            style={[s.typeBtn, eventType === 'tournament' && s.typeBtnSelected]}
            onPress={() => { setEventType('tournament'); setRecurrenceRule(null); }}
          >
            <Lucide name="trophy" size={16} color={eventType === 'tournament' ? colors.textOnPrimary : colors.text} />
            <Text style={[s.typeBtnText, eventType === 'tournament' && s.typeBtnTextSelected]}>Turneu</Text>
          </Pressable>
        </View>

        {eventType === 'casual' ? (
          <>
            <Dropdown label="Durată (opțional)" value={durationHours} options={DURATION_OPTIONS} onSelect={setDurationHours} colors={colors} s={s} />
            <Dropdown label="Recurență" value={recurrenceRule} options={RECURRENCE_OPTIONS} onSelect={setRecurrenceRule} colors={colors} s={s} />
            {recurrenceRule === 'daily' && <Text style={s.hint}>Se repetă în fiecare zi</Text>}
            {recurrenceRule === 'weekly' && (
              <Text style={s.hint}>Se repetă în fiecare {date.toLocaleDateString('ro-RO', { weekday: 'long' })}</Text>
            )}
            {recurrenceRule === 'monthly' && (
              <Text style={s.hint}>Se repetă pe {date.getDate()} ale fiecărei luni</Text>
            )}
          </>
        ) : (
          <>
            <Text style={s.fieldLabel}>Data final</Text>
            {Platform.OS === 'web' ? (
              <View style={[s.dateBtn, { alignSelf: 'flex-start' }]}>
                <Lucide name="calendar-check" size={16} color={colors.accentBright} />
                <input
                  type="date"
                  value={endDate.toISOString().split('T')[0]}
                  min={date.toISOString().split('T')[0]}
                  onChange={(e) => {
                    const [y, m, d] = (e.target as any).value.split('-').map(Number);
                    setEndDate(new Date(y, m - 1, d, 20, 0, 0));
                  }}
                  style={{ fontFamily: Fonts.body, fontSize: 16, border: 'none', background: 'transparent', color: colors.text, colorScheme: isDark ? 'dark' : 'light', width: '100%' }}
                />
              </View>
            ) : (
              <>
                <Pressable style={[s.dateBtn, showEndDatePicker && s.dateBtnActive, { alignSelf: 'flex-start' }]} onPress={() => setShowEndDatePicker((v) => !v)}>
                  <Lucide name="calendar-check" size={16} color={colors.accentBright} />
                  <Text style={s.dateBtnText}>{fmtDate(endDate)}</Text>
                </Pressable>
                {showEndDatePicker && (
                  <DateTimePicker value={endDate} mode="date" display={Platform.OS === 'ios' ? 'inline' : 'default'} minimumDate={date} onChange={onEndDateChange} themeVariant={themeVariant} />
                )}
              </>
            )}
          </>
        )}

        <Text style={s.fieldLabel}>Număr locuri (opțional)</Text>
        <View style={s.inputWrap}>
          <TextInput
            style={s.input}
            placeholder="ex: 6"
            placeholderTextColor={colors.textFaint}
            value={maxParticipantsText}
            onChangeText={setMaxParticipantsText}
            keyboardType="number-pad"
          />
        </View>
      </Section>

      {/* -- Modals -- */}
      {user && (
        <FriendPickerModal
          visible={friendPickerVisible}
          userId={user.id}
          onConfirm={handleInviteConfirm}
          onClose={handleInviteSkip}
        />
      )}

      {/* -- Actions -- */}
      <Pressable
        style={[s.btn, loading && { opacity: 0.6 }]}
        onPress={handleCreate}
        disabled={loading}
      >
        <Text style={s.btnText}>{loading ? 'Se creează...' : 'Creează'}</Text>
      </Pressable>
      <Pressable onPress={() => router.back()} style={s.cancelBtn}>
        <Text style={s.cancelText}>Anulează</Text>
      </Pressable>

    </ScrollView>
    </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
