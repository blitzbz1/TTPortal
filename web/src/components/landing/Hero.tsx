"use client";

import Image from "next/image";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { useState } from "react";
import { ArrowRight } from "lucide-react";
import GetStartedModal from "@/components/GetStartedModal";

function BallGlyph({ className = "" }: { className?: string }) {
  return (
    <span
      className={`inline-block h-[0.7em] w-[0.7em] translate-y-[-0.05em] rounded-full bg-gradient-to-br from-clay-300 to-clay-600 shadow-[inset_0_1.5px_0_rgba(255,255,255,0.55),0_2px_4px_rgba(194,65,12,0.35)] ${className}`}
    />
  );
}

export default function Hero() {
  const t = useTranslations("hero");
  const [showModal, setShowModal] = useState(false);

  return (
    <section className="relative overflow-hidden bg-[radial-gradient(ellipse_at_top_left,rgba(217,235,224,0.7)_0%,var(--color-paper)_45%,rgba(250,227,209,0.55)_100%)] px-6 pb-10 pt-14 md:px-20 md:pt-20">
      {/* decorative trajectory arc — ball path from caption toward phone */}
      <div
        aria-hidden
        className="trajectory pointer-events-none absolute left-[42%] top-[62%] hidden h-[14px] w-[420px] -rotate-[14deg] lg:block"
      />
      {/* decorative ball at trajectory end */}
      <div
        aria-hidden
        className="pointer-events-none absolute left-[70%] top-[40%] hidden h-6 w-6 rounded-full bg-gradient-to-br from-clay-300 to-clay-600 shadow-[inset_0_2px_0_rgba(255,255,255,0.5),0_6px_18px_rgba(194,65,12,0.3)] lg:block"
      />

      <div className="flex flex-col items-start gap-16 lg:flex-row lg:gap-10">
        <div className="flex max-w-[600px] flex-1 flex-col gap-8 pt-4">
          <span className="kicker flex items-center gap-2 text-clay-700">
            <span className="inline-block h-[6px] w-[6px] rounded-full bg-clay-500" />
            {t("badge")}
          </span>

          <h1 className="font-heading text-[clamp(48px,7vw,82px)] font-extrabold leading-[0.98] tracking-[-0.035em] text-ink-900">
            {t("titleLine1")}
            <br />
            <span className="relative inline-block">
              {t("titleLine2")}
              <span
                aria-hidden
                className="absolute -bottom-1 left-0 h-[6px] w-full rounded-sm bg-clay-500/85"
                style={{ transform: "skewX(-8deg)" }}
              />
            </span>
          </h1>

          <p className="max-w-[500px] text-[17px] leading-relaxed text-ink-600">
            {t("subtitle")}
          </p>

          <div className="flex flex-wrap items-center gap-3 pt-1">
            <button
              onClick={() => setShowModal(true)}
              className="btn-moss inline-flex items-center gap-2 rounded-full px-7 py-3.5 text-[15px] font-semibold"
            >
              {t("primaryCta")}
              <ArrowRight className="h-4 w-4" />
            </button>
            <Link
              href="/#how-it-works"
              className="btn-ghost inline-flex items-center rounded-full px-7 py-3.5 text-[15px] font-medium"
            >
              {t("secondaryCta")}
            </Link>
          </div>

          {/* Small stat strip — builds trust, evokes a scoreboard */}
          <div className="mt-2 flex flex-wrap items-center gap-x-7 gap-y-2 border-t border-ink-100 pt-5 text-[13px] text-ink-600">
            <span className="flex items-center gap-2">
              <BallGlyph className="!h-[8px] !w-[8px]" />
              <span>
                <strong className="font-semibold tabular-nums text-ink-900">
                  180+
                </strong>{" "}
                venues
              </span>
            </span>
            <span className="h-3 w-px bg-ink-200" />
            <span className="flex items-center gap-2">
              <BallGlyph className="!h-[8px] !w-[8px]" />
              <span>
                <strong className="font-semibold tabular-nums text-ink-900">
                  12
                </strong>{" "}
                cities
              </span>
            </span>
            <span className="h-3 w-px bg-ink-200" />
            <span className="flex items-center gap-2">
              <BallGlyph className="!h-[8px] !w-[8px]" />
              <span>
                <strong className="font-semibold tabular-nums text-ink-900">
                  2k+
                </strong>{" "}
                sessions logged
              </span>
            </span>
          </div>
        </div>

        {/* Phone mockup */}
        <div className="relative self-center">
          {/* Glow plate behind the device */}
          <div
            aria-hidden
            className="absolute -inset-8 -z-10 rounded-[56px] bg-gradient-to-br from-moss-100/70 via-paper to-clay-100/50 blur-2xl"
          />
          <div className="relative h-[640px] w-[320px] shrink-0 rounded-[42px] bg-ink-900 p-[9px] shadow-[0_30px_80px_-20px_rgba(12,29,19,0.4),0_8px_30px_-10px_rgba(194,65,12,0.12)]">
            {/* Notch */}
            <div className="absolute left-1/2 top-[14px] z-10 h-[22px] w-[110px] -translate-x-1/2 rounded-full bg-ink-900" />
            <div className="relative h-full w-full overflow-hidden rounded-[34px] bg-ink-900">
              <Image
                src="/screenshots/harta.png"
                alt={t("appPreview")}
                fill
                sizes="320px"
                className="object-contain"
                priority
              />
            </div>
            {/* small "LIVE" sports-style badge pinned to the frame */}
            <div className="absolute -right-3 top-24 rotate-6 rounded-md border border-ink-100 bg-surface px-2 py-1 shadow-[0_6px_16px_-6px_rgba(12,29,19,0.18)]">
              <span className="kicker flex items-center gap-1.5 text-moss-800">
                <span className="inline-block h-[6px] w-[6px] animate-pulse rounded-full bg-clay-500" />
                Live
              </span>
            </div>
          </div>
        </div>
      </div>

      <GetStartedModal open={showModal} onClose={() => setShowModal(false)} />
    </section>
  );
}
