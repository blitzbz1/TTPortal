import { useTranslations } from "next-intl";
import {
  Users,
  Bell,
  BarChart3,
  Shield,
  Smartphone,
  Zap,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

const featureKeys: {
  icon: LucideIcon;
  titleKey: string;
  descKey: string;
}[] = [
  { icon: Users, titleKey: "friendManagement", descKey: "friendManagementDesc" },
  { icon: Bell, titleKey: "smartNotifications", descKey: "smartNotificationsDesc" },
  { icon: BarChart3, titleKey: "eventAnalytics", descKey: "eventAnalyticsDesc" },
  { icon: Shield, titleKey: "privacyFirst", descKey: "privacyFirstDesc" },
  { icon: Smartphone, titleKey: "worksEverywhere", descKey: "worksEverywhereDesc" },
  { icon: Zap, titleKey: "realTimeSync", descKey: "realTimeSyncDesc" },
];

export default function SecondaryFeatures() {
  const t = useTranslations("secondaryFeatures");

  return (
    <section className="relative bg-moss-50/50 px-6 py-28 md:px-20">
      <div className="mx-auto flex max-w-[820px] flex-col items-center gap-4 pb-16 text-center">
        <span className="kicker flex items-center gap-2 text-moss-700">
          <span className="inline-block h-[6px] w-[6px] rounded-full bg-moss-600" />
          More inside
        </span>
        <h2 className="font-heading text-[36px] font-extrabold leading-[1.08] tracking-[-0.025em] text-ink-900 md:text-[44px]">
          {t("title")}
        </h2>
        <p className="text-[17px] leading-relaxed text-ink-600">
          {t("description")}
        </p>
      </div>

      <div className="mx-auto grid max-w-[1180px] grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
        {featureKeys.map((feat, i) => (
          <div
            key={feat.titleKey}
            className="group card-tactile relative flex flex-col gap-4 p-7 transition-transform hover:-translate-y-[2px]"
          >
            <div className="flex items-center justify-between">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-moss-100 to-moss-50 text-moss-800 ring-1 ring-inset ring-moss-200/60">
                <feat.icon className="h-[22px] w-[22px]" strokeWidth={1.8} />
              </div>
              <span className="font-heading text-[13px] font-semibold text-ink-300 tabular-nums">
                0{i + 1}
              </span>
            </div>
            <h3 className="font-heading text-[19px] font-bold tracking-tight text-ink-900">
              {t(feat.titleKey)}
            </h3>
            <p className="text-[14px] leading-relaxed text-ink-600">
              {t(feat.descKey)}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
