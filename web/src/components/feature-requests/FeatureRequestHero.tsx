"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Lightbulb, ArrowBigUp, CircleCheck, LogOut } from "lucide-react";
import { useAuth } from "@/lib/auth-context";

export interface FeatureStats {
  totalFeatures: number;
  totalVotes: number;
  shipped: number;
}

export default function FeatureRequestHero({
  stats,
}: {
  stats: FeatureStats | null;
}) {
  const t = useTranslations("featureRequests");
  const { user, signIn, signUp, signInWithGoogle, signOut } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [status, setStatus] = useState<"idle" | "submitting" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || !password.trim()) return;

    setStatus("submitting");
    setErrorMsg("");

    const { error } =
      mode === "signin"
        ? await signIn(email.trim(), password)
        : await signUp(email.trim(), password);

    if (error) {
      setStatus("error");
      setErrorMsg(error);
    } else {
      setStatus("idle");
      setEmail("");
      setPassword("");
    }
  }

  return (
    <section className="relative overflow-hidden bg-[radial-gradient(ellipse_at_top,rgba(217,235,224,0.7)_0%,var(--color-paper)_55%)] px-6 pb-16 pt-16 md:px-20 md:pt-20">
      <div className="mx-auto flex max-w-[720px] flex-col items-center gap-7 text-center">
        <span className="kicker flex items-center gap-2 rounded-full border border-clay-200/70 bg-clay-50 px-4 py-1.5 text-clay-700">
          <span className="inline-block h-[6px] w-[6px] animate-pulse rounded-full bg-clay-500" />
          {t("badge")}
        </span>

        <h1 className="font-heading text-[44px] font-extrabold leading-[1.02] tracking-[-0.035em] text-ink-900 md:text-[68px]">
          {t("titleLine1")}
          <br />
          <span className="relative inline-block">
            {t("titleLine2")}
            <span
              aria-hidden
              className="absolute -bottom-1 left-0 h-[5px] w-full rounded-sm bg-clay-500/80"
              style={{ transform: "skewX(-8deg)" }}
            />
          </span>
        </h1>

        <p className="max-w-[560px] text-[17px] leading-relaxed text-ink-600">
          {t("subtitle")}
        </p>
      </div>

      {/* Auth card */}
      <div className="card-tactile mx-auto mt-10 flex w-full max-w-[460px] flex-col gap-5 p-8">
        {user ? (
          <>
            <p className="text-center text-[14px] text-ink-600">
              {t("signedInAs")}{" "}
              <span className="font-semibold text-ink-900">{user.email}</span>
            </p>
            <button
              onClick={signOut}
              className="mx-auto flex items-center gap-2 text-[14px] text-ink-600 transition-colors hover:text-ink-900"
            >
              <LogOut className="h-4 w-4" />
              {t("signOutBtn")}
            </button>
          </>
        ) : (
          <>
            <h2 className="text-center font-heading text-[21px] font-bold tracking-tight text-ink-900">
              {mode === "signin" ? t("signInTitle") : t("signUpTitle")}
            </h2>
            <p className="-mt-2 text-center text-[13.5px] text-ink-500">
              {mode === "signin"
                ? t("signInDescription")
                : t("signUpDescription")}
            </p>
            <form
              onSubmit={handleSubmit}
              className="flex w-full flex-col gap-3"
            >
              <input
                type="email"
                placeholder={t("emailPlaceholder")}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="h-12 rounded-xl border border-ink-200 bg-paper px-4 text-[14px] text-ink-900 placeholder:text-ink-400 transition focus:border-moss-500 focus:outline-none focus:ring-4 focus:ring-moss-500/15"
              />
              <input
                type="password"
                placeholder={t("passwordPlaceholder")}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                className="h-12 rounded-xl border border-ink-200 bg-paper px-4 text-[14px] text-ink-900 placeholder:text-ink-400 transition focus:border-moss-500 focus:outline-none focus:ring-4 focus:ring-moss-500/15"
              />
              <button
                type="submit"
                disabled={status === "submitting"}
                className="btn-moss h-12 rounded-xl text-[14px] font-semibold disabled:opacity-50"
              >
                {status === "submitting"
                  ? "..."
                  : mode === "signin"
                    ? t("signIn")
                    : t("signUpBtn")}
              </button>
            </form>
            {status === "error" && (
              <p className="text-center text-[13px] text-clay-700">
                {errorMsg}
              </p>
            )}
            <div className="flex w-full items-center gap-3">
              <div className="h-px flex-1 bg-ink-100" />
              <span className="text-[11px] uppercase tracking-wider text-ink-400">
                {t("or")}
              </span>
              <div className="h-px flex-1 bg-ink-100" />
            </div>
            <button
              onClick={signInWithGoogle}
              className="flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-ink-200 bg-surface text-[14px] font-medium text-ink-900 transition-colors hover:bg-ink-50"
            >
              <svg className="h-5 w-5" viewBox="0 0 24 24">
                <path
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
                  fill="#4285F4"
                />
                <path
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  fill="#34A853"
                />
                <path
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  fill="#FBBC05"
                />
                <path
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  fill="#EA4335"
                />
              </svg>
              {t("continueWithGoogle")}
            </button>
            <button
              onClick={() => {
                setMode(mode === "signin" ? "signup" : "signin");
                setStatus("idle");
                setErrorMsg("");
              }}
              className="text-center text-[13px] font-semibold text-moss-700 hover:text-moss-900 hover:underline"
            >
              {mode === "signin" ? t("switchToSignUp") : t("switchToSignIn")}
            </button>
          </>
        )}
      </div>

      {/* Scoreboard-style stat strip */}
      {stats && stats.totalFeatures > 0 && (
        <div className="mx-auto mt-10 flex max-w-[620px] items-stretch justify-center divide-x divide-ink-200/70 overflow-hidden rounded-2xl border border-ink-100 bg-surface shadow-[0_8px_24px_-12px_rgba(12,29,19,0.08)]">
          <div className="flex flex-1 flex-col items-center gap-1 px-6 py-5">
            <Lightbulb className="h-4 w-4 text-moss-700" />
            <span className="font-heading text-[24px] font-extrabold tabular-nums leading-none text-ink-900">
              {stats.totalFeatures}
            </span>
            <span className="kicker text-ink-500">requested</span>
          </div>
          <div className="flex flex-1 flex-col items-center gap-1 px-6 py-5">
            <ArrowBigUp className="h-4 w-4 text-clay-600" />
            <span className="font-heading text-[24px] font-extrabold tabular-nums leading-none text-ink-900">
              {stats.totalVotes.toLocaleString()}
            </span>
            <span className="kicker text-ink-500">votes</span>
          </div>
          {stats.shipped > 0 && (
            <div className="flex flex-1 flex-col items-center gap-1 px-6 py-5">
              <CircleCheck className="h-4 w-4 text-moss-600" />
              <span className="font-heading text-[24px] font-extrabold tabular-nums leading-none text-ink-900">
                {stats.shipped}
              </span>
              <span className="kicker text-ink-500">shipped</span>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
