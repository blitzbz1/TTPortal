"use client";

import { useState, useCallback } from "react";
import { useTranslations, useLocale } from "next-intl";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/lib/supabase";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Link } from "@/i18n/navigation";
import { AlertTriangle, Clock, ArrowLeft } from "lucide-react";

const CONFIRM_WORD = "DELETE";

export default function DeleteAccountPage() {
  const t = useTranslations("deleteAccountWeb");
  const locale = useLocale();
  const { user, loading: authLoading, signOut } = useAuth();
  const router = useRouter();

  const [confirmation, setConfirmation] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isReady = confirmation.trim().toUpperCase() === CONFIRM_WORD;

  const handleDelete = useCallback(async () => {
    if (!isReady || submitting) return;
    setSubmitting(true);
    setError(null);

    const { error: rpcError } = await supabase.rpc("request_account_deletion");
    if (rpcError) {
      setError(t("error"));
      setSubmitting(false);
      return;
    }

    await signOut();
    router.replace(`/${locale}/account/delete/done`);
  }, [isReady, submitting, signOut, router, locale, t]);

  const bullets: string[] = [
    "whatProfile",
    "whatReviews",
    "whatCheckins",
    "whatEvents",
    "whatFriends",
    "whatPhotos",
  ];

  return (
    <main className="bg-paper text-ink-900">
      <Header />
      <article className="mx-auto max-w-[640px] px-6 py-20 md:px-8 md:py-24">
        <Link
          href="/"
          className="mb-8 inline-flex items-center gap-2 text-[14px] text-ink-500 transition-colors hover:text-ink-900"
        >
          <ArrowLeft className="h-4 w-4" />
          {t("backHome")}
        </Link>

        <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-full bg-red-50">
          <AlertTriangle className="h-7 w-7 text-red-600" />
        </div>

        <h1 className="mb-4 font-heading text-[36px] font-extrabold leading-[1.1] tracking-[-0.02em] text-ink-900 md:text-[44px]">
          {t("title")}
        </h1>

        <p className="mb-10 text-[17px] leading-relaxed text-ink-700">
          {t("intro")}
        </p>

        {authLoading ? (
          <p className="text-ink-500">{t("checkingAuth")}</p>
        ) : !user ? (
          <SignInPrompt locale={locale} />
        ) : (
          <>
            <section className="mb-8 rounded-2xl border border-ink-100 bg-surface p-6">
              <h2 className="kicker mb-4 text-ink-500">{t("whatHeader")}</h2>
              <ul className="flex flex-col gap-3">
                {bullets.map((key) => (
                  <li
                    key={key}
                    className="flex items-start gap-3 text-[15px] text-ink-700"
                  >
                    <span className="mt-2 inline-block h-1.5 w-1.5 flex-shrink-0 rounded-full bg-ink-400" />
                    {t(key)}
                  </li>
                ))}
              </ul>
            </section>

            <section className="mb-8 flex items-start gap-3 rounded-2xl bg-ink-50 p-5">
              <Clock className="mt-0.5 h-5 w-5 flex-shrink-0 text-ink-500" />
              <p className="text-[14px] leading-relaxed text-ink-700">
                {t("gracePeriod")}
              </p>
            </section>

            <div className="mb-6">
              <label
                htmlFor="confirm"
                className="mb-2 block text-[13px] font-semibold uppercase tracking-wider text-ink-500"
              >
                {t("confirmLabel")}
              </label>
              <input
                id="confirm"
                type="text"
                value={confirmation}
                onChange={(e) => setConfirmation(e.target.value)}
                placeholder={CONFIRM_WORD}
                autoComplete="off"
                spellCheck={false}
                className="w-full rounded-xl border border-ink-200 bg-surface px-4 py-3 font-mono text-[16px] tracking-[2px] text-ink-900 outline-none focus:border-ink-900"
              />
            </div>

            {error && (
              <p className="mb-4 text-[14px] text-red-600" role="alert">
                {error}
              </p>
            )}

            <button
              type="button"
              onClick={handleDelete}
              disabled={!isReady || submitting}
              className="w-full rounded-xl bg-red-600 px-6 py-4 text-[16px] font-bold text-white transition-opacity hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting ? t("submitting") : t("submitButton")}
            </button>

            <Link
              href="/"
              className="mt-3 block py-3 text-center text-[14px] text-ink-500 transition-colors hover:text-ink-900"
            >
              {t("cancel")}
            </Link>
          </>
        )}
      </article>
      <Footer />
    </main>
  );
}

function SignInPrompt({ locale }: { locale: string }) {
  const t = useTranslations("deleteAccountWeb");
  return (
    <section className="rounded-2xl border border-ink-100 bg-surface p-8">
      <h2 className="mb-3 font-heading text-[20px] font-bold text-ink-900">
        {t("signInRequiredTitle")}
      </h2>
      <p className="mb-6 text-[15px] leading-relaxed text-ink-700">
        {t("signInRequiredBody")}
      </p>
      <Link
        href={`/${locale}/feature-requests` as any}
        className="inline-flex items-center justify-center rounded-full bg-ink-900 px-6 py-3 text-[15px] font-semibold text-paper transition-opacity hover:opacity-90"
      >
        {t("signInButton")}
      </Link>
    </section>
  );
}
