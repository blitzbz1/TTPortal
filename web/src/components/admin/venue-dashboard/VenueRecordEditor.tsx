"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, Eye, EyeOff, Loader2, Save, X } from "lucide-react";
import {
  getAdminVenueById,
  updateVenue,
  type AdminVenue,
} from "@/lib/admin-service";

type VenueRecordEditorProps = {
  venue: AdminVenue | null;
  onClose: () => void;
  onSaved: (updated: AdminVenue) => void;
};

type VenueForm = {
  name: string;
  type: string;
  city: string;
  city_id: string;
  county: string;
  sector: string;
  address: string;
  lat: string;
  lng: string;
  tables_count: string;
  condition: string;
  hours: string;
  description: string;
  tags: string;
  photos: string;
  free_access: boolean;
  night_lighting: boolean;
  nets: boolean;
  verified: boolean;
  approved: boolean;
  tariff: string;
  website: string;
};

const venueTypes = [
  { value: "parc_exterior", label: "Outdoor / park" },
  { value: "sala_indoor", label: "Indoor hall" },
];

const conditionOptions = [
  { value: "necunoscuta", label: "Unknown" },
  { value: "buna", label: "Good" },
  { value: "acceptabila", label: "Acceptable" },
  { value: "deteriorata", label: "Damaged" },
  { value: "profesionala", label: "Professional" },
];

