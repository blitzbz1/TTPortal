// Extracted from AdminModerationScreen.tsx (T052, first slice): the four
// memoized list cards plus their formatting helpers and option constants.
// They were already self-contained module-scope components — the screen
// shell keeps the tab state, fetch orchestration, and modals (next slices:
// per-tab files + the shared venue form).
import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Image, ActivityIndicator } from 'react-native';
import { Lucide } from '../../components/Icon';
import type { VenueChangeRequestDecision } from '../../services/admin';
// T052: the option constants moved to the shared venue form component;
// re-exported below so existing imports keep working.
import {
  CONDITION_OPTIONS,
  BOOLEAN_OPTIONS,
  REQUIRED_BOOLEAN_OPTIONS,
} from '../../components/VenueFormFields';
import {
  AMENITY_KEYS,
  AMENITY_LABEL_KEYS,
  ENTRY_FEE_LABEL_KEYS,
  type VenueAmenities,
} from '../../lib/amenities';

// Cached at module scope so each per-row format call doesn't construct a fresh
// Intl.DateTimeFormat. Use lazy access to keep startup cheap. Uses the
// device locale (was hardcoded ro-RO — T060 sweep).
const _shortDateFmt: { current: Intl.DateTimeFormat | null } = { current: null };
function formatShortDate(iso: string) {
  if (!_shortDateFmt.current) _shortDateFmt.current = new Intl.DateTimeFormat();
  return _shortDateFmt.current.format(new Date(iso));
}
const _localizedDateTimeFmt: { current: Intl.DateTimeFormat | null } = { current: null };
function formatLocalizedDateTime(iso: string) {
  if (!_localizedDateTimeFmt.current) {
    _localizedDateTimeFmt.current = new Intl.DateTimeFormat(undefined, {
      dateStyle: 'short',
      timeStyle: 'short',
    });
  }
  return _localizedDateTimeFmt.current.format(new Date(iso));
}

function formatVenueCoordinates(lat: number | null | undefined, lng: number | null | undefined): string | null {
  if (typeof lat !== 'number' || typeof lng !== 'number') return null;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
}

function formatVenueCountry(venue: any): string | null {
  const countryName = venue.cities?.country_name;
  const countryCode = venue.cities?.country_code;
  if (countryName && countryCode) return `${countryName} (${countryCode})`;
  return countryName ?? countryCode ?? null;
}

interface PendingVenueCardProps {
  venue: any;
  styles: any;
  colors: any;
  s: (key: string) => string;
  onApprove: (id: number) => void;
  onEdit: (venue: any) => void;
  onReject: (venue: any) => void;
}
const PendingVenueCard = React.memo(function PendingVenueCard({
  venue, styles, colors, s, onApprove, onEdit, onReject,
}: PendingVenueCardProps) {
  return (
    <View style={styles.modCard}>
      <View style={styles.modTop}>
        <Text style={styles.modTitle}>{venue.name}</Text>
        <View style={styles.modBadge}>
          <Text style={styles.modBadgeText}>{s('newBadge')}</Text>
        </View>
      </View>
      <Text style={styles.modMeta}>
        {s('addedBy')}{venue.profiles?.full_name ?? s('user').toLowerCase()} {'·'}{' '}
        {formatShortDate(venue.created_at)} {'·'}{' '}
        {venue.city ?? ''}{venue.address ? `, ${venue.address}` : ''}
      </Text>
      <Text style={styles.modMeta}>
        {[formatVenueCountry(venue), formatVenueCoordinates(venue.lat, venue.lng)]
          .filter(Boolean)
          .join(' / ')}
      </Text>
      <View style={styles.modActions}>
        <TouchableOpacity style={styles.approveBtn} onPress={() => onApprove(venue.id)}>
          <Lucide name="check" size={14} color={colors.textOnPrimary} />
          <Text style={styles.approveBtnText}>{s('approve')}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.editBtn} onPress={() => onEdit(venue)}>
          <Lucide name="pencil" size={14} color={colors.textMuted} />
          <Text style={styles.editBtnText}>{s('edit')}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.rejectBtn} onPress={() => onReject(venue)}>
          <Lucide name="x" size={14} color={colors.red} />
          <Text style={styles.rejectBtnText}>{s('reject')}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
});

