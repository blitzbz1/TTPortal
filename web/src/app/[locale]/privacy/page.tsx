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
  const t = await getTranslations({ locale, namespace: "privacy" });
  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
  };
}

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function PrivacyPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "privacy" });

  const sections = [
    { key: "collect", paragraphs: 2 },
    { key: "purposes", paragraphs: 1 },
    { key: "legalBases", paragraphs: 1 },
    { key: "processors", paragraphs: 1 },
    { key: "storage", paragraphs: 1 },
    { key: "rights", paragraphs: 2 },
    { key: "retention", paragraphs: 1 },
    { key: "children", paragraphs: 1 },
    { key: "changes", paragraphs: 1 },
    { key: "contact", paragraphs: 1 },
  ] as const;

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

        <div className="flex flex-col gap-10">
          {sections.map((section) => (
            <section key={section.key} className="flex flex-col gap-3">
              <h2 className="font-heading text-[22px] font-bold tracking-tight text-ink-900 md:text-[26px]">
                {t(`${section.key}Title`)}
              </h2>
              {Array.from({ length: section.paragraphs }).map((_, i) => (
                <p
                  key={i}
                  className="text-[15.5px] leading-relaxed text-ink-700"
                >
                  {t(`${section.key}Body${i + 1}`)}
                </p>
              ))}
            </section>
          ))}
        </div>
      </article>
      <Footer />
    </main>
  );
}
