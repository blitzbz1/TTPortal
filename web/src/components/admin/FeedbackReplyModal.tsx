"use client";

import { useEffect, useState } from "react";
import { Loader2, Send, X } from "lucide-react";
import {
  getFeedbackReplies,
  replyToFeedback,
  type FeedbackReply,
  type UserFeedbackRow,
} from "@/lib/admin-service";

interface FeedbackReplyModalProps {
  feedback: UserFeedbackRow | null;
  adminId: string | null;
  onClose: () => void;
}

export function FeedbackReplyModal({ feedback, adminId, onClose }: FeedbackReplyModalProps) {
  const [replies, setReplies] = useState<FeedbackReply[]>([]);
  const [loading, setLoading] = useState(false);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!feedback) return;
    setError(null);
    setDraft("");
    setLoading(true);
    getFeedbackReplies(feedback.id).then(({ data }) => {
      setReplies((data ?? []) as unknown as FeedbackReply[]);
      setLoading(false);
    });
  }, [feedback]);

  if (!feedback) return null;

  async function handleSend() {
    if (!feedback || !adminId) return;
    const text = draft.trim();
    if (!text) return;
    setSending(true);
    setError(null);
    const { data, error: err } = await replyToFeedback(feedback.id, adminId, text);
    setSending(false);
    if (err) {
      setError(err.message);
      return;
    }
    if (data) {
      setReplies((prev) => [...prev, data as unknown as FeedbackReply]);
      setDraft("");
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Feedback thread"
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/50 p-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[85vh] w-full max-w-[560px] flex-col overflow-hidden rounded-2xl bg-surface shadow-2xl"
      >
        <div className="flex items-start justify-between border-b border-ink-100 px-5 py-4">
          <div className="flex flex-col gap-1">
            <span className="kicker text-clay-700">Feedback thread</span>
            <h2 className="font-heading text-[16px] font-bold text-ink-900">
              {feedback.profiles?.full_name ?? feedback.profiles?.email ?? "Anonymous"}
            </h2>
            <p className="text-[11.5px] text-ink-500">
              {feedback.category ?? "general"} · {feedback.page ?? "—"} ·{" "}
              {new Date(feedback.created_at).toLocaleString()}
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-md p-1.5 text-ink-400 transition-colors hover:bg-ink-100 hover:text-ink-700"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex flex-1 flex-col gap-3 overflow-y-auto bg-paper px-5 py-4">
          <div className="rounded-2xl bg-surface p-3 shadow-sm">
            <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-ink-500">
              Original message
            </p>
            <p className="whitespace-pre-line text-[13px] text-ink-800">{feedback.message}</p>
          </div>

          {loading ? (
            <div className="flex items-center gap-2 py-2 text-[12.5px] text-ink-400">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading replies…
            </div>
          ) : replies.length === 0 ? (
            <p className="py-2 text-center text-[12px] italic text-ink-400">
              No replies yet.
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              {replies.map((r) => (
                <div
                  key={r.id}
                  className="rounded-2xl border border-moss-200 bg-moss-50 p-3"
                >
                  <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-moss-800">
                    {r.profiles?.full_name ?? "Admin"} ·{" "}
                    {new Date(r.created_at).toLocaleString()}
                  </p>
                  <p className="whitespace-pre-line text-[13px] text-ink-800">{r.reply_text}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex flex-col gap-2 border-t border-ink-100 px-5 py-3">
          {error ? (
            <p className="rounded-md bg-clay-50 px-3 py-1.5 text-[12px] text-clay-700">{error}</p>
          ) : null}
          <div className="flex items-end gap-2">
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Write a reply…"
              rows={2}
              className="flex-1 resize-none rounded-md border border-ink-200 bg-paper px-3 py-2 text-[13px] text-ink-900 placeholder:text-ink-400 focus:border-moss-500 focus:outline-none focus:ring-2 focus:ring-moss-500/20"
            />
            <button
              onClick={handleSend}
              disabled={sending || !draft.trim() || !adminId}
              className="btn-moss inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-[13px] font-semibold disabled:opacity-50"
            >
              {sending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Send className="h-3.5 w-3.5" />
              )}
              Send
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
