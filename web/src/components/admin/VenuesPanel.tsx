"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Check, Loader2, MapPin, Pencil, Search, Trash2, X } from "lucide-react";
import {
  approveVenue,
  deleteVenue,
  getPendingVenues,
  rejectVenue,
  searchVenuesAdmin,
  type AdminVenue,
  type PendingVenue,
} from "@/lib/admin-service";
import { EditVenueModal } from "./EditVenueModal";

interface VenuesPanelProps {
  onPendingCountChange?: (n: number) => void;
}

export function VenuesPanel({ onPendingCountChange }: VenuesPanelProps) {
  const [pending, setPending] = useState<PendingVenue[]>([]);
  const [pendingLoading, setPendingLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<AdminVenue[]>([]);
  const [searching, setSearching] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null);
  const [editTarget, setEditTarget] = useState<AdminVenue | null>(null);

  const loadPending = useCallback(async () => {
    setPendingLoading(true);
    const { data } = await getPendingVenues();
    const list = (data ?? []) as PendingVenue[];
    setPending(list);
    setPendingLoading(false);
    onPendingCountChange?.(list.length);
  }, [onPendingCountChange]);

  useEffect(() => {
    loadPending();
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [loadPending]);

  function handleSearchChange(value: string) {
    setSearch(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (value.trim().length < 3) {
      setResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    debounceRef.current = setTimeout(async () => {
      const { data } = await searchVenuesAdmin(value.trim());
      setResults((data ?? []) as AdminVenue[]);
      setSearching(false);
    }, 400);
  }

  async function handleApprove(id: number) {
    const { error } = await approveVenue(id);
    if (error) {
      alert(`Approve failed: ${error.message}`);
      return;
    }
    setPending((prev) => {
      const next = prev.filter((v) => v.id !== id);
      onPendingCountChange?.(next.length);
      return next;
    });
  }

  async function handleReject(id: number) {
    const { error } = await rejectVenue(id);
    if (error) {
      alert(`Reject failed: ${error.message}`);
      return;
    }
    setPending((prev) => {
      const next = prev.filter((v) => v.id !== id);
      onPendingCountChange?.(next.length);
      return next;
    });
  }

  async function handleDelete(id: number) {
    const { error } = await deleteVenue(id);
    if (error) {
      alert(`Delete failed: ${error.message}`);
      return;
    }
    setResults((prev) => prev.filter((v) => v.id !== id));
    setPending((prev) => {
      const next = prev.filter((v) => v.id !== id);
      onPendingCountChange?.(next.length);
      return next;
    });
    setConfirmDelete(null);
  }

  function handleSaved(updated: AdminVenue) {
    setResults((prev) => prev.map((v) => (v.id === updated.id ? updated : v)));
    setPending((prev) =>
      prev.map((v) => (v.id === updated.id ? { ...v, ...updated } : v)),
    );
    setEditTarget(null);
  }

  return (
    <div className="flex flex-col gap-8">
      <Section
        title="Pending venues"
        kicker={`${pending.length} awaiting approval`}
      >
        {pendingLoading ? (
          <Empty icon={<Loader2 className="h-5 w-5 animate-spin" />} text="Loading…" />
        ) : pending.length === 0 ? (
          <Empty text="No pending venues — nice." />
        ) : (
          <div className="flex flex-col gap-3">
            {pending.map((v) => (
              <div
                key={v.id}
                className="flex flex-col gap-3 rounded-2xl border border-ink-100 bg-surface p-4 shadow-[0_2px_6px_-4px_rgba(12,29,19,0.06)] sm:flex-row sm:items-start sm:justify-between"
              >
                <div className="flex flex-1 flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-heading text-[15px] font-bold text-ink-900">{v.name}</h3>
                    {v.type ? (
                      <span className="rounded-md bg-ink-100 px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-wider text-ink-600">
                        {v.type}
                      </span>
                    ) : null}
                  </div>
                  <p className="flex items-center gap-1.5 text-[12.5px] text-ink-500">
                    <MapPin className="h-3.5 w-3.5" />
                    {[v.address, v.city].filter(Boolean).join(", ") || "No address"}
                  </p>
                  {v.description ? (
                    <p className="line-clamp-2 text-[12.5px] text-ink-600">{v.description}</p>
                  ) : null}
                  <p className="text-[11.5px] text-ink-400">
                    Submitted by {v.profiles?.full_name ?? "—"} · {formatDate(v.created_at)}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <button
                    onClick={() => setEditTarget(v)}
                    className="inline-flex items-center gap-1.5 rounded-md border border-ink-200 px-3 py-2 text-[12.5px] font-semibold text-ink-700 hover:bg-ink-50"
                  >
                    <Pencil className="h-3.5 w-3.5" /> Edit
                  </button>
                  <button
                    onClick={() => handleReject(v.id)}
                    className="inline-flex items-center gap-1.5 rounded-md border border-clay-200 px-3 py-2 text-[12.5px] font-semibold text-clay-700 hover:bg-clay-50"
                  >
                    <X className="h-3.5 w-3.5" /> Reject
                  </button>
                  <button
                    onClick={() => handleApprove(v.id)}
                    className="btn-moss inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-[12.5px] font-semibold"
                  >
                    <Check className="h-3.5 w-3.5" /> Approve
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Section>

      <Section title="Search & manage venues" kicker="Find any venue and edit or delete">
        <div className="mb-4 flex w-full items-center gap-2 rounded-[10px] border border-ink-200 bg-paper px-3 py-2.5">
          <Search className="h-4 w-4 text-ink-400" />
          <input
            type="text"
            placeholder="Search by name or address (min 3 chars)…"
            value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="flex-1 bg-transparent text-[13.5px] text-ink-900 placeholder:text-ink-400 focus:outline-none"
          />
          {searching ? <Loader2 className="h-4 w-4 animate-spin text-ink-400" /> : null}
        </div>

        {search.trim().length < 3 ? (
          <Empty text="Type at least 3 characters to search." />
        ) : results.length === 0 && !searching ? (
          <Empty text="No venues match." />
        ) : (
          <div className="overflow-hidden rounded-2xl border border-ink-100 bg-surface shadow-[0_2px_6px_-4px_rgba(12,29,19,0.06)]">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-ink-100 bg-moss-50/50">
                  <Th>Name</Th>
                  <Th>City</Th>
                  <Th>Type</Th>
                  <Th align="center">Tables</Th>
                  <Th align="center">Approved</Th>
                  <Th align="right">Actions</Th>
                </tr>
              </thead>
              <tbody>
                {results.map((v) => (
                  <tr
                    key={v.id}
                    className="border-b border-ink-100 transition-colors hover:bg-ink-50/50"
                  >
                    <td className="px-4 py-3">
                      <div className="font-semibold text-ink-900">{v.name}</div>
                      <div className="line-clamp-1 text-[11.5px] text-ink-500">{v.address ?? "—"}</div>
                    </td>
                    <td className="px-4 py-3 text-ink-600">{v.city ?? "—"}</td>
                    <td className="px-4 py-3">
                      {v.type ? (
                        <span className="rounded-md bg-ink-100 px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-wider text-ink-600">
                          {v.type}
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-4 py-3 text-center tabular-nums text-ink-700">
                      {v.tables_count ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {v.approved ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-moss-100 px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-wider text-moss-800">
                          <Check className="h-3 w-3" /> Yes
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-clay-100 px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-wider text-clay-700">
                          Pending
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-1">
                        <button
                          onClick={() => setEditTarget(v)}
                          className="rounded-md p-1.5 text-ink-500 hover:bg-ink-100 hover:text-ink-800"
                          aria-label="Edit"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        {confirmDelete === v.id ? (
                          <>
                            <button
                              onClick={() => handleDelete(v.id)}
                              className="rounded-md bg-clay-600 px-2 py-1 text-[11px] font-semibold text-paper hover:bg-clay-700"
                            >
                              Confirm
                            </button>
                            <button
                              onClick={() => setConfirmDelete(null)}
                              className="rounded-md p-1.5 text-ink-500 hover:bg-ink-100"
                              aria-label="Cancel delete"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </>
                        ) : (
                          <button
                            onClick={() => setConfirmDelete(v.id)}
                            className="rounded-md p-1.5 text-ink-400 hover:bg-clay-50 hover:text-clay-600"
                            aria-label="Delete"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      <EditVenueModal
        venue={editTarget}
        onClose={() => setEditTarget(null)}
        onSaved={handleSaved}
      />
    </div>
  );
}

function Section({
  title,
  kicker,
  children,
}: {
  title: string;
  kicker?: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="mb-3">
        {kicker ? <span className="kicker text-clay-700">{kicker}</span> : null}
        <h2 className="font-heading text-[18px] font-bold text-ink-900">{title}</h2>
      </div>
      {children}
    </section>
  );
}

function Empty({ icon, text }: { icon?: React.ReactNode; text: string }) {
  return (
    <div className="flex items-center justify-center gap-2 rounded-2xl border border-dashed border-ink-200 bg-surface/60 py-10 text-[13px] text-ink-400">
      {icon}
      {text}
    </div>
  );
}

function Th({
  children,
  align = "left",
}: {
  children: React.ReactNode;
  align?: "left" | "center" | "right";
}) {
  const alignClass = align === "center" ? "text-center" : align === "right" ? "text-right" : "text-left";
  return (
    <th className={`kicker px-4 py-3 ${alignClass} text-ink-600`}>{children}</th>
  );
}

function formatDate(s: string) {
  return new Date(s).toLocaleDateString();
}
