import { getTranslations, setRequestLocale } from "next-intl/server";
import { routing } from "@/i18n/routing";
import Header from "@/components/Header";
import Footer from "@/components/Footer";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "cookies" });
  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
  };
}

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

type StorageRow = {
  nameKey: string;
  categoryKey: string;
  purposeKey: string;
  durationKey: string;
};

const storageRows: StorageRow[] = [
  {
    nameKey: "rowAuthName",
    categoryKey: "rowAuthCategory",
    purposeKey: "rowAuthPurpose",
    durationKey: "rowAuthDuration",
  },
  {
    nameKey: "rowLangName",
    categoryKey: "rowLangCategory",
    purposeKey: "rowLangPurpose",
    durationKey: "rowLangDuration",
  },
  {
    nameKey: "rowCityName",
    categoryKey: "rowCityCategory",
    purposeKey: "rowCityPurpose",
    durationKey: "rowCityDuration",
  },
  {
    nameKey: "rowThemeName",
    categoryKey: "rowThemeCategory",
    purposeKey: "rowThemePurpose",
    durationKey: "rowThemeDuration",
  },
];

export default async function CookiesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "cookies" });

  return (
    <main className="bg-paper text-ink-900">
      <Header />
      <article className="mx-auto max-w-[760px] px-6 py-20 md:px-8 md:py-28">
        <header className="mb-12 flex flex-col gap-4">
          <span className="kicker text-moss-700">{t("kicker")}</span>
          <h1 className="font-heading text-[40px] font-extrabold leading-[1.05] tracking-[-0.02em] text-ink-900 md:text-[52px]">
            {t("title")}
          </h1>
          <p className="text-[13px] text-ink-500">{t("lastUpdated")}</p>
        </header>

        <p className="mb-12 text-[17px] leading-relaxed text-ink-700">
          {t("intro")}
        </p>

        <section className="mb-12 flex flex-col gap-3">
          <h2 className="font-heading text-[22px] font-bold tracking-tight text-ink-900 md:text-[26px]">
            {t("noTrackingTitle")}
          </h2>
          <p className="text-[15.5px] leading-relaxed text-ink-700">
            {t("noTrackingBody")}
          </p>
        </section>

        <section className="mb-12 flex flex-col gap-4">
          <h2 className="font-heading text-[22px] font-bold tracking-tight text-ink-900 md:text-[26px]">
            {t("whatWeStoreTitle")}
          </h2>
          <p className="text-[15.5px] leading-relaxed text-ink-700">
            {t("whatWeStoreBody")}
          </p>

          <div className="mt-2 overflow-x-auto rounded-2xl border border-ink-100 bg-surface">
            <table className="w-full text-left text-[14px]">
              <thead>
                <tr className="border-b border-ink-100 bg-ink-50/60 text-[12px] uppercase tracking-wider text-ink-500">
                  <th className="px-4 py-3 font-semibold">{t("colName")}</th>
                  <th className="px-4 py-3 font-semibold">{t("colCategory")}</th>
                  <th className="px-4 py-3 font-semibold">{t("colPurpose")}</th>
                  <th className="px-4 py-3 font-semibold">{t("colDuration")}</th>
                </tr>
              </thead>
              <tbody>
                {storageRows.map((row) => (
                  <tr
                    key={row.nameKey}
                    className="border-b border-ink-100 last:border-0"
                  >
                    <td className="px-4 py-3 font-mono text-[13px] text-ink-800">
                      {t(row.nameKey)}
                    </td>
                    <td className="px-4 py-3 text-ink-700">
                      {t(row.categoryKey)}
                    </td>
                    <td className="px-4 py-3 text-ink-700">
                      {t(row.purposeKey)}
                    </td>
                    <td className="px-4 py-3 text-ink-700">
                      {t(row.durationKey)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="mb-12 flex flex-col gap-3">
          <h2 className="font-heading text-[22px] font-bold tracking-tight text-ink-900 md:text-[26px]">
            {t("thirdPartyTitle")}
          </h2>
          <p className="text-[15.5px] leading-relaxed text-ink-700">
            {t("thirdPartyBody1")}
          </p>
          <p className="text-[15.5px] leading-relaxed text-ink-700">
            {t("thirdPartyBody2")}
          </p>
        </section>

        <section className="mb-12 flex flex-col gap-3">
          <h2 className="font-heading text-[22px] font-bold tracking-tight text-ink-900 md:text-[26px]">
            {t("clearTitle")}
          </h2>
          <p className="text-[15.5px] leading-relaxed text-ink-700">
            {t("clearBody")}
          </p>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="font-heading text-[22px] font-bold tracking-tight text-ink-900 md:text-[26px]">
            {t("contactTitle")}
          </h2>
          <p className="text-[15.5px] leading-relaxed text-ink-700">
            {t("contactBody")}
          </p>
        </section>
      </article>
      <Footer />
    </main>
  );
}
