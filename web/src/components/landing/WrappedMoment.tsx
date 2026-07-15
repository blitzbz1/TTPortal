import { useTranslations } from "next-intl";
import { Share2 } from "lucide-react";
import WrappedStory from "@/components/landing/WrappedStory";

export default function WrappedMoment() {
  const t = useTranslations("wrapped");

  const bullets = [t("bullet1"), t("bullet2"), t("bullet3")];

  return (
    <section className="relative overflow-hidden bg-moss-950 px-6 py-28 md:px-20">
      {/* celebratory gradient bloom */}
      <div
        aria-hidden
        className="pointer-events-none absolute -right-32 -top-24 h-[480px] w-[480px] rounded-full bg-[radial-gradient(circle,rgba(216,85,42,0.35)_0%,rgba(86,156,120,0.18)_45%,transparent_70%)] blur-2xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-32 -left-24 h-[420px] w-[420px] rounded-full bg-[radial-gradient(circle,rgba(56,128,101,0.3)_0%,transparent_70%)] blur-2xl"
      />
      {/* dotted texture */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.07]"
        style={{
          backgroundImage:
            "radial-gradient(circle, rgba(255,255,255,0.8) 1px, transparent 1.2px)",
          backgroundSize: "22px 22px",
        }}
      />

      <div className="relative mx-auto flex max-w-[1180px] flex-col items-center gap-16 lg:flex-row lg:gap-24">
        <div className="flex max-w-[560px] flex-1 flex-col gap-6">
          <span className="kicker flex items-center gap-2 text-clay-300">
            <span className="inline-block h-[6px] w-[6px] rounded-full bg-clay-400" />
            {t("label")}
          </span>

          <h2 className="font-heading text-[40px] font-extrabold leading-[1.03] tracking-[-0.03em] text-paper md:text-[54px]">
            {t("title")}
            <br />
            <span className="text-clay-300">{t("titleLine2")}</span>
          </h2>

          <p className="max-w-[500px] text-[17px] leading-relaxed text-moss-200/90">
            {t("description")}
          </p>

          <ul className="flex flex-col gap-3 pt-1">
            {bullets.map((bullet) => (
              <li key={bullet} className="flex items-start gap-3">
                <span className="mt-[7px] inline-block h-[6px] w-[6px] shrink-0 rounded-full bg-clay-400" />
                <span className="text-[14.5px] font-medium leading-relaxed text-moss-100/90">
                  {bullet}
                </span>
              </li>
            ))}
          </ul>

          <div className="mt-1 inline-flex w-fit items-center gap-2 rounded-full border border-moss-700 bg-moss-900/40 px-4 py-2 text-[13px] font-semibold text-moss-100">
            <Share2 className="h-4 w-4 text-clay-300" />
            {t("shareLine")}
          </div>
        </div>

        <WrappedStory />
      </div>
    </section>
  );
}