interface FlaggedReviewCardProps {
  review: any;
  styles: any;
  colors: any;
  s: (key: string) => string;
  onKeep: (id: number) => void;
  onDelete: (id: number) => void;
}
const FlaggedReviewCard = React.memo(function FlaggedReviewCard({
  review, styles, colors, s, onKeep, onDelete,
}: FlaggedReviewCardProps) {
  return (
    <View style={styles.flagCard}>
      <View style={styles.flagTop}>
        <View style={styles.flagInfo}>
          <Text style={styles.flagAuthor}>{review.profiles?.full_name ?? s('user')}</Text>
          <Text style={styles.flagMeta}>
            {review.venues?.name ?? s('venue')} {'·'}{' '}
            {formatShortDate(review.created_at)}
          </Text>
        </View>
        <View style={styles.flagBadge}>
          <Text style={styles.flagBadgeText}>{review.flag_count ?? 0} {s('reports')}</Text>
        </View>
      </View>
      <Text style={styles.flagText}>{`"${review.body ?? review.text ?? ''}"`}</Text>
      <View style={styles.flagActions}>
        <TouchableOpacity style={styles.keepBtn} onPress={() => onKeep(review.id)}>
          <Lucide name="check" size={14} color={colors.textMuted} />
          <Text style={styles.keepBtnText}>{s('keep')}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.deleteBtn} onPress={() => onDelete(review.id)}>
          <Lucide name="trash-2" size={14} color={colors.textOnPrimary} />
          <Text style={styles.deleteBtnText}>{s('deleteBtn')}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
});

interface FeedbackCardProps {
  item: any;
  styles: any;
  colors: any;
  s: (key: string) => string;
  onReply: (item: any) => void;
  onDelete: (id: any) => void;
}
const FeedbackCard = React.memo(function FeedbackCard({
  item, styles, colors, s, onReply, onDelete,
}: FeedbackCardProps) {
  const authorName = item.profiles?.full_name || item.profiles?.email || s('anon');
  const iconName = item.category === 'bug' ? 'bug' : 'message-square';
  const categoryLabel = item.category === 'bug' ? s('feedbackCategoryBug') : s('feedbackCategoryGeneral');
  return (
    <View style={styles.flagCard} testID={`feedback-row-${item.id}`}>
      <View style={styles.flagTop}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 }}>
          <Lucide name={iconName} size={14} color={colors.textMuted} />
          <Text style={styles.flagAuthor} numberOfLines={1}>{authorName}</Text>
        </View>
        <View style={styles.flagBadge}>
          <Text style={styles.flagBadgeText}>{categoryLabel}</Text>
        </View>
      </View>
      <Text style={styles.flagText}>{item.message}</Text>
      <Text style={styles.flagMeta}>
        {item.page}
        {' · '}
        {formatLocalizedDateTime(item.created_at)}
      </Text>
      <View style={styles.modActions}>
        <TouchableOpacity
          style={styles.keepBtn}
          onPress={() => onReply(item)}
          testID={`feedback-reply-${item.id}`}
        >
          <Lucide name="message-circle" size={14} color={colors.primary} />
          <Text style={styles.keepBtnText}>{s('feedbackReply')}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.deleteBtn}
          onPress={() => onDelete(item.id)}
          testID={`feedback-delete-${item.id}`}
        >
          <Lucide name="trash-2" size={14} color={colors.textOnPrimary} />
          <Text style={styles.deleteBtnText}>{s('deleteBtn')}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
});

