import { getTranslations, setRequestLocale } from "next-intl/server";
import { routing } from "@/i18n/routing";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Link } from "@/i18n/navigation";
import { CheckCircle2 } from "lucide-react";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "deleteAccountWeb" });
  return {
    title: t("doneMetaTitle"),
    description: t("doneMetaDescription"),
  };
}

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function DeleteAccountDonePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "deleteAccountWeb" });

  return (
    <main className="bg-paper text-ink-900">
      <Header />
      <article className="mx-auto max-w-[640px] px-6 py-20 md:px-8 md:py-28">
        <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-full bg-moss-50">
          <CheckCircle2 className="h-7 w-7 text-moss-700" />
        </div>

        <h1 className="mb-4 font-heading text-[36px] font-extrabold leading-[1.1] tracking-[-0.02em] text-ink-900 md:text-[44px]">
          {t("doneTitle")}
        </h1>

        <p className="mb-6 text-[17px] leading-relaxed text-ink-700">
          {t("doneIntro")}
        </p>

        <p className="mb-10 text-[15px] leading-relaxed text-ink-700">
          {t("doneCancelHint")}
        </p>

        <Link
          href="/"
          className="inline-flex items-center justify-center rounded-full bg-ink-900 px-6 py-3 text-[15px] font-semibold text-paper transition-opacity hover:opacity-90"
        >
          {t("doneBackHome")}
        </Link>
      </article>
      <Footer />
    </main>
  );
}
