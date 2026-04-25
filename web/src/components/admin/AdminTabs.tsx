"use client";

import type { LucideIcon } from "lucide-react";

export type AdminTabKey = "reviews" | "venues" | "feedback" | "features";

export interface AdminTabDef {
  key: AdminTabKey;
  label: string;
  icon: LucideIcon;
  badge?: number;
}

interface AdminTabsProps {
  tabs: AdminTabDef[];
  active: AdminTabKey;
  onChange: (key: AdminTabKey) => void;
}

export function AdminTabs({ tabs, active, onChange }: AdminTabsProps) {
  return (
    <nav
      className="flex gap-1 border-b border-ink-100 bg-surface px-6 md:px-12"
      role="tablist"
      aria-label="Admin sections"
    >
      {tabs.map(({ key, label, icon: Icon, badge }) => {
        const isActive = key === active;
        return (
          <button
            key={key}
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(key)}
            className={`relative flex items-center gap-2 px-3 py-3 text-[13px] font-semibold transition-colors ${
              isActive
                ? "text-moss-800"
                : "text-ink-500 hover:text-ink-800"
            }`}
          >
            <Icon className="h-4 w-4" />
            <span>{label}</span>
            {badge !== undefined && badge > 0 ? (
              <span
                className={`ml-1 inline-flex min-w-[20px] items-center justify-center rounded-full px-1.5 py-0.5 text-[10.5px] font-bold tabular-nums ${
                  isActive
                    ? "bg-moss-700 text-paper"
                    : "bg-ink-100 text-ink-700"
                }`}
              >
                {badge}
              </span>
            ) : null}
            {isActive ? (
              <span className="absolute inset-x-3 -bottom-px h-[2px] rounded-full bg-moss-700" />
            ) : null}
          </button>
        );
      })}
    </nav>
  );
}
