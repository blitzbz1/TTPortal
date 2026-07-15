"use client";

import { useTranslations } from "next-intl";
import { ArrowRight } from "lucide-react";
import { useState } from "react";
import { Link } from "@/i18n/navigation";
import GetStartedModal from "@/components/GetStartedModal";

interface CTASectionProps {
  titleLine1: string;
  titleLine2: string;
  subtitle: string;
}

export default function CTASection({
  titleLine1,
  titleLine2,
  subtitle,
}: CTASectionProps) {
  const t = useTranslations("cta");
  const [showModal, setShowModal] = useState(false);

  return (
    <section className="relative overflow-hidden bg-moss-950 px-6 py-28 md:px-20">
      {/* subtle dotted texture */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.08]"
        style={{
          backgroundImage:
            "radial-gradient(circle, rgba(255,255,255,0.8) 1px, transparent 1.2px)",
          backgroundSize: "22px 22px",
        }}
      />
      {/* decorative ball arc in corner */}
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-20 -right-20 h-[300px] w-[300px] rounded-full border border-clay-500/30"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-20 -right-20 h-[200px] w-[200px] rounded-full border border-clay-500/20"
      />

      <div className="relative mx-auto flex max-w-[820px] flex-col items-center gap-8 text-center">
        <span className="kicker flex items-center gap-2 text-clay-300">
          <span className="inline-block h-[6px] w-[6px] rounded-full bg-clay-400" />
          Ready when you are
        </span>

        <h2 className="font-heading text-[42px] font-extrabold leading-[1.04] tracking-[-0.03em] text-paper md:text-[58px]">
          {titleLine1}
          <br />
          <span className="text-clay-300">{titleLine2}</span>
        </h2>

        <p className="max-w-[520px] text-[17px] leading-relaxed text-moss-200/90">
          {subtitle}
        </p>

        <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
          <button
            onClick={() => setShowModal(true)}
            className="btn-clay inline-flex items-center gap-2 rounded-full px-9 py-[18px] text-[16px] font-semibold"
          >
            {t("getStartedFree")}
            <ArrowRight className="h-4 w-4" />
          </button>
          <Link
            href="/feature-requests"
            className="inline-flex items-center rounded-full border border-moss-600 bg-moss-800/30 px-9 py-[18px] text-[16px] font-medium text-paper transition-colors hover:border-moss-400 hover:bg-moss-700/40"
          >
            {t("suggestFeature")}
          </Link>
        </div>

        <span className="pt-2 text-[12.5px] text-moss-300/80">
          {t("trusted")}
        </span>
      </div>

      <GetStartedModal open={showModal} onClose={() => setShowModal(false)} />
    </section>
  );
}
