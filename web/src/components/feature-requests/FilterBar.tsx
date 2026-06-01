"use client";

import { useTranslations } from "next-intl";
import { Flame, Clock3, TrendingUp, Search } from "lucide-react";
import type { LucideIcon } from "lucide-react";

const tabs: {
  id: "most-voted" | "newest" | "trending";
  key: string;
  icon: LucideIcon;
}[] = [
  { id: "most-voted", key: "filterMostVoted", icon: Flame },
  { id: "newest", key: "filterNewest", icon: Clock3 },
  { id: "trending", key: "filterTrending", icon: TrendingUp },
];

type TabId = (typeof tabs)[number]["id"];

interface FilterBarProps {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
}

export default function FilterBar({
  activeTab,
  onTabChange,
  searchQuery,
  onSearchChange,
}: FilterBarProps) {
  const t = useTranslations("featureRequests");

  return (
    <div className="flex flex-wrap items-center justify-between gap-4">
      <div className="flex overflow-hidden rounded-[12px] border border-ink-100 bg-surface p-1 shadow-[0_2px_4px_-2px_rgba(12,29,19,0.04)]">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`flex items-center gap-1.5 rounded-[9px] px-4 py-2 text-[13px] transition-colors ${
                isActive
                  ? "bg-gradient-to-b from-moss-700 to-moss-900 text-paper font-semibold shadow-[inset_0_1px_0_rgba(255,255,255,0.15)]"
                  : "font-medium text-ink-600 hover:bg-ink-50"
              }`}
            >
              <tab.icon className="h-[14px] w-[14px]" strokeWidth={2} />
              {t(tab.key)}
            </button>
          );
        })}
      </div>

      <div className="flex w-[260px] items-center gap-2.5 rounded-[12px] border border-ink-100 bg-surface px-3.5 py-2.5 shadow-[0_2px_4px_-2px_rgba(12,29,19,0.04)]">
        <Search className="h-4 w-4 text-ink-400" />
        <input
          type="text"
          placeholder={t("searchPlaceholder")}
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="flex-1 bg-transparent text-[14px] text-ink-900 placeholder:text-ink-400 focus:outline-none"
        />
      </div>
    </div>
  );
}
