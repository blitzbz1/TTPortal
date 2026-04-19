"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslations } from "next-intl";
import { useAdmin } from "@/lib/use-admin";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/lib/supabase";
import { Trash2, Search, ShieldAlert, Loader2 } from "lucide-react";
import type { FeatureStatus } from "@/components/feature-requests/FeatureCard";

interface AdminFeature {
  id: string;
  title: string;
  description: string;
  category: string;
  status: FeatureStatus;
  vote_count: number;
  comment_count: number;
  author_email: string | null;
  created_at: string;
}

const statuses: { value: FeatureStatus; label: string; color: string }[] = [
  { value: "under_review", label: "Under Review", color: "bg-clay-100 text-clay-700" },
  { value: "planned", label: "Planned", color: "bg-blue-100 text-blue-700" },
  { value: "in_progress", label: "In Progress", color: "bg-moss-100 text-moss-800" },
  { value: "released", label: "Released", color: "bg-violet-100 text-violet-700" },
];

const categories = [
  "General",
  "Venues",
  "Events",
  "Social",
  "Leaderboards",
  "UX",
  "Equipment",
];

export default function AdminPage() {
  const t = useTranslations("admin");
  const { user } = useAuth();
  const { isAdmin, loading: adminLoading } = useAdmin();
  const [features, setFeatures] = useState<AdminFeature[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({
    title: "",
    description: "",
    category: "",
  });
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const fetchFeatures = useCallback(async () => {
    const { data } = await supabase
      .from("feature_requests")
      .select("*")
      .order("created_at", { ascending: false });
    setFeatures(data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (isAdmin) fetchFeatures();
  }, [isAdmin, fetchFeatures]);

  async function handleStatusChange(id: string, status: FeatureStatus) {
    await supabase.from("feature_requests").update({ status }).eq("id", id);
    setFeatures((prev) =>
      prev.map((f) => (f.id === id ? { ...f, status } : f))
    );
  }

  async function handleDelete(id: string) {
    await supabase.from("feature_requests").delete().eq("id", id);
    setFeatures((prev) => prev.filter((f) => f.id !== id));
    setDeleteConfirm(null);
  }

  function startEdit(f: AdminFeature) {
    setEditingId(f.id);
    setEditForm({
      title: f.title,
      description: f.description,
      category: f.category,
    });
  }

  async function saveEdit(id: string) {
    await supabase
      .from("feature_requests")
      .update({
        title: editForm.title,
        description: editForm.description,
        category: editForm.category,
      })
      .eq("id", id);
    setFeatures((prev) =>
      prev.map((f) => (f.id === id ? { ...f, ...editForm } : f))
    );
    setEditingId(null);
  }

  if (adminLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-paper">
        <Loader2 className="h-8 w-8 animate-spin text-moss-700" />
      </div>
    );
  }

  if (!user || !isAdmin) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-paper">
        <ShieldAlert className="h-16 w-16 text-ink-300" />
        <h1 className="font-heading text-[26px] font-bold tracking-tight text-ink-900">
          {t("accessDenied")}
        </h1>
        <p className="text-[14px] text-ink-600">{t("accessDeniedDescription")}</p>
      </div>
    );
  }

  const filtered = search
    ? features.filter(
        (f) =>
          f.title.toLowerCase().includes(search.toLowerCase()) ||
          f.description.toLowerCase().includes(search.toLowerCase()) ||
          (f.author_email ?? "").toLowerCase().includes(search.toLowerCase())
      )
    : features;

  return (
    <div className="min-h-screen bg-paper">
      {/* Header */}
      <div className="border-b border-ink-100 bg-surface px-6 py-7 md:px-12">
        <div className="flex items-center justify-between gap-4">
          <div className="flex flex-col gap-1">
            <span className="kicker text-clay-700">Admin</span>
            <h1 className="font-heading text-[26px] font-bold tracking-tight text-ink-900">
              {t("title")}
            </h1>
            <p className="text-[13.5px] text-ink-500">
              {t("subtitle", { count: features.length })}
            </p>
          </div>
          <div className="flex w-[300px] items-center gap-2 rounded-[10px] border border-ink-200 bg-paper px-3 py-2.5">
            <Search className="h-4 w-4 text-ink-400" />
            <input
              type="text"
              placeholder={t("searchPlaceholder")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-1 bg-transparent text-[13.5px] text-ink-900 placeholder:text-ink-400 focus:outline-none"
            />
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="px-6 py-8 md:px-12">
        {loading ? (
          <div className="py-20 text-center text-ink-400">
            <Loader2 className="mx-auto mb-2 h-6 w-6 animate-spin" />
            {t("loading")}
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-20 text-center text-ink-400">{t("empty")}</div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-ink-100 bg-surface shadow-[0_2px_6px_-4px_rgba(12,29,19,0.06)]">
            <table className="w-full text-[13.5px]">
              <thead>
                <tr className="border-b border-ink-100 bg-moss-50/50">
                  <th className="kicker px-4 py-3 text-left text-ink-600">
                    {t("colTitle")}
                  </th>
                  <th className="kicker w-[140px] px-4 py-3 text-left text-ink-600">
                    {t("colStatus")}
                  </th>
                  <th className="kicker w-[120px] px-4 py-3 text-left text-ink-600">
                    {t("colCategory")}
                  </th>
                  <th className="kicker w-[70px] px-4 py-3 text-center text-ink-600">
                    {t("colVotes")}
                  </th>
                  <th className="kicker w-[160px] px-4 py-3 text-left text-ink-600">
                    {t("colAuthor")}
                  </th>
                  <th className="kicker w-[100px] px-4 py-3 text-left text-ink-600">
                    {t("colDate")}
                  </th>
                  <th className="kicker w-[100px] px-4 py-3 text-center text-ink-600">
                    {t("colActions")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((f) => (
                  <tr
                    key={f.id}
                    className="border-b border-ink-100 transition-colors hover:bg-ink-50/50"
                  >
                    <td className="px-4 py-3 align-top">
                      {editingId === f.id ? (
                        <div className="flex flex-col gap-2">
                          <input
                            value={editForm.title}
                            onChange={(e) =>
                              setEditForm({ ...editForm, title: e.target.value })
                            }
                            className="rounded-md border border-ink-200 bg-paper px-2 py-1 text-[13.5px] font-medium focus:border-moss-500 focus:outline-none focus:ring-2 focus:ring-moss-500/20"
                          />
                          <textarea
                            value={editForm.description}
                            onChange={(e) =>
                              setEditForm({
                                ...editForm,
                                description: e.target.value,
                              })
                            }
                            rows={2}
                            className="resize-none rounded-md border border-ink-200 bg-paper px-2 py-1 text-[13.5px] focus:border-moss-500 focus:outline-none focus:ring-2 focus:ring-moss-500/20"
                          />
                          <div className="flex gap-2">
                            <button
                              onClick={() => saveEdit(f.id)}
                              className="btn-moss rounded-md px-3 py-1 text-[12px] font-semibold"
                            >
                              {t("save")}
                            </button>
                            <button
                              onClick={() => setEditingId(null)}
                              className="px-2 text-[12px] font-medium text-ink-500 hover:text-ink-700"
                            >
                              {t("cancel")}
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div>
                          <button
                            onClick={() => startEdit(f)}
                            className="text-left font-semibold text-ink-900 transition-colors hover:text-moss-700"
                          >
                            {f.title}
                          </button>
                          <p className="mt-0.5 line-clamp-1 text-[12px] text-ink-400">
                            {f.description}
                          </p>
                        </div>
                      )}
                    </td>

                    <td className="px-4 py-3 align-top">
                      <select
                        value={f.status}
                        onChange={(e) =>
                          handleStatusChange(
                            f.id,
                            e.target.value as FeatureStatus
                          )
                        }
                        className={`cursor-pointer rounded-full border-0 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider focus:outline-none focus:ring-2 focus:ring-moss-500/30 ${
                          statuses.find((s) => s.value === f.status)?.color
                        }`}
                      >
                        {statuses.map((s) => (
                          <option key={s.value} value={s.value}>
                            {s.label}
                          </option>
                        ))}
                      </select>
                    </td>

                    <td className="px-4 py-3 align-top">
                      {editingId === f.id ? (
                        <select
                          value={editForm.category}
                          onChange={(e) =>
                            setEditForm({
                              ...editForm,
                              category: e.target.value,
                            })
                          }
                          className="rounded-md border border-ink-200 bg-paper px-2 py-1 text-[12px] focus:border-moss-500 focus:outline-none focus:ring-2 focus:ring-moss-500/20"
                        >
                          {categories.map((c) => (
                            <option key={c} value={c}>
                              {c}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <span className="rounded-md bg-ink-100 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-ink-600">
                          {f.category}
                        </span>
                      )}
                    </td>

                    <td className="px-4 py-3 text-center align-top">
                      <span className="font-heading text-[15px] font-bold tabular-nums text-ink-900">
                        {f.vote_count}
                      </span>
                    </td>

                    <td className="px-4 py-3 align-top">
                      <span className="block max-w-[140px] truncate text-[12px] text-ink-500">
                        {f.author_email ?? "—"}
                      </span>
                    </td>

                    <td className="px-4 py-3 align-top">
                      <span className="text-[12px] tabular-nums text-ink-500">
                        {new Date(f.created_at).toLocaleDateString()}
                      </span>
                    </td>

                    <td className="px-4 py-3 text-center align-top">
                      {deleteConfirm === f.id ? (
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => handleDelete(f.id)}
                            className="rounded-md bg-clay-600 px-2 py-1 text-[11.5px] font-semibold text-paper hover:bg-clay-700"
                          >
                            {t("confirmDelete")}
                          </button>
                          <button
                            onClick={() => setDeleteConfirm(null)}
                            className="px-1 text-[12px] text-ink-500 hover:text-ink-800"
                          >
                            ✕
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setDeleteConfirm(f.id)}
                          className="rounded-md p-1 text-ink-400 transition-colors hover:bg-clay-50 hover:text-clay-600"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
