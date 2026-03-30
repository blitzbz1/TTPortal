import React, { useState, useCallback, useMemo } from 'react';
import { View, Text, TextInput, Pressable, ScrollView, KeyboardAvoidingView, StyleSheet, Alert, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { useRouter } from 'expo-router';
import { useSession } from '@/src/hooks/useSession';
import { useTheme } from '@/src/hooks/useTheme';
import type { ThemeColors } from '@/src/theme';
import { Fonts, Radius } from '@/src/theme';
import { createEvent, joinEvent, sendEventInvites } from '@/src/services/events';
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

/* -- Collapsible section -- */
function Section({ title, icon, summary, children, defaultOpen = false, colors, s: sStyles, onToggle }: {
  title: string; icon: string; summary?: string; children: React.ReactNode; defaultOpen?: boolean; colors: ThemeColors; s: ReturnType<typeof createStyles>; onToggle?: () => void;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <View style={sStyles.section}>
      <Pressable style={sStyles.sectionHeader} onPress={() => { onToggle?.(); setOpen((v) => !v); }}>
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
  const { user } = useSession();
  const { colors, isDark } = useTheme();
  const s = useMemo(() => createStyles(colors), [colors]);

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
    if (error) { Alert.alert('Eroare', 'Nu s-a putut crea evenimentul.'); return; }
    await joinEvent(data.id, user.id);
    setCreatedEventId(data.id);
    setFriendPickerVisible(true);
  }, [title, description, user, venueId, date, maxParticipantsText, durationHours, eventType, endDate, recurrenceRule]);

  const handleInviteConfirm = useCallback(async (selectedIds: string[]) => {
    setFriendPickerVisible(false);
    if (selectedIds.length > 0 && createdEventId) await sendEventInvites(createdEventId, selectedIds);
    router.back();
  }, [createdEventId, router]);

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
      <TextInput
        style={s.input}
        placeholder="Titlu eveniment *"
        placeholderTextColor={colors.textFaint}
        value={title}
        onChangeText={setTitle}
        onFocus={closePickers}
      />
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
        <TextInput
          style={s.input}
          placeholder="ex: 6"
          placeholderTextColor={colors.textFaint}
          value={maxParticipantsText}
          onChangeText={setMaxParticipantsText}
          keyboardType="number-pad"
        />
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

/* -- Styles -- */
function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg },
    scroll: { flex: 1 },
    content: { padding: 24, gap: 14 },
    header: { fontFamily: Fonts.heading, fontSize: 24, fontWeight: '800', color: colors.text, marginBottom: 4 },

    /* inputs */
    input: {
      backgroundColor: colors.bgAlt, borderRadius: Radius.md, borderWidth: 1,
      borderColor: colors.border, padding: 14, fontFamily: Fonts.body, fontSize: 14, color: colors.text,
    },
    textArea: { height: 70, textAlignVertical: 'top' },

    /* date/time */
    dateTimeRow: { flexDirection: 'row', gap: 10 },
    dateBtn: {
      flexDirection: 'row', alignItems: 'center', gap: 8,
      backgroundColor: colors.bgAlt, borderRadius: Radius.md, borderWidth: 1,
      borderColor: colors.border, padding: 14,
    },
    dateBtnActive: { borderColor: colors.accentBright, backgroundColor: colors.amberPale },
    dateBtnText: { fontFamily: Fonts.body, fontSize: 14, color: colors.text, fontWeight: '500' },

    /* collapsible sections */
    section: {
      backgroundColor: colors.bgAlt, borderRadius: Radius.lg, borderWidth: 1,
      borderColor: colors.border, overflow: 'hidden',
    },
    sectionHeader: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingVertical: 14, paddingHorizontal: 16,
    },
    sectionHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    sectionTitle: { fontFamily: Fonts.body, fontSize: 14, fontWeight: '600', color: colors.text },
    sectionSummary: { fontFamily: Fonts.body, fontSize: 12, color: colors.textFaint, marginTop: 2 },
    sectionBody: {
      paddingHorizontal: 16, paddingBottom: 16, gap: 12,
      borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.borderLight,
    },

    /* field labels inside sections */
    fieldLabel: {
      fontFamily: Fonts.body, fontSize: 12, fontWeight: '600',
      color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 4,
    },

    /* event type toggle */
    typeRow: { flexDirection: 'row', gap: 10 },
    typeBtn: {
      flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
      paddingVertical: 12, borderRadius: Radius.md, borderWidth: 1,
      borderColor: colors.border, backgroundColor: colors.bgMuted,
    },
    typeBtnSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
    typeBtnText: { fontFamily: Fonts.body, fontSize: 14, fontWeight: '600', color: colors.text },
    typeBtnTextSelected: { color: colors.textOnPrimary },

    /* dropdown */
    dropdown: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      backgroundColor: colors.bgMuted, borderRadius: Radius.md, padding: 14,
    },
    dropdownText: { fontFamily: Fonts.body, fontSize: 14, color: colors.text, fontWeight: '500' },
    dropdownMenu: {
      backgroundColor: colors.bgAlt, borderRadius: Radius.md, borderWidth: 1,
      borderColor: colors.border, overflow: 'hidden',
    },
    dropdownItem: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingVertical: 12, paddingHorizontal: 16,
      borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.borderLight,
    },
    dropdownItemActive: { backgroundColor: colors.bgMuted },
    dropdownItemText: { fontFamily: Fonts.body, fontSize: 14, color: colors.text },
    dropdownItemTextActive: { fontWeight: '600', color: colors.primary },

    /* hint */
    hint: { fontFamily: Fonts.body, fontSize: 12, color: colors.textFaint, fontStyle: 'italic' },

    /* venue picker */
    venuePicker: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      backgroundColor: colors.bgMuted, borderRadius: Radius.md, padding: 14, marginTop: 4,
    },
    venuePickerContent: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    venuePickerText: { fontFamily: Fonts.body, fontSize: 14, color: colors.textFaint },
    venuePickerTextSelected: { color: colors.text, fontWeight: '500' },

    /* buttons */
    btn: { backgroundColor: colors.primaryLight, borderRadius: 12, height: 50, alignItems: 'center', justifyContent: 'center' },
    btnText: { fontFamily: Fonts.body, fontSize: 16, fontWeight: '700', color: colors.textOnPrimary },
    cancelBtn: { alignItems: 'center', justifyContent: 'center', borderRadius: 12, height: 46, borderWidth: 1, borderColor: colors.border },
    cancelText: { fontFamily: Fonts.body, fontSize: 14, fontWeight: '600', color: colors.textMuted },
  });
}
