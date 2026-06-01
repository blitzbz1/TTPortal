"use client";

import { useEffect, useState } from "react";
import { X, Loader2 } from "lucide-react";
import type { AdminVenue } from "@/lib/admin-service";
import { updateVenue } from "@/lib/admin-service";

interface EditVenueModalProps {
  venue: AdminVenue | null;
  onClose: () => void;
  onSaved: (updated: AdminVenue) => void;
}

const venueTypes = ["pub", "club", "café", "restaurant", "sports", "other"];

export function EditVenueModal({ venue, onClose, onSaved }: EditVenueModalProps) {
  const [form, setForm] = useState<AdminVenue | null>(venue);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setForm(venue);
    setError(null);
  }, [venue]);

  if (!venue || !form) return null;

  const update = <K extends keyof AdminVenue>(key: K, value: AdminVenue[K]) =>
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev));

  const numericOrNull = (v: string): number | null => {
    if (v.trim() === "") return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  };

  async function handleSave() {
    if (!form) return;
    setSaving(true);
    setError(null);
    const { data, error: err } = await updateVenue(form.id, {
      name: form.name,
      address: form.address,
      city: form.city,
      type: form.type,
      tables_count: form.tables_count,
      description: form.description,
      lat: form.lat,
      lng: form.lng,
    });
    setSaving(false);
    if (err) {
      setError(err.message);
      return;
    }
    if (data) onSaved(data as AdminVenue);
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Edit venue"
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/50 p-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[90vh] w-full max-w-[560px] flex-col overflow-hidden rounded-2xl bg-surface shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-ink-100 px-5 py-4">
          <div>
            <span className="kicker text-clay-700">Edit Venue</span>
            <h2 className="font-heading text-[18px] font-bold text-ink-900">{venue.name}</h2>
          </div>
          <button
            onClick={onClose}
            className="rounded-md p-1.5 text-ink-400 transition-colors hover:bg-ink-100 hover:text-ink-700"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-5 py-5">
          <Field label="Name">
            <input
              value={form.name}
              onChange={(e) => update("name", e.target.value)}
              className="input"
            />
          </Field>

          <Field label="Address">
            <input
              value={form.address ?? ""}
              onChange={(e) => update("address", e.target.value)}
              className="input"
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="City">
              <input
                value={form.city ?? ""}
                onChange={(e) => update("city", e.target.value)}
                className="input"
              />
            </Field>
            <Field label="Type">
              <select
                value={form.type ?? ""}
                onChange={(e) => update("type", e.target.value)}
                className="input"
              >
                <option value="">—</option>
                {venueTypes.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <Field label="Tables">
              <input
                type="number"
                min={0}
                value={form.tables_count ?? ""}
                onChange={(e) => update("tables_count", numericOrNull(e.target.value))}
                className="input"
              />
            </Field>
            <Field label="Latitude">
              <input
                type="number"
                step="any"
                value={form.lat ?? ""}
                onChange={(e) => update("lat", numericOrNull(e.target.value))}
                className="input"
              />
            </Field>
            <Field label="Longitude">
              <input
                type="number"
                step="any"
                value={form.lng ?? ""}
                onChange={(e) => update("lng", numericOrNull(e.target.value))}
                className="input"
              />
            </Field>
          </div>

          <Field label="Description">
            <textarea
              value={form.description ?? ""}
              onChange={(e) => update("description", e.target.value)}
              rows={3}
              className="input resize-none"
            />
          </Field>

          {error ? (
            <p className="rounded-md bg-clay-50 px-3 py-2 text-[12.5px] text-clay-700">{error}</p>
          ) : null}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-ink-100 bg-paper px-5 py-3">
          <button
            onClick={onClose}
            className="px-3 py-2 text-[13px] font-medium text-ink-500 hover:text-ink-800"
            disabled={saving}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="btn-moss inline-flex items-center gap-2 rounded-md px-4 py-2 text-[13px] font-semibold disabled:opacity-60"
          >
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
            Save changes
          </button>
        </div>
      </div>

      <style jsx>{`
        .input {
          width: 100%;
          border-radius: 0.5rem;
          border: 1px solid var(--color-ink-200, #d6dcd8);
          background: var(--color-paper, #f6f4ef);
          padding: 0.5rem 0.75rem;
          font-size: 13.5px;
          color: var(--color-ink-900, #0c1d13);
          outline: none;
        }
        .input:focus {
          border-color: var(--color-moss-500, #4f7c5b);
          box-shadow: 0 0 0 3px rgba(79, 124, 91, 0.18);
        }
      `}</style>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="kicker text-ink-600">{label}</span>
      {children}
    </label>
  );
}
