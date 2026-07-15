"use client";

import { useEffect, useState } from "react";
import type { CSSProperties } from "react";
import { useTranslations } from "next-intl";
import { Sparkles, Clock, MapPin, Users, Flame, Share2 } from "lucide-react";
import type { LucideIcon } from "lucide-react";

/** ms each story card is shown before auto-advancing. */
const DURATION = 3400;

type Accent = "clay" | "moss";
type Card = {
  key: string;
  icon: LucideIcon;
  accent: Accent;
  value: string;
  big: boolean;
  labelKey: string;
  subKey?: string;
};

// Mirrors the app's TT Wrapped deck (same data as the captured screenshot).
const CARDS: Card[] = [
  { key: "year", icon: Sparkles, accent: "clay", value: "2026", big: true, labelKey: "s1Label" },
  { key: "hours", icon: Clock, accent: "clay", value: "87", big: true, labelKey: "s2Label", subKey: "s2Sub" },
  { key: "venue", icon: MapPin, accent: "moss", value: "Sala Olimpia", big: false, labelKey: "s3Label", subKey: "s3Sub" },
  { key: "partner", icon: Users, accent: "moss", value: "Andrei Popescu", big: false, labelKey: "s4Label", subKey: "s4Sub" },
  { key: "type", icon: Flame, accent: "clay", value: "Grinder", big: false, labelKey: "s5Label", subKey: "s5Sub" },
];

const ACCENT: Record<Accent, { disc: string; value: string; glow: string; sheen: string }> = {
  clay: {
    disc: "from-clay-500/35 to-clay-700/5 text-clay-300 ring-clay-500/30",
    value: "text-clay-200",
    glow: "rgba(216,85,42,0.5)",
    sheen: "linear-gradient(100deg, var(--color-clay-300) 0%, #ffffff 45%, var(--color-clay-200) 62%, var(--color-clay-300) 100%)",
  },
  moss: {
    disc: "from-moss-400/35 to-moss-800/5 text-moss-200 ring-moss-400/30",
    value: "text-moss-100",
    glow: "rgba(86,156,120,0.5)",
    sheen: "linear-gradient(100deg, var(--color-moss-300) 0%, #ffffff 45%, var(--color-moss-100) 62%, var(--color-moss-300) 100%)",
  },
};

const CONFETTI: { x: string; c: string; d: string; delay: string }[] = [
  { x: "12%", c: "var(--color-clay-400)", d: "5.2s", delay: "0s" },
  { x: "24%", c: "var(--color-moss-300)", d: "6.1s", delay: "1.1s" },
  { x: "38%", c: "var(--color-clay-300)", d: "4.7s", delay: "2.3s" },
  { x: "52%", c: "var(--color-moss-400)", d: "6.6s", delay: "0.6s" },
  { x: "64%", c: "var(--color-clay-500)", d: "5.5s", delay: "3.1s" },
  { x: "76%", c: "var(--color-moss-200)", d: "5.0s", delay: "1.8s" },
  { x: "88%", c: "var(--color-clay-300)", d: "6.3s", delay: "2.7s" },
  { x: "46%", c: "var(--color-clay-400)", d: "6.9s", delay: "4.2s" },
];

/** allow CSS custom properties in inline style objects */
const v = (o: Record<string, string | number>): CSSProperties => o as CSSProperties;

function useReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const on = () => setReduced(mq.matches);
    mq.addEventListener?.("change", on);
    return () => mq.removeEventListener?.("change", on);
  }, []);
  return reduced;
}

