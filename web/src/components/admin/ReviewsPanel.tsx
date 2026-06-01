"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, Loader2, Star, Trash2, X } from "lucide-react";
import {
  deleteReview,
  getFlaggedReviews,
  keepReview,
  type FlaggedReview,
} from "@/lib/admin-service";

interface ReviewsPanelProps {
  onCountChange?: (n: number) => void;
}

export function ReviewsPanel({ onCountChange }: ReviewsPanelProps) {
  const [reviews, setReviews] = useState<FlaggedReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await getFlaggedReviews();
    const list = (data ?? []) as FlaggedReview[];
    setReviews(list);
    setLoading(false);
    onCountChange?.(list.length);
  }, [onCountChange]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleKeep(id: number) {
    const { error } = await keepReview(id);
    if (error) {
      alert(`Keep failed: ${error.message}`);
      return;
    }
    setReviews((prev) => {
      const next = prev.filter((r) => r.id !== id);
      onCountChange?.(next.length);
      return next;
    });
  }

  async function handleDelete(id: number) {
    const { error } = await deleteReview(id);
    if (error) {
      alert(`Delete failed: ${error.message}`);
      return;
    }
    setReviews((prev) => {
      const next = prev.filter((r) => r.id !== id);
      onCountChange?.(next.length);
      return next;
    });
    setConfirmDelete(null);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-16 text-[13px] text-ink-400">
        <Loader2 className="h-5 w-5 animate-spin" /> Loading flagged reviews…
      </div>
    );
  }

  if (reviews.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-ink-200 bg-surface/60 py-16 text-center text-[13px] text-ink-400">
        No flagged reviews — community is happy.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {reviews.map((r) => (
        <div
          key={r.id}
          className="flex flex-col gap-3 rounded-2xl border border-ink-100 bg-surface p-4 shadow-[0_2px_6px_-4px_rgba(12,29,19,0.06)] sm:flex-row sm:items-start sm:justify-between"
        >
          <div className="flex flex-1 flex-col gap-1.5">
            <div className="flex items-center gap-2">
              <h3 className="font-heading text-[14.5px] font-bold text-ink-900">
                {r.venues?.name ?? `Venue #${r.venue_id}`}
              </h3>
              {r.rating !== null ? (
                <span className="inline-flex items-center gap-0.5 rounded-md bg-ink-100 px-1.5 py-0.5 text-[11px] font-semibold tabular-nums text-ink-700">
                  <Star className="h-3 w-3 fill-clay-500 text-clay-500" />
                  {r.rating}
                </span>
              ) : null}
              <span className="inline-flex items-center gap-1 rounded-full bg-clay-100 px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-wider text-clay-700">
                {r.flag_count} {r.flag_count === 1 ? "flag" : "flags"}
              </span>
            </div>
            {r.comment ? (
              <p className="whitespace-pre-line text-[13px] text-ink-700">{r.comment}</p>
            ) : (
              <p className="text-[12.5px] italic text-ink-400">No comment</p>
            )}
            <p className="text-[11.5px] text-ink-400">
              by {r.profiles?.full_name ?? "—"} · {new Date(r.created_at).toLocaleDateString()}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button
              onClick={() => handleKeep(r.id)}
              className="inline-flex items-center gap-1.5 rounded-md border border-ink-200 px-3 py-2 text-[12.5px] font-semibold text-ink-700 hover:bg-ink-50"
            >
              <Check className="h-3.5 w-3.5" /> Keep
            </button>
            {confirmDelete === r.id ? (
              <>
                <button
                  onClick={() => handleDelete(r.id)}
                  className="rounded-md bg-clay-600 px-3 py-2 text-[12.5px] font-semibold text-paper hover:bg-clay-700"
                >
                  Confirm delete
                </button>
                <button
                  onClick={() => setConfirmDelete(null)}
                  className="rounded-md p-2 text-ink-500 hover:bg-ink-100"
                  aria-label="Cancel"
                >
                  <X className="h-4 w-4" />
                </button>
              </>
            ) : (
              <button
                onClick={() => setConfirmDelete(r.id)}
                className="inline-flex items-center gap-1.5 rounded-md border border-clay-200 px-3 py-2 text-[12.5px] font-semibold text-clay-700 hover:bg-clay-50"
              >
                <Trash2 className="h-3.5 w-3.5" /> Delete
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
