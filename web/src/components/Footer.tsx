import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Twitter, Linkedin, Instagram } from "lucide-react";

export default function Footer() {
  const t = useTranslations("footer");

  const footerColumns = [
    {
      title: t("product"),
      links: [
        { label: t("productFeatures"), href: "/#features" as const },
        { label: t("productFeatureRequests"), href: "/feature-requests" as const },
        { label: t("productDownload"), href: "/" as const },
      ],
    },
    {
      title: t("company"),
      links: [{ label: t("companyAbout"), href: "/" as const }],
    },
    {
      title: t("legal"),
      links: [
        { label: t("legalPrivacy"), href: "/" as const },
        { label: t("legalTerms"), href: "/" as const },
        { label: t("legalContact"), href: "/" as const },
      ],
    },
  ];

  return (
    <footer className="relative bg-ink-900 px-6 pb-10 pt-16 text-ink-300 md:px-20">
      {/* top accent stripe */}
      <div
        aria-hidden
        className="absolute left-0 right-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-clay-500/60 to-transparent"
      />

      <div className="flex flex-col gap-12">
        <div className="flex flex-col justify-between gap-12 md:flex-row">
          <div className="flex max-w-[320px] flex-col gap-4">
            <div className="flex items-center gap-3">
              <span className="relative inline-flex h-9 w-9 items-center justify-center">
                <span className="absolute inset-0 rounded-full bg-gradient-to-br from-moss-600 to-moss-800" />
                <span className="relative h-2 w-2 rounded-full bg-clay-500 ring-2 ring-paper/20" />
              </span>
              <span className="font-heading text-[22px] font-extrabold tracking-tight text-paper">
                {t("brand")}
              </span>
            </div>
            <p className="text-[14px] leading-relaxed text-ink-400">
              {t("tagline")}
            </p>
          </div>

          <div className="flex flex-wrap gap-14">
            {footerColumns.map((col) => (
              <div key={col.title} className="flex flex-col gap-4">
                <span className="kicker text-moss-300/80">{col.title}</span>
                {col.links.map((link) => (
                  <Link
                    key={link.label}
                    href={link.href}
                    className="text-[14px] text-ink-400 transition-colors hover:text-paper"
                  >
                    {link.label}
                  </Link>
                ))}
              </div>
            ))}
          </div>
        </div>

        <div className="h-px bg-ink-800" />

        <div className="flex flex-col items-center justify-between gap-4 md:flex-row">
          <span className="text-[12.5px] text-ink-500">{t("copyright")}</span>
          <div className="flex items-center gap-4 text-ink-500">
            <Twitter className="h-[18px] w-[18px] cursor-pointer transition-colors hover:text-paper" />
            <Linkedin className="h-[18px] w-[18px] cursor-pointer transition-colors hover:text-paper" />
            <Instagram className="h-[18px] w-[18px] cursor-pointer transition-colors hover:text-paper" />
          </div>
        </div>
      </div>
    </footer>
  );
}
