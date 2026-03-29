import React, { useState, useCallback } from 'react';
import { View, Text, TextInput, Pressable, ScrollView, StyleSheet, Alert, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { useRouter } from 'expo-router';
import { useSession } from '@/src/hooks/useSession';
import { createEvent, joinEvent, sendEventInvites } from '@/src/services/events';
import { Colors, Fonts, Radius } from '@/src/theme';
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

/* ── Collapsible section ── */
function Section({ title, icon, summary, children, defaultOpen = false }: {
  title: string; icon: string; summary?: string; children: React.ReactNode; defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <View style={s.section}>
      <Pressable style={s.sectionHeader} onPress={() => setOpen((v) => !v)}>
        <View style={s.sectionHeaderLeft}>
          <Lucide name={icon} size={16} color={Colors.inkMuted} />
          <View>
            <Text style={s.sectionTitle}>{title}</Text>
            {!open && summary ? <Text style={s.sectionSummary}>{summary}</Text> : null}
          </View>
        </View>
        <Lucide name={open ? 'chevron-up' : 'chevron-down'} size={18} color={Colors.inkFaint} />
      </Pressable>
      {open && <View style={s.sectionBody}>{children}</View>}
    </View>
  );
}

/* ── Inline dropdown ── */
function Dropdown<T>({ value, options, onSelect, label }: {
  value: T; options: { label: string; value: T }[]; onSelect: (v: T) => void; label: string;
}) {
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.value === value);
  return (
    <View>
      <Text style={s.fieldLabel}>{label}</Text>
      <Pressable style={s.dropdown} onPress={() => setOpen((v) => !v)}>
        <Text style={s.dropdownText}>{selected?.label ?? '—'}</Text>
        <Lucide name={open ? 'chevron-up' : 'chevron-down'} size={18} color={Colors.inkFaint} />
      </Pressable>
      {open && (
        <View style={s.dropdownMenu}>
          {options.map((opt) => (
            <Pressable
              key={String(opt.value ?? 'none')}
              style={[s.dropdownItem, value === opt.value && s.dropdownItemActive]}
              onPress={() => { onSelect(opt.value); setOpen(false); }}
            >
              <Text style={[s.dropdownItemText, value === opt.value && s.dropdownItemTextActive]}>
                {opt.label}
              </Text>
              {value === opt.value && <Lucide name="check" size={16} color={Colors.green} />}
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

  /* ── date/time handlers ── */
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

  /* ── submit ── */
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

  /* ── render ── */
  return (
    <SafeAreaView style={s.container} edges={['top']}>
    <ScrollView style={s.scroll} contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">

      {/* ── Header ── */}
      <Text style={s.header}>Creează eveniment</Text>

      {/* ── Essentials (always visible) ── */}
      <TextInput
        style={s.input}
        placeholder="Titlu eveniment *"
        placeholderTextColor={Colors.inkFaint}
        value={title}
        onChangeText={setTitle}
      />
      <TextInput
        style={[s.input, s.textArea]}
        placeholder="Descriere (opțional)"
        placeholderTextColor={Colors.inkFaint}
        value={description}
        onChangeText={setDescription}
        multiline
        numberOfLines={2}
      />

      {/* ── Date & Time ── */}
      <View style={s.dateTimeRow}>
        <Pressable style={[s.dateBtn, showDatePicker && s.dateBtnActive, { flex: 1 }]} onPress={() => { setShowDatePicker((v) => !v); setShowTimePicker(false); }}>
          <Lucide name="calendar" size={16} color={Colors.orangeBright} />
          <Text style={s.dateBtnText}>{fmtDate(date)}</Text>
        </Pressable>
        <Pressable style={[s.dateBtn, showTimePicker && s.dateBtnActive]} onPress={() => { setShowTimePicker((v) => !v); setShowDatePicker(false); }}>
          <Lucide name="clock" size={16} color={Colors.orangeBright} />
          <Text style={s.dateBtnText}>{fmtTime(date)}</Text>
        </Pressable>
      </View>
      {showDatePicker && (
        <DateTimePicker value={date} mode="date" display={Platform.OS === 'ios' ? 'inline' : 'default'} minimumDate={new Date()} onChange={onDateChange} />
      )}
      {showTimePicker && (
        <DateTimePicker value={date} mode="time" display={Platform.OS === 'ios' ? 'spinner' : 'default'} minuteInterval={15} onChange={onTimeChange} />
      )}

      {/* ── Location ── */}
      <Pressable style={s.venuePicker} onPress={() => setVenuePickerVisible(true)}>
        <View style={s.venuePickerContent}>
          <Lucide name="map-pin" size={18} color={venueName ? Colors.green : Colors.inkFaint} />
          <Text style={[s.venuePickerText, venueName && s.venuePickerTextSelected]}>
            {venueName ?? 'Alege locația'}
          </Text>
        </View>
        <Lucide name="chevron-right" size={18} color={Colors.inkFaint} />
      </Pressable>

      <VenuePickerModal
        visible={venuePickerVisible}
        selectedVenueId={venueId}
        onSelect={(venue) => { setVenueId(venue?.id ?? null); setVenueName(venue?.name ?? null); setVenuePickerVisible(false); }}
        onClose={() => setVenuePickerVisible(false)}
      />

      {/* ── Options section (collapsible) ── */}
      <Section
        title="Opțiuni"
        icon="sliders"
        defaultOpen={false}
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
            <Lucide name="coffee" size={16} color={eventType === 'casual' ? Colors.white : Colors.ink} />
            <Text style={[s.typeBtnText, eventType === 'casual' && s.typeBtnTextSelected]}>Casual</Text>
          </Pressable>
          <Pressable
            style={[s.typeBtn, eventType === 'tournament' && s.typeBtnSelected]}
            onPress={() => { setEventType('tournament'); setRecurrenceRule(null); }}
          >
            <Lucide name="trophy" size={16} color={eventType === 'tournament' ? Colors.white : Colors.ink} />
            <Text style={[s.typeBtnText, eventType === 'tournament' && s.typeBtnTextSelected]}>Turneu</Text>
          </Pressable>
        </View>

        {eventType === 'casual' ? (
          <>
            <Dropdown label="Durată (opțional)" value={durationHours} options={DURATION_OPTIONS} onSelect={setDurationHours} />
            <Dropdown label="Recurență" value={recurrenceRule} options={RECURRENCE_OPTIONS} onSelect={setRecurrenceRule} />
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
            <Pressable style={[s.dateBtn, showEndDatePicker && s.dateBtnActive, { alignSelf: 'flex-start' }]} onPress={() => setShowEndDatePicker((v) => !v)}>
              <Lucide name="calendar-check" size={16} color={Colors.orangeBright} />
              <Text style={s.dateBtnText}>{fmtDate(endDate)}</Text>
            </Pressable>
            {showEndDatePicker && (
              <DateTimePicker value={endDate} mode="date" display={Platform.OS === 'ios' ? 'inline' : 'default'} minimumDate={date} onChange={onEndDateChange} />
            )}
          </>
        )}

        <Text style={s.fieldLabel}>Număr locuri (opțional)</Text>
        <TextInput
          style={s.input}
          placeholder="ex: 6"
          placeholderTextColor={Colors.inkFaint}
          value={maxParticipantsText}
          onChangeText={setMaxParticipantsText}
          keyboardType="number-pad"
        />
      </Section>

      {/* ── Modals ── */}
      {user && (
        <FriendPickerModal
          visible={friendPickerVisible}
          userId={user.id}
          onConfirm={handleInviteConfirm}
          onClose={handleInviteSkip}
        />
      )}

      {/* ── Actions ── */}
      <Pressable
        style={[s.btn, loading && { opacity: 0.6 }]}
        onPress={handleCreate}
        disabled={loading}
      >
        <Text style={s.btnText}>{loading ? 'Se creează...' : 'Creează →'}</Text>
      </Pressable>
      <Pressable onPress={() => router.back()} style={s.cancelBtn}>
        <Text style={s.cancelText}>Anulează</Text>
      </Pressable>

    </ScrollView>
    </SafeAreaView>
  );
}

/* ── Styles ── */
const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  scroll: { flex: 1 },
  content: { padding: 24, gap: 14 },
  header: { fontFamily: Fonts.heading, fontSize: 24, fontWeight: '800', color: Colors.ink, marginBottom: 4 },

  /* inputs */
  input: {
    backgroundColor: Colors.white, borderRadius: Radius.md, borderWidth: 1,
    borderColor: Colors.border, padding: 14, fontFamily: Fonts.body, fontSize: 14, color: Colors.ink,
  },
  textArea: { height: 70, textAlignVertical: 'top' },

  /* date/time */
  dateTimeRow: { flexDirection: 'row', gap: 10 },
  dateBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: Colors.white, borderRadius: Radius.md, borderWidth: 1,
    borderColor: Colors.border, padding: 14,
  },
  dateBtnActive: { borderColor: Colors.orangeBright, backgroundColor: Colors.amberPale },
  dateBtnText: { fontFamily: Fonts.body, fontSize: 14, color: Colors.ink, fontWeight: '500' },

  /* collapsible sections */
  section: {
    backgroundColor: Colors.white, borderRadius: Radius.lg, borderWidth: 1,
    borderColor: Colors.border, overflow: 'hidden',
  },
  sectionHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 14, paddingHorizontal: 16,
  },
  sectionHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  sectionTitle: { fontFamily: Fonts.body, fontSize: 14, fontWeight: '600', color: Colors.ink },
  sectionSummary: { fontFamily: Fonts.body, fontSize: 12, color: Colors.inkFaint, marginTop: 2 },
  sectionBody: {
    paddingHorizontal: 16, paddingBottom: 16, gap: 12,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Colors.borderLight,
  },

  /* field labels inside sections */
  fieldLabel: {
    fontFamily: Fonts.body, fontSize: 12, fontWeight: '600',
    color: Colors.inkMuted, textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 4,
  },

  /* event type toggle */
  typeRow: { flexDirection: 'row', gap: 10 },
  typeBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 12, borderRadius: Radius.md, borderWidth: 1,
    borderColor: Colors.border, backgroundColor: Colors.bgDark,
  },
  typeBtnSelected: { backgroundColor: Colors.green, borderColor: Colors.green },
  typeBtnText: { fontFamily: Fonts.body, fontSize: 14, fontWeight: '600', color: Colors.ink },
  typeBtnTextSelected: { color: Colors.white },

  /* dropdown */
  dropdown: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: Colors.bgDark, borderRadius: Radius.md, padding: 14,
  },
  dropdownText: { fontFamily: Fonts.body, fontSize: 14, color: Colors.ink, fontWeight: '500' },
  dropdownMenu: {
    backgroundColor: Colors.white, borderRadius: Radius.md, borderWidth: 1,
    borderColor: Colors.border, overflow: 'hidden',
  },
  dropdownItem: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 12, paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Colors.borderLight,
  },
  dropdownItemActive: { backgroundColor: Colors.bgDark },
  dropdownItemText: { fontFamily: Fonts.body, fontSize: 14, color: Colors.ink },
  dropdownItemTextActive: { fontWeight: '600', color: Colors.green },

  /* hint */
  hint: { fontFamily: Fonts.body, fontSize: 12, color: Colors.inkFaint, fontStyle: 'italic' },

  /* venue picker */
  venuePicker: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: Colors.bgDark, borderRadius: Radius.md, padding: 14, marginTop: 4,
  },
  venuePickerContent: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  venuePickerText: { fontFamily: Fonts.body, fontSize: 14, color: Colors.inkFaint },
  venuePickerTextSelected: { color: Colors.ink, fontWeight: '500' },

  /* buttons */
  btn: { backgroundColor: Colors.greenLight, borderRadius: 12, height: 50, alignItems: 'center', justifyContent: 'center' },
  btnText: { fontFamily: Fonts.body, fontSize: 16, fontWeight: '700', color: Colors.white },
  cancelBtn: { alignItems: 'center', paddingVertical: 12 },
  cancelText: { fontFamily: Fonts.body, fontSize: 14, color: Colors.inkFaint },
});
