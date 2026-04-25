"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, MessageSquare, Trash2, X } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import {
  deleteUserFeedback,
  getUserFeedback,
  type UserFeedbackRow,
} from "@/lib/admin-service";
import { FeedbackReplyModal } from "./FeedbackReplyModal";

export function FeedbackPanel() {
  const { user } = useAuth();
  const [items, setItems] = useState<UserFeedbackRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [replyTarget, setReplyTarget] = useState<UserFeedbackRow | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await getUserFeedback(100);
    setItems((data ?? []) as unknown as UserFeedbackRow[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleDelete(id: string) {
    const { error } = await deleteUserFeedback(id);
    if (error) {
      alert(`Delete failed: ${error.message}`);
      return;
    }
    setItems((prev) => prev.filter((f) => f.id !== id));
    setConfirmDelete(null);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-16 text-[13px] text-ink-400">
        <Loader2 className="h-5 w-5 animate-spin" /> Loading feedback…
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-ink-200 bg-surface/60 py-16 text-center text-[13px] text-ink-400">
        No user feedback yet.
      </div>
    );
  }

  return (
    <>
      <div className="overflow-hidden rounded-2xl border border-ink-100 bg-surface shadow-[0_2px_6px_-4px_rgba(12,29,19,0.06)]">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="border-b border-ink-100 bg-moss-50/50">
              <th className="kicker px-4 py-3 text-left text-ink-600">From</th>
              <th className="kicker w-[110px] px-4 py-3 text-left text-ink-600">Category</th>
              <th className="kicker px-4 py-3 text-left text-ink-600">Message</th>
              <th className="kicker w-[120px] px-4 py-3 text-left text-ink-600">Page</th>
              <th className="kicker w-[100px] px-4 py-3 text-left text-ink-600">Date</th>
              <th className="kicker w-[140px] px-4 py-3 text-right text-ink-600">Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.map((f) => (
              <tr
                key={f.id}
                className="border-b border-ink-100 align-top transition-colors hover:bg-ink-50/50"
              >
                <td className="px-4 py-3">
                  <div className="font-semibold text-ink-900">
                    {f.profiles?.full_name ?? "—"}
                  </div>
                  <div className="line-clamp-1 text-[11.5px] text-ink-500">
                    {f.profiles?.email ?? "—"}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <CategoryBadge value={f.category} />
                </td>
                <td className="px-4 py-3">
                  <p className="line-clamp-2 max-w-[420px] text-ink-700">{f.message}</p>
                </td>
                <td className="px-4 py-3">
                  <span className="rounded-md bg-ink-100 px-2 py-0.5 text-[11px] font-medium text-ink-600">
                    {f.page ?? "—"}
                  </span>
                </td>
                <td className="px-4 py-3 text-[12px] tabular-nums text-ink-500">
                  {new Date(f.created_at).toLocaleDateString()}
                </td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-1">
                    <button
                      onClick={() => setReplyTarget(f)}
                      className="inline-flex items-center gap-1 rounded-md border border-ink-200 px-2 py-1 text-[11.5px] font-semibold text-ink-700 hover:bg-ink-50"
                    >
                      <MessageSquare className="h-3 w-3" /> Reply
                    </button>
                    {confirmDelete === f.id ? (
                      <>
                        <button
                          onClick={() => handleDelete(f.id)}
                          className="rounded-md bg-clay-600 px-2 py-1 text-[11px] font-semibold text-paper hover:bg-clay-700"
                        >
                          Confirm
                        </button>
                        <button
                          onClick={() => setConfirmDelete(null)}
                          className="rounded-md p-1.5 text-ink-500 hover:bg-ink-100"
                          aria-label="Cancel delete"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={() => setConfirmDelete(f.id)}
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

      <FeedbackReplyModal
        feedback={replyTarget}
        adminId={user?.id ?? null}
        onClose={() => setReplyTarget(null)}
      />
    </>
  );
}

function CategoryBadge({ value }: { value: string | null }) {
  const v = (value ?? "general").toLowerCase();
  const palette =
    v === "bug"
      ? "bg-clay-100 text-clay-700"
      : v === "general"
        ? "bg-ink-100 text-ink-600"
        : "bg-moss-100 text-moss-800";
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-wider ${palette}`}
    >
      {v}
    </span>
  );
}
