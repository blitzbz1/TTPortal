"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Lightbulb, Send, ChevronDown } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/lib/supabase";

const categories = [
  "General",
  "Venues",
  "Events",
  "Social",
  "Leaderboards",
  "UX",
  "Equipment",
];

interface SuggestFeatureFormProps {
  onSubmitted: () => void;
}

export default function SuggestFeatureForm({
  onSubmitted,
}: SuggestFeatureFormProps) {
  const t = useTranslations("featureRequests");
  const { user } = useAuth();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("General");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    if (!title.trim() || !description.trim()) return;

    setSubmitting(true);
    setError("");

    const { error: insertError } = await supabase
      .from("feature_requests")
      .insert({
        title: title.trim(),
        description: description.trim(),
        category,
        author_id: user.id,
        author_email: user.email,
      });

    setSubmitting(false);

    if (insertError) {
      setError(insertError.message);
      return;
    }

    setTitle("");
    setDescription("");
    setCategory("General");
    onSubmitted();
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="card-tactile flex flex-col gap-5 p-6"
    >
      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-clay-100 to-clay-50 text-clay-700 ring-1 ring-inset ring-clay-200/60">
        <Lightbulb className="h-[19px] w-[19px]" strokeWidth={1.8} />
      </div>

      <div>
        <h3 className="font-heading text-[18px] font-bold tracking-tight text-ink-900">
          {t("suggestTitle")}
        </h3>
        <p className="mt-1.5 text-[13.5px] leading-relaxed text-ink-600">
          {t("suggestDescription")}
        </p>
      </div>

      <input
        type="text"
        placeholder={t("featureTitlePlaceholder")}
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        disabled={!user}
        required
        className="h-11 rounded-[10px] border border-ink-200 bg-paper px-3.5 text-[14px] text-ink-900 placeholder:text-ink-400 transition focus:border-moss-500 focus:outline-none focus:ring-4 focus:ring-moss-500/15 disabled:opacity-50"
      />

      <textarea
        placeholder={t("featureDescriptionPlaceholder")}
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        disabled={!user}
        required
        className="h-20 resize-none rounded-[10px] border border-ink-200 bg-paper p-3.5 text-[14px] text-ink-900 placeholder:text-ink-400 transition focus:border-moss-500 focus:outline-none focus:ring-4 focus:ring-moss-500/15 disabled:opacity-50"
      />

      <div className="relative">
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          disabled={!user}
          className="h-11 w-full appearance-none rounded-[10px] border border-ink-200 bg-paper px-3.5 pr-10 text-[14px] text-ink-900 transition focus:border-moss-500 focus:outline-none focus:ring-4 focus:ring-moss-500/15 disabled:opacity-50"
        >
          {categories.map((cat) => (
            <option key={cat} value={cat}>
              {cat}
            </option>
          ))}
        </select>
        <ChevronDown className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
      </div>

      {error && (
        <p className="text-[13px] text-clay-700">{error}</p>
      )}

      {!user && (
        <p className="text-center text-[12px] text-ink-400">
          Sign in above to submit a feature request.
        </p>
      )}

      <button
        type="submit"
        disabled={!user || submitting}
        className="btn-moss flex h-11 items-center justify-center gap-2 rounded-xl text-[14px] font-semibold disabled:cursor-not-allowed disabled:opacity-50"
      >
        <Send className="h-4 w-4" />
        {submitting ? "..." : t("submitFeature")}
      </button>
    </form>
  );
}
