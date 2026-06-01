"use client";

import { useTranslations, useLocale } from "next-intl";
import { Link, usePathname, useRouter } from "@/i18n/navigation";
import { Globe } from "lucide-react";
import { useState } from "react";
import type { Locale } from "@/i18n/routing";
import GetStartedModal from "@/components/GetStartedModal";

function BrandMark() {
  return (
    <span className="relative inline-flex h-9 w-9 items-center justify-center">
      <span className="absolute inset-0 rounded-full bg-gradient-to-br from-moss-700 to-moss-900 shadow-[inset_0_1px_0_rgba(255,255,255,0.18)]" />
      <span className="relative h-2 w-2 rounded-full bg-clay-500 shadow-[0_0_0_1.5px_rgba(255,255,255,0.9),0_1px_2px_rgba(194,65,12,0.5)]" />
    </span>
  );
}

export default function Header() {
  const t = useTranslations("header");
  const pathname = usePathname();
  const locale = useLocale() as Locale;
  const router = useRouter();
  const [showModal, setShowModal] = useState(false);

  function switchLocale(next: Locale) {
    router.replace(pathname, { locale: next });
  }

  const onFeatureReq = pathname === "/feature-requests";

  return (
    <header className="sticky top-0 z-30 flex h-20 items-center justify-between border-b border-ink-100/80 bg-paper/85 px-6 backdrop-blur-md md:px-20">
      <Link href="/" className="flex items-center gap-3">
        <BrandMark />
        <span className="font-heading text-[22px] font-extrabold tracking-tight text-ink-900">
          {t("brand")}
        </span>
      </Link>

      <nav className="hidden items-center gap-9 md:flex">
        <Link
          href="/#features"
          className="text-[14px] font-medium text-ink-600 transition-colors hover:text-ink-900"
        >
          {t("features")}
        </Link>
        <Link
          href="/#how-it-works"
          className="text-[14px] font-medium text-ink-600 transition-colors hover:text-ink-900"
        >
          {t("howItWorks")}
        </Link>
        <Link
          href="/feature-requests"
          className={`group flex items-center gap-2 text-[14px] font-semibold transition-colors ${
            onFeatureReq ? "text-clay-700" : "text-clay-600 hover:text-clay-700"
          }`}
        >
          <span className="relative">
            {t("featureRequests")}
            <span className="absolute -bottom-1 left-0 h-[2px] w-full origin-left scale-x-0 bg-clay-500 transition-transform duration-300 group-hover:scale-x-100" />
          </span>
          <span className="inline-flex h-[18px] items-center rounded-full bg-clay-100 px-1.5 text-[10px] font-bold tracking-wider text-clay-700">
            NEW
          </span>
        </Link>

        <button
          onClick={() => switchLocale(locale === "en" ? "ro" : "en")}
          className="flex items-center gap-1.5 rounded-full border border-ink-200/80 bg-surface/60 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-ink-600 transition-colors hover:border-moss-400 hover:text-moss-800"
          title={locale === "en" ? "Schimbă în Română" : "Switch to English"}
        >
          <Globe className="h-3.5 w-3.5" />
          {locale}
        </button>

        <button
          onClick={() => setShowModal(true)}
          className="btn-moss rounded-full px-6 py-2.5 text-[14px] font-semibold"
        >
          {t("getStarted")}
        </button>
      </nav>

      <GetStartedModal open={showModal} onClose={() => setShowModal(false)} />
    </header>
  );
}