interface VenueChangeRequestCardProps {
  request: any;
  styles: any;
  colors: any;
  s: (key: string) => string;
  onApply: (request: any, decision: VenueChangeRequestDecision) => Promise<boolean>;
  onDismiss: (id: number) => Promise<boolean>;
  onViewPhoto: (url: string) => void;
  canRemove: boolean;
}
const VenueChangeRequestCard = React.memo(function VenueChangeRequestCard({
  request, styles, colors, s, onApply, onDismiss, onViewPhoto, canRemove,
}: VenueChangeRequestCardProps) {
  const [acceptNets, setAcceptNets] = useState(true);
  const [acceptLighting, setAcceptLighting] = useState(true);
  const [acceptTables, setAcceptTables] = useState(true);
  const [acceptAmenities, setAcceptAmenities] = useState(true);
  const [availability, setAvailability] = useState<'none' | 'hide' | 'remove'>('none');
  const [busy, setBusy] = useState(false);

  const v = request.venues ?? {};
  const fmtBool = (b: boolean | null | undefined) =>
    b == null ? s('conditionUnknown') : b ? s('yes') : s('no');

  // F012: a single accept/reject for the whole proposed-amenities patch
  // (resolve_venue_change_request merges it into the venue's amenities jsonb).
  const proposedAmenities = (request.proposed_amenities ?? null) as VenueAmenities | null;
  const amenitySummary = proposedAmenities
    ? [
        ...AMENITY_KEYS.filter((k) => proposedAmenities[k] != null).map(
          (k) => `${s(AMENITY_LABEL_KEYS[k])}: ${proposedAmenities[k] ? s('yes') : s('no')}`,
        ),
        ...(proposedAmenities.entry_fee
          ? [`${s('amenityEntryLabel')}: ${s(ENTRY_FEE_LABEL_KEYS[proposedAmenities.entry_fee])}`]
          : []),
      ].join(', ')
    : '';
  const hasProposedAmenities = amenitySummary.length > 0;

  const fields: {
    key: string; label: string; current: string; proposed: string;
    accepted: boolean; set: (next: boolean) => void;
  }[] = [];
  if (request.proposed_nets != null) {
    fields.push({ key: 'nets', label: s('fieldNets'), current: fmtBool(v.nets), proposed: fmtBool(request.proposed_nets), accepted: acceptNets, set: setAcceptNets });
  }
  if (request.proposed_night_lighting != null) {
    fields.push({ key: 'lighting', label: s('fieldLighting'), current: fmtBool(v.night_lighting), proposed: fmtBool(request.proposed_night_lighting), accepted: acceptLighting, set: setAcceptLighting });
  }
  if (request.proposed_tables_count != null) {
    fields.push({ key: 'tables', label: s('fieldTables'), current: String(v.tables_count ?? '?'), proposed: String(request.proposed_tables_count), accepted: acceptTables, set: setAcceptTables });
  }

  // Permanent removal is admin-only (also enforced by resolve_venue_change_request);
  // moderators may hide but not delete a venue.
  const availOptions = ([
    { v: 'none', labelKey: 'vcrAvailIgnore' },
    { v: 'hide', labelKey: 'vcrAvailHide' },
    { v: 'remove', labelKey: 'vcrAvailRemove' },
  ] as { v: 'none' | 'hide' | 'remove'; labelKey: string }[]).filter((o) => o.v !== 'remove' || canRemove);

  const handleApply = async () => {
    setBusy(true);
    const ok = await onApply(request, {
      applyNets: acceptNets,
      applyNightLighting: acceptLighting,
      applyTablesCount: acceptTables,
      applyAmenities: acceptAmenities,
      availability,
    });
    if (!ok) setBusy(false);
  };

  const handleDismiss = async () => {
    setBusy(true);
    const ok = await onDismiss(request.id);
    if (!ok) setBusy(false);
  };

  return (
    <View style={styles.modCard} testID={`vcr-card-${request.id}`}>
      <View style={styles.modTop}>
        <Text style={styles.modTitle}>{v.name ?? s('venue')}</Text>
        <View style={styles.modBadge}>
          <Text style={styles.modBadgeText}>{s('tabChanges')}</Text>
        </View>
      </View>
      <Text style={styles.modMeta}>
        {(request.profiles?.full_name ?? s('user'))} {'·'} {formatShortDate(request.created_at)}
        {v.city ? ` · ${v.city}` : ''}
      </Text>
      {request.note ? <Text style={styles.vcrNote}>{`"${request.note}"`}</Text> : null}

      {request.photo_url ? (
        <TouchableOpacity
          onPress={() => onViewPhoto(request.photo_url)}
          accessibilityRole="imagebutton"
          accessibilityLabel={s('vcrViewPhoto')}
          testID={`vcr-photo-${request.id}`}
        >
          <Image source={{ uri: request.photo_url }} style={styles.vcrPhoto} />
        </TouchableOpacity>
      ) : null}

      {fields.map((f) => (
        <View key={f.key} style={styles.vcrFieldRow}>
          <View style={styles.vcrFieldInfo}>
            <Text style={styles.vcrFieldLabel}>{f.label}</Text>
            <Text style={styles.vcrFieldChange}>{`${f.current} → ${f.proposed}`}</Text>
          </View>
          <TouchableOpacity
            style={[styles.vcrDecisionBtn, f.accepted ? styles.vcrDecisionAccept : styles.vcrDecisionReject]}
            onPress={() => f.set(!f.accepted)}
            testID={`vcr-${request.id}-${f.key}`}
          >
            <Lucide name={f.accepted ? 'check' : 'x'} size={13} color={f.accepted ? colors.greenDeep : colors.red} />
            <Text style={[styles.vcrDecisionText, { color: f.accepted ? colors.greenDeep : colors.red }]}>
              {f.accepted ? s('vcrAccept') : s('vcrReject')}
            </Text>
          </TouchableOpacity>
        </View>
      ))}

      {hasProposedAmenities ? (
        <View style={styles.vcrFieldRow}>
          <View style={styles.vcrFieldInfo}>
            <Text style={styles.vcrFieldLabel}>{s('vcrFieldAmenities')}</Text>
            <Text style={styles.vcrFieldChange}>{amenitySummary}</Text>
          </View>
          <TouchableOpacity
            style={[styles.vcrDecisionBtn, acceptAmenities ? styles.vcrDecisionAccept : styles.vcrDecisionReject]}
            onPress={() => setAcceptAmenities((p) => !p)}
            testID={`vcr-${request.id}-amenities`}
          >
            <Lucide name={acceptAmenities ? 'check' : 'x'} size={13} color={acceptAmenities ? colors.greenDeep : colors.red} />
            <Text style={[styles.vcrDecisionText, { color: acceptAmenities ? colors.greenDeep : colors.red }]}>
              {acceptAmenities ? s('vcrAccept') : s('vcrReject')}
            </Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {request.mark_unavailable ? (
        <View style={styles.vcrAvailBlock}>
          <Text style={styles.vcrAvailHeader}>{s('vcrAvailabilityHeader')}</Text>
          <View style={styles.modalChoiceGrid}>
            {availOptions.map((o) => {
              const active = availability === o.v;
              return (
                <TouchableOpacity
                  key={o.v}
                  style={[styles.modalChoiceBtn, active && styles.modalChoiceBtnActive]}
                  onPress={() => setAvailability(o.v)}
                  testID={`vcr-avail-${o.v}`}
                >
                  <Text style={[styles.modalChoiceText, active && styles.modalChoiceTextActive]}>
                    {s(o.labelKey)}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      ) : null}

      <View style={styles.modActions}>
        <TouchableOpacity
          style={[styles.approveBtn, busy && { opacity: 0.6 }]}
          onPress={handleApply}
          disabled={busy}
          testID={`vcr-apply-${request.id}`}
        >
          {busy ? (
            <ActivityIndicator size="small" color={colors.textOnPrimary} />
          ) : (
            <>
              <Lucide name="check" size={14} color={colors.textOnPrimary} />
              <Text style={styles.approveBtnText}>{s('vcrApply')}</Text>
            </>
          )}
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.editBtn}
          onPress={handleDismiss}
          disabled={busy}
          testID={`vcr-dismiss-${request.id}`}
        >
          <Lucide name="x" size={14} color={colors.textMuted} />
          <Text style={styles.editBtnText}>{s('vcrDismiss')}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
});

export { PendingVenueCard, FlaggedReviewCard, FeedbackCard, VenueChangeRequestCard };
export { CONDITION_OPTIONS, BOOLEAN_OPTIONS, REQUIRED_BOOLEAN_OPTIONS };
export { formatShortDate, formatLocalizedDateTime, formatVenueCoordinates, formatVenueCountry };
