"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { ChevronUp, MessageCircle } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/lib/supabase";

export type FeatureStatus =
  | "under_review"
  | "planned"
  | "in_progress"
  | "released";

export interface FeatureRequest {
  id: string;
  title: string;
  description: string;
  category: string;
  status: FeatureStatus;
  vote_count: number;
  comment_count: number;
  has_voted?: boolean;
}

const statusStyles: Record<
  FeatureStatus,
  { key: string; dotColor: string; textColor: string; bgColor: string }
> = {
  under_review: {
    key: "statusUnderReview",
    dotColor: "bg-clay-500",
    textColor: "text-clay-700",
    bgColor: "bg-clay-50",
  },
  planned: {
    key: "statusPlanned",
    dotColor: "bg-blue-500",
    textColor: "text-blue-700",
    bgColor: "bg-blue-50",
  },
  in_progress: {
    key: "statusInProgress",
    dotColor: "bg-moss-600",
    textColor: "text-moss-800",
    bgColor: "bg-moss-50",
  },
  released: {
    key: "statusReleased",
    dotColor: "bg-violet-500",
    textColor: "text-violet-700",
    bgColor: "bg-violet-50",
  },
};

export default function FeatureCard({
  feature,
  onVoteChanged,
}: {
  feature: FeatureRequest;
  onVoteChanged: () => void;
}) {
  const t = useTranslations("featureRequests");
  const { user } = useAuth();
  const status = statusStyles[feature.status];
  const [voting, setVoting] = useState(false);

  async function handleVote() {
    if (!user || voting) return;
    setVoting(true);

    if (feature.has_voted) {
      await supabase
        .from("feature_request_votes")
        .delete()
        .eq("feature_request_id", feature.id)
        .eq("user_id", user.id);
    } else {
      await supabase.from("feature_request_votes").insert({
        feature_request_id: feature.id,
        user_id: user.id,
      });
    }

    setVoting(false);
    onVoteChanged();
  }

  return (
    <div className="card-tactile flex gap-5 p-6 transition-transform hover:-translate-y-[1px]">
      <button
        onClick={handleVote}
        disabled={!user || voting}
        className={`flex h-[68px] w-14 shrink-0 flex-col items-center justify-center gap-0.5 rounded-2xl border transition-colors ${
          feature.has_voted
            ? "border-moss-700 bg-gradient-to-b from-moss-700 to-moss-900 text-paper shadow-[inset_0_1px_0_rgba(255,255,255,0.18)]"
            : "border-ink-200 bg-paper text-ink-600 hover:border-moss-400 hover:bg-moss-50"
        } ${!user ? "cursor-not-allowed opacity-50" : "cursor-pointer"}`}
      >
        <ChevronUp className="h-[18px] w-[18px]" strokeWidth={2.25} />
        <span
          className={`font-heading text-[15px] font-bold tabular-nums ${
            feature.has_voted ? "text-paper" : "text-ink-900"
          }`}
        >
          {feature.vote_count}
        </span>
      </button>

      <div className="flex min-w-0 flex-1 flex-col gap-3">
        <div className="flex items-start justify-between gap-3">
          <h3 className="font-heading text-[17px] font-bold leading-tight tracking-tight text-ink-900">
            {feature.title}
          </h3>
          <div
            className={`flex shrink-0 items-center gap-1.5 ${status.bgColor} rounded-full border border-current/10 px-2.5 py-1`}
          >
            <span className={`h-[6px] w-[6px] rounded-full ${status.dotColor}`} />
            <span
              className={`text-[11px] font-semibold uppercase tracking-wider ${status.textColor}`}
            >
              {t(status.key)}
            </span>
          </div>
        </div>

        <p className="line-clamp-2 text-[14px] leading-relaxed text-ink-600">
          {feature.description}
        </p>

        <div className="flex items-center gap-3 pt-0.5">
          <span className="rounded-md bg-ink-100 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-ink-600">
            {feature.category}
          </span>
          <span className="flex items-center gap-1 text-[12px] text-ink-400">
            <MessageCircle className="h-[13px] w-[13px]" />
            {t("comments", { count: feature.comment_count })}
          </span>
        </div>
      </div>
    </div>
  );
}