export function VenueRecordEditor({ venue, onClose, onSaved }: VenueRecordEditorProps) {
  const [record, setRecord] = useState<AdminVenue | null>(venue);
  const [form, setForm] = useState<VenueForm | null>(venue ? venueToForm(venue) : null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedMessage, setSavedMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setRecord(venue);
    setForm(venue ? venueToForm(venue) : null);
    setError(null);
    setSavedMessage(null);
    if (!venue) return;
    setLoading(true);
    getAdminVenueById(venue.id).then(({ data, error: loadError }) => {
      if (cancelled) return;
      setLoading(false);
      if (loadError) {
        setError(loadError.message);
        return;
      }
      const fresh = { ...venue, ...((data ?? {}) as AdminVenue) };
      setRecord(fresh);
      setForm(venueToForm(fresh));
    });
    return () => {
      cancelled = true;
    };
  }, [venue]);

  const dirty = useMemo(() => {
    if (!record || !form) return false;
    return JSON.stringify(venueToPayload(record, venueToForm(record))) !== JSON.stringify(venueToPayload(record, form));
  }, [form, record]);

  if (!venue || !form) return null;

  function update<K extends keyof VenueForm>(key: K, value: VenueForm[K]) {
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev));
    setSavedMessage(null);
  }

  async function handleSave(nextApproved?: boolean) {
    if (!record || !form) return;
    const sourceVenue = venue;
    if (!sourceVenue) return;
    const validationError = validateVenueForm(form);
    if (validationError) {
      setError(validationError);
      return;
    }

    setSaving(true);
    setError(null);
    const payload = venueToPayload(record, {
      ...form,
      approved: nextApproved ?? form.approved,
    });
    const { data, error: saveError } = await updateVenue(record.id, payload);
    setSaving(false);

    if (saveError) {
      setError(saveError.message);
      return;
    }

    const updated = {
      ...record,
      ...payload,
      ...((data ?? {}) as Partial<AdminVenue>),
      country_code: sourceVenue.country_code ?? record.country_code,
    };
    setRecord(updated);
    setForm(venueToForm(updated));
    setSavedMessage(nextApproved === true ? "Saved and shown in app." : "Saved.");
    onSaved(updated as AdminVenue);
  }

  const statusLabel = form.approved ? "Shown in app" : "Hidden from app";

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Edit venue record"
      className="fixed inset-0 z-50 flex justify-end bg-ink-900/45"
      onClick={onClose}
    >
      <div
        onClick={(event) => event.stopPropagation()}
        className="flex h-full w-full max-w-[680px] flex-col bg-surface shadow-2xl"
      >
        <div className="border-b border-ink-100 px-5 py-4">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <span className="kicker text-clay-700">Supabase venue record</span>
              <h2 className="truncate font-heading text-[20px] font-bold text-ink-900">
                {record?.name ?? venue.name}
              </h2>
              <p className="mt-1 text-[12px] text-ink-500">
                ID {venue.id} {venue.city ? `· ${venue.city}` : ""}
              </p>
            </div>
            <button
              onClick={onClose}
              className="rounded-md p-2 text-ink-400 hover:bg-ink-100 hover:text-ink-700"
              aria-label="Close editor"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold uppercase ${
                form.approved ? "bg-moss-100 text-moss-800" : "bg-ink-100 text-ink-700"
              }`}
            >
              {form.approved ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
              {statusLabel}
            </span>
            {loading ? (
              <span className="inline-flex items-center gap-1.5 text-[12px] text-ink-400">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Loading latest values
              </span>
            ) : null}
            {savedMessage ? (
              <span className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-moss-700">
                <Check className="h-3.5 w-3.5" />
                {savedMessage}
              </span>
            ) : null}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5">
          <div className="grid gap-5">
            <section className="grid gap-3">
              <SectionTitle title="Identity" />
              <Field label="Name" required>
                <input value={form.name} onChange={(event) => update("name", event.target.value)} className="editor-input" />
              </Field>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Type" required>
                  <select value={form.type} onChange={(event) => update("type", event.target.value)} className="editor-input">
                    {venueTypes.map((type) => (
                      <option key={type.value} value={type.value}>{type.label}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Condition">
                  <select value={form.condition} onChange={(event) => update("condition", event.target.value)} className="editor-input">
                    {conditionOptions.map((condition) => (
                      <option key={condition.value} value={condition.value}>{condition.label}</option>
                    ))}
                  </select>
                </Field>
              </div>
            </section>

            <section className="grid gap-3">
              <SectionTitle title="Location" />
              <Field label="Address" required>
                <input value={form.address} onChange={(event) => update("address", event.target.value)} className="editor-input" />
              </Field>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="City text" required>
                  <input value={form.city} onChange={(event) => update("city", event.target.value)} className="editor-input" />
                </Field>
                <Field label="City ID" required>
                  <input type="number" min={1} value={form.city_id} onChange={(event) => update("city_id", event.target.value)} className="editor-input" />
                </Field>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="County / region">
                  <input value={form.county} onChange={(event) => update("county", event.target.value)} className="editor-input" />
                </Field>
                <Field label="Sector / local area">
                  <input value={form.sector} onChange={(event) => update("sector", event.target.value)} className="editor-input" />
                </Field>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Latitude" required>
                  <input type="number" step="any" value={form.lat} onChange={(event) => update("lat", event.target.value)} className="editor-input" />
                </Field>
                <Field label="Longitude" required>
                  <input type="number" step="any" value={form.lng} onChange={(event) => update("lng", event.target.value)} className="editor-input" />
                </Field>
              </div>
            </section>

            <section className="grid gap-3">
              <SectionTitle title="Play Details" />
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Tables">
                  <input type="number" min={0} value={form.tables_count} onChange={(event) => update("tables_count", event.target.value)} className="editor-input" />
                </Field>
                <Field label="Tariff">
                  <input value={form.tariff} onChange={(event) => update("tariff", event.target.value)} className="editor-input" />
                </Field>
              </div>
              <Field label="Hours">
                <input value={form.hours} onChange={(event) => update("hours", event.target.value)} className="editor-input" />
              </Field>
              <div className="grid gap-2 sm:grid-cols-2">
                <Toggle label="Free access" checked={form.free_access} onChange={(value) => update("free_access", value)} />
                <Toggle label="Night lighting" checked={form.night_lighting} onChange={(value) => update("night_lighting", value)} />
                <Toggle label="Nets available" checked={form.nets} onChange={(value) => update("nets", value)} />
                <Toggle label="Verified" checked={form.verified} onChange={(value) => update("verified", value)} />
              </div>
            </section>

            <section className="grid gap-3">
              <SectionTitle title="Content" />
              <Field label="Website">
                <input value={form.website} onChange={(event) => update("website", event.target.value)} className="editor-input" />
              </Field>
              <Field label="Description">
                <textarea value={form.description} onChange={(event) => update("description", event.target.value)} rows={3} className="editor-input resize-none" />
              </Field>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Tags">
                  <textarea value={form.tags} onChange={(event) => update("tags", event.target.value)} rows={3} className="editor-input resize-none" />
                </Field>
                <Field label="Photos">
                  <textarea value={form.photos} onChange={(event) => update("photos", event.target.value)} rows={3} className="editor-input resize-none" />
                </Field>
              </div>
            </section>
          </div>

          {error ? (
            <p className="mt-5 rounded-md bg-clay-50 px-3 py-2 text-[12.5px] font-semibold text-clay-700">
              {error}
            </p>
          ) : null}
        </div>

        <div className="flex flex-col gap-2 border-t border-ink-100 bg-paper px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <label className="inline-flex items-center gap-2 text-[12.5px] font-semibold text-ink-700">
            <input
              type="checkbox"
              checked={form.approved}
              onChange={(event) => update("approved", event.target.checked)}
              className="h-4 w-4 accent-moss-700"
            />
            Show in app
          </label>
          <div className="flex flex-wrap justify-end gap-2">
            <button onClick={onClose} disabled={saving} className="rounded-md px-3 py-2 text-[13px] font-semibold text-ink-500 hover:bg-ink-100 hover:text-ink-800">
              Close
            </button>
            <button
              onClick={() => handleSave()}
              disabled={saving || (!dirty && form.approved === record?.approved)}
              className="inline-flex items-center gap-1.5 rounded-md border border-ink-200 px-3 py-2 text-[13px] font-semibold text-ink-700 hover:bg-surface disabled:opacity-50"
            >
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
              Save
            </button>
            {!form.approved ? (
              <button
                onClick={() => handleSave(true)}
                disabled={saving}
                className="btn-moss inline-flex items-center gap-1.5 rounded-md px-4 py-2 text-[13px] font-semibold disabled:opacity-60"
              >
                {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                Save & show in app
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

function venueToForm(venue: AdminVenue): VenueForm {
  return {
    name: venue.name ?? "",
    type: venue.type || "parc_exterior",
    city: venue.city ?? "",
    city_id: venue.city_id == null ? "" : String(venue.city_id),
    county: venue.county ?? "",
    sector: venue.sector ?? "",
    address: venue.address ?? "",
    lat: venue.lat == null ? "" : String(venue.lat),
    lng: venue.lng == null ? "" : String(venue.lng),
    tables_count: venue.tables_count == null ? "" : String(venue.tables_count),
    condition: venue.condition || "necunoscuta",
    hours: venue.hours ?? "",
    description: venue.description ?? "",
    tags: arrayToLines(venue.tags),
    photos: arrayToLines(venue.photos),
    free_access: venue.free_access ?? true,
    night_lighting: venue.night_lighting ?? false,
    nets: venue.nets ?? true,
    verified: venue.verified ?? false,
    approved: venue.approved ?? false,
    tariff: venue.tariff ?? "",
    website: venue.website ?? "",
  };
}

function venueToPayload(record: AdminVenue, form: VenueForm) {
  return {
    name: form.name.trim(),
    type: form.type,
    city: form.city.trim(),
    city_id: numberOrNull(form.city_id) ?? record.city_id ?? null,
    county: emptyToNull(form.county),
    sector: emptyToNull(form.sector),
    address: form.address.trim(),
    lat: numberOrNull(form.lat),
    lng: numberOrNull(form.lng),
    tables_count: numberOrNull(form.tables_count) ?? 0,
    condition: form.condition,
    hours: emptyToNull(form.hours),
    description: emptyToNull(form.description),
    tags: linesToArray(form.tags),
    photos: linesToArray(form.photos),
    free_access: form.free_access,
    night_lighting: form.night_lighting,
    nets: form.nets,
    verified: form.verified,
    approved: form.approved,
    tariff: emptyToNull(form.tariff),
    website: emptyToNull(form.website),
  };
}

function validateVenueForm(form: VenueForm) {
  if (!form.name.trim()) return "Name is required.";
  if (!form.city.trim()) return "City text is required.";
  if (!form.city_id.trim() || !numberOrNull(form.city_id)) return "City ID is required.";
  if (!form.address.trim()) return "Address is required.";
  if (numberOrNull(form.lat) == null || numberOrNull(form.lng) == null) {
    return "Latitude and longitude are required.";
  }
  if (!venueTypes.some((type) => type.value === form.type)) return "Choose a valid DB venue type.";
  return null;
}

function numberOrNull(value: string) {
  if (value.trim() === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function emptyToNull(value: string) {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function linesToArray(value: string) {
  return value
    .split(/\r?\n|,/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function arrayToLines(value: string[] | null | undefined) {
  return Array.isArray(value) ? value.join("\n") : "";
}

function SectionTitle({ title }: { title: string }) {
  return <h3 className="font-heading text-[15px] font-bold text-ink-900">{title}</h3>;
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[11px] font-bold uppercase text-ink-500">
        {label}
        {required ? <span className="text-clay-700"> *</span> : null}
      </span>
      {children}
    </label>
  );
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="inline-flex min-h-[42px] items-center justify-between gap-3 rounded-md border border-ink-200 bg-paper px-3 text-[12.5px] font-semibold text-ink-700">
      {label}
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="h-4 w-4 accent-moss-700"
      />
    </label>
  );
}
