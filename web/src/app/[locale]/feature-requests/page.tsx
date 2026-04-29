"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslations } from "next-intl";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import CTASection from "@/components/CTASection";
import FeatureRequestHero from "@/components/feature-requests/FeatureRequestHero";
import type { FeatureStats } from "@/components/feature-requests/FeatureRequestHero";
import FilterBar from "@/components/feature-requests/FilterBar";
import FeatureCard from "@/components/feature-requests/FeatureCard";
import SuggestFeatureForm from "@/components/feature-requests/SuggestFeatureForm";
import StatusLegend from "@/components/feature-requests/StatusLegend";
import type { StatusCounts } from "@/components/feature-requests/StatusLegend";
import type { FeatureRequest } from "@/components/feature-requests/FeatureCard";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/lib/supabase";

type SortTab = "most-voted" | "newest" | "trending";

export default function FeatureRequestsPage() {
  const t = useTranslations("featureRequests");
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<SortTab>("most-voted");
  const [searchQuery, setSearchQuery] = useState("");
  const [features, setFeatures] = useState<FeatureRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<FeatureStats | null>(null);
  const [statusCounts, setStatusCounts] = useState<StatusCounts>({
    under_review: 0,
    planned: 0,
    in_progress: 0,
    released: 0,
  });

  const fetchFeatures = useCallback(async () => {
    let query = supabase.from("feature_requests").select("*");

    if (activeTab === "most-voted") {
      query = query.order("vote_count", { ascending: false });
    } else if (activeTab === "newest") {
      query = query.order("created_at", { ascending: false });
    } else {
      query = query.order("vote_count", { ascending: false });
    }

    const { data: requests } = await query;

    if (!requests || requests.length === 0) {
      setFeatures([]);
      setStats(null);
      setStatusCounts({ under_review: 0, planned: 0, in_progress: 0, released: 0 });
      setLoading(false);
      return;
    }

    const totalVotes = requests.reduce((sum, r) => sum + r.vote_count, 0);
    const shipped = requests.filter((r) => r.status === "released").length;
    setStats({
      totalFeatures: requests.length,
      totalVotes,
      shipped,
    });

    const counts: StatusCounts = { under_review: 0, planned: 0, in_progress: 0, released: 0 };
    for (const r of requests) {
      if (r.status in counts) {
        counts[r.status as keyof StatusCounts]++;
      }
    }
    setStatusCounts(counts);

    let votedIds = new Set<string>();
    if (user) {
      const { data: votes } = await supabase
        .from("feature_request_votes")
        .select("feature_request_id")
        .eq("user_id", user.id);
      if (votes) {
        votedIds = new Set(votes.map((v) => v.feature_request_id));
      }
    }

    setFeatures(
      requests.map((r) => ({
        id: r.id,
        title: r.title,
        description: r.description,
        category: r.category,
        status: r.status,
        vote_count: r.vote_count,
        comment_count: r.comment_count,
        has_voted: votedIds.has(r.id),
      }))
    );
    setLoading(false);
  }, [activeTab, user]);

  useEffect(() => {
    fetchFeatures();
  }, [fetchFeatures]);

  const filteredFeatures = searchQuery
    ? features.filter(
        (f) =>
          f.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          f.description.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : features;

  return (
    <main>
      <Header />
      <FeatureRequestHero stats={stats} />

      <section className="flex gap-8 bg-moss-50/40 px-6 py-16 md:px-20">
        <div className="flex min-w-0 flex-1 flex-col gap-6">
          <FilterBar
            activeTab={activeTab}
            onTabChange={setActiveTab}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
          />
          <div className="flex flex-col gap-4">
            {loading ? (
              <div className="py-12 text-center text-ink-400">Loading...</div>
            ) : filteredFeatures.length === 0 ? (
              <div className="py-12 text-center text-ink-400">
                No feature requests yet. Be the first to suggest one!
              </div>
            ) : (
              filteredFeatures.map((feature) => (
                <FeatureCard
                  key={feature.id}
                  feature={feature}
                  onVoteChanged={fetchFeatures}
                />
              ))
            )}
          </div>
        </div>

        <aside className="hidden lg:flex flex-col gap-6 w-[340px] shrink-0">
          <SuggestFeatureForm onSubmitted={fetchFeatures} />
          <StatusLegend counts={statusCounts} />
        </aside>
      </section>

      <CTASection
        titleLine1={t("ctaTitleLine1")}
        titleLine2={t("ctaTitleLine2")}
        subtitle={t("ctaSubtitle")}
      />
      <Footer />
    </main>
  );
}
