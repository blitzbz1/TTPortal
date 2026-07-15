"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Flag, Lightbulb, Loader2, MapPin, MessageSquare, ShieldAlert } from "lucide-react";
import { useAdmin } from "@/lib/use-admin";
import { useAuth } from "@/lib/auth-context";
import { AdminTabs, type AdminTabKey } from "@/components/admin/AdminTabs";
import { ReviewsPanel } from "@/components/admin/ReviewsPanel";
import { VenuesPanel } from "@/components/admin/VenuesPanel";
import { FeedbackPanel } from "@/components/admin/FeedbackPanel";
import { FeatureRequestsPanel } from "@/components/admin/FeatureRequestsPanel";

export default function AdminPage() {
  const t = useTranslations("admin");
  const { user } = useAuth();
  const { isAdmin, loading: adminLoading } = useAdmin();

  const [activeTab, setActiveTab] = useState<AdminTabKey>("venues");
  const [pendingVenuesCount, setPendingVenuesCount] = useState<number>(0);
  const [flaggedReviewsCount, setFlaggedReviewsCount] = useState<number>(0);

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

  const tabs = [
    { key: "venues" as const, label: t("tabVenues"), icon: MapPin, badge: pendingVenuesCount },
    { key: "reviews" as const, label: t("tabReviews"), icon: Flag, badge: flaggedReviewsCount },
    { key: "feedback" as const, label: t("tabFeedback"), icon: MessageSquare },
    { key: "features" as const, label: t("tabFeatures"), icon: Lightbulb },
  ];

  return (
    <div className="min-h-screen bg-paper">
      <header className="border-b border-ink-100 bg-surface px-6 pb-2 pt-7 md:px-12">
        <div className="flex flex-col gap-1">
          <span className="kicker text-clay-700">Admin</span>
          <h1 className="font-heading text-[26px] font-bold tracking-tight text-ink-900">
            {t("dashboardTitle")}
          </h1>
          <p className="text-[13.5px] text-ink-500">{t("dashboardSubtitle")}</p>
        </div>
      </header>

      <AdminTabs tabs={tabs} active={activeTab} onChange={setActiveTab} />

      <main className="px-6 py-8 md:px-12">
        {activeTab === "venues" ? (
          <VenuesPanel onPendingCountChange={setPendingVenuesCount} />
        ) : activeTab === "reviews" ? (
          <ReviewsPanel onCountChange={setFlaggedReviewsCount} />
        ) : activeTab === "feedback" ? (
          <FeedbackPanel />
        ) : (
          <FeatureRequestsPanel />
        )}
      </main>
    </div>
  );
}
