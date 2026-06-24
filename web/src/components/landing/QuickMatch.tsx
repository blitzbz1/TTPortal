import { useTranslations } from "next-intl";
import { QrCode, MousePointerClick, Trophy } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import ScoreboardMock from "@/components/landing/ScoreboardMock";
import LiveBadge from "@/components/landing/LiveBadge";

const steps: { icon: LucideIcon; titleKey: string; descKey: string }[] = [
  { icon: QrCode, titleKey: "step1Title", descKey: "step1Desc" },
  { icon: MousePointerClick, titleKey: "step2Title", descKey: "step2Desc" },
  { icon: Trophy, titleKey: "step3Title", descKey: "step3Desc" },
];

const specKeys = ["spec1", "spec2", "spec3", "spec4"] as const;

export default function QuickMatch() {
  const t = useTranslations("quickMatch");

  return (
    <section
      id="quick-match"
      className="relative overflow-hidden bg-gradient-to-b from-moss-50/40 via-surface to-surface px-6 py-28 md:px-20"
    >
      <div className="mx-auto flex max-w-[820px] flex-col items-center gap-5 pb-16 text-center">
        <span className="kicker flex items-center gap-2 text-clay-700">
          <span className="inline-block h-[6px] w-[6px] rounded-full bg-clay-500" />
          {t("label")}
        </span>
        <h2 className="font-heading text-[36px] font-extrabold leading-[1.06] tracking-[-0.028em] text-ink-900 md:text-[48px]">
          {t("title")}
          <br />
          {t("titleLine2")}
        </h2>
        <p className="max-w-[560px] text-[17px] leading-relaxed text-ink-600">
          {t("description")}
        </p>
      </div>

      {/* the live scoreboard device (caps at the board's own 760px max width) */}
      <div className="relative mx-auto max-w-[760px]">
        <ScoreboardMock
          alt={t("scoreboardAlt")}
          youLabel={t("you")}
          opponentLabel={t("opponent")}
          serveLabel={t("serving")}
          undoLabel={t("undo")}
          gameLabel={t("game")}
          formatLabel={t("format")}
        />
        {/* sports-style "Live" tag pinned to the frame */}
        <LiveBadge className="absolute -top-3 right-2 rotate-3 md:right-6" />
      </div>

      {/* spec chips */}
      <div className="mx-auto mt-12 flex max-w-[820px] flex-wrap items-center justify-center gap-2.5">
        {specKeys.map((key) => (
          <span
            key={key}
            className="rounded-full border border-moss-200/70 bg-moss-50/60 px-4 py-1.5 text-[13px] font-semibold text-moss-800"
          >
            {t(key)}
          </span>
        ))}
      </div>

      {/* QR-pairing flow */}
      <div className="mx-auto mt-14 grid max-w-[1080px] grid-cols-1 gap-5 md:grid-cols-3">
        {steps.map((step, i) => (
          <div
            key={step.titleKey}
            className="card-tactile relative flex flex-col gap-4 p-7"
          >
            <div className="flex items-center justify-between">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-moss-100 to-moss-50 text-moss-800 ring-1 ring-inset ring-moss-200/60">
                <step.icon className="h-[22px] w-[22px]" strokeWidth={1.8} />
              </div>
              <span className="font-heading text-[13px] font-semibold tabular-nums text-ink-300">
                0{i + 1}
              </span>
            </div>
            <h3 className="font-heading text-[19px] font-bold tracking-tight text-ink-900">
              {t(step.titleKey)}
            </h3>
            <p className="text-[14px] leading-relaxed text-ink-600">
              {t(step.descKey)}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