/** Counts 0 → target with an ease-out cubic; runs once on mount. */
function CountUp({ target }: { target: number }) {
  const [n, setN] = useState(0);
  useEffect(() => {
    let raf = 0;
    let startTs = 0;
    const tick = (ts: number) => {
      if (!startTs) startTs = ts;
      const p = Math.min(1, (ts - startTs) / 950);
      setN(Math.round(target * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target]);
  return <>{n}</>;
}

/**
 * Auto-playing "TT Wrapped" story inside a phone frame — a rotating gradient
 * glow ring, falling confetti, story progress bars, a shimmering counter,
 * a breathing icon and a gentle float. Loops through the deck; honours
 * prefers-reduced-motion (static first card).
 */
export default function WrappedStory() {
  const t = useTranslations("wrapped");
  const reduced = useReducedMotion();
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (reduced) return;
    const id = setTimeout(() => setIndex((i) => (i + 1) % CARDS.length), DURATION);
    return () => clearTimeout(id);
  }, [index, reduced]);

  const card = CARDS[index];
  const accent = ACCENT[card.accent];
  const Icon = card.icon;
  const countUp = card.key === "hours" && !reduced;

  return (
    <div className="relative shrink-0 self-center">
      {/* soft glow plate */}
      <div
        aria-hidden
        className="absolute -inset-8 -z-10 rounded-[56px] bg-gradient-to-br from-clay-500/20 via-transparent to-moss-500/20 blur-2xl"
      />
      {/* rotating gradient glow ring */}
      <div
        aria-hidden
        className="wrapped-spin absolute -inset-[14px] -z-10 rounded-[56px] opacity-80 blur-xl"
        style={{
          background:
            "conic-gradient(from 0deg, rgba(216,85,42,0), rgba(216,85,42,0.55), rgba(86,156,120,0.5), rgba(216,85,42,0.15), rgba(216,85,42,0))",
        }}
      />

      <div
        className={`relative h-[560px] w-[286px] rounded-[42px] bg-ink-900 p-[9px] shadow-[0_30px_80px_-20px_rgba(0,0,0,0.55),0_8px_30px_-10px_rgba(194,65,12,0.2)] ring-1 ring-white/5 ${
          reduced ? "" : "wrapped-float"
        }`}
      >
        <div className="absolute left-1/2 top-[15px] z-20 h-[20px] w-[96px] -translate-x-1/2 rounded-full bg-black/85" />

        <div className="relative flex h-full w-full flex-col overflow-hidden rounded-[34px] bg-gradient-to-b from-moss-950 to-ink-900">
          {/* drifting blooms */}
          <div
            aria-hidden
            className="wrapped-drift pointer-events-none absolute -right-16 -top-12 h-60 w-60 rounded-full bg-[radial-gradient(circle,rgba(216,85,42,0.30),transparent_70%)] blur-2xl"
          />
          <div
            aria-hidden
            className="wrapped-drift pointer-events-none absolute -bottom-16 -left-12 h-52 w-52 rounded-full bg-[radial-gradient(circle,rgba(56,128,101,0.28),transparent_70%)] blur-2xl"
          />

          {/* confetti */}
          <div aria-hidden className="pointer-events-none absolute inset-0 z-[1] overflow-hidden">
            {CONFETTI.map((p, i) => (
              <span
                key={i}
                className="wrapped-confetti absolute top-0 h-[9px] w-[5px] rounded-[1px]"
                style={v({ left: p.x, background: p.c, "--d": p.d, "--delay": p.delay })}
              />
            ))}
          </div>

          {/* story progress segments */}
          <div className="relative z-10 flex gap-1.5 px-5 pt-9">
            {CARDS.map((c, i) => (
              <span key={c.key} className="h-[3px] flex-1 overflow-hidden rounded-full bg-white/15">
                <span
                  className="block h-full rounded-full bg-white/90"
                  style={
                    i < index
                      ? { width: "100%" }
                      : i === index
                        ? reduced
                          ? { width: "100%" }
                          : { width: "0%", animation: `wrapped-seg-fill ${DURATION}ms linear forwards` }
                        : { width: "0%" }
                  }
                />
              </span>
            ))}
          </div>

          {/* kicker */}
          <div className="relative z-10 flex items-center gap-2 px-5 pt-4">
            <span className="h-2 w-2 animate-pulse rounded-full bg-clay-400" />
            <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-moss-200">
              {t("storyKicker")}
            </span>
          </div>

          {/* card block — entrance lives here so children run their own effects */}
          <div
            key={index}
            className={`relative z-10 flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center ${
              reduced ? "" : "wrapped-card-in"
            }`}
          >
            <span
              className={`wrapped-glow flex h-[72px] w-[72px] items-center justify-center rounded-[20px] bg-gradient-to-br ${accent.disc} ring-1 ring-inset`}
              style={v({ "--wglow": accent.glow })}
            >
              <Icon className="h-8 w-8" strokeWidth={1.7} />
            </span>

            {card.big ? (
              <span
                className="wrapped-sheen font-heading text-[54px] font-extrabold leading-none tracking-tight"
                style={{ backgroundImage: accent.sheen }}
              >
                {countUp ? <CountUp target={87} /> : card.value}
              </span>
            ) : (
              <span
                className={`font-heading max-w-[230px] text-[27px] font-extrabold leading-tight tracking-tight ${accent.value}`}
              >
                {card.value}
              </span>
            )}

            <span className="text-[17px] font-bold text-paper">{t(card.labelKey)}</span>
            {card.subKey && (
              <span className="max-w-[215px] text-[13px] leading-snug text-moss-200/80">
                {t(card.subKey)}
              </span>
            )}
          </div>

          {/* share pill (decorative) */}
          <div className="relative z-10 px-5 pb-7">
            <div className="flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-moss-600 to-moss-700 py-3 text-[14px] font-semibold text-white shadow-[0_8px_24px_-8px_rgba(20,83,45,0.6)]">
              <Share2 className="h-4 w-4" />
              {t("storyShare")}
            </div>
          </div>
        </div>

        {/* floating "Wrapped" badge */}
        <div className="absolute -left-3 top-28 -rotate-6 rounded-md border border-white/10 bg-ink-900/90 px-2 py-1 shadow-lg backdrop-blur">
          <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-moss-200">
            <span className="inline-block h-[6px] w-[6px] rounded-full bg-clay-400" />
            Wrapped
          </span>
        </div>
      </div>
    </div>
  );
}
