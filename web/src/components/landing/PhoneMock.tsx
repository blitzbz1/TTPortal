import Image from "next/image";
import { ImageIcon } from "lucide-react";
import { asset } from "@/lib/asset";

/**
 * Real in-app screenshots that exist today, keyed by a stable slot name.
 *
 * To add a new screenshot: drop the file into `web/public/screenshots/` and add
 * one line below mapping its slot → path. Any slot NOT listed here renders a
 * dark, app-matched placeholder (so the page never shows a broken image and the
 * swap-in is seamless once the real shot lands).
 */
const SCREENSHOTS: Record<string, string> = {
  map: "/screenshots/harta.png",
  checkin: "/screenshots/locatie.png",
  events: "/screenshots/evenimente.png",
  challenges: "/screenshots/provocari.png",
  equipment: "/screenshots/echipament.png",
  players: "/screenshots/amatur.png",
  // --- New features (captured from the app on iOS sim) ---
  // Feature 02 (venue weather + busyness) is rendered by VenueShowcase, not here.
  "ladder-rating": "/screenshots/ladder-rating.png", // Feature 04 — matches, Elo rating, ladder
  "find-players": "/screenshots/find-players.png", // Feature 05 — find players / open play
  "tt-wrapped-story": "/screenshots/tt-wrapped-story.png", // TT Wrapped story
};

type Variant = "hero" | "feature";

const DIMS: Record<Variant, { frame: string; pad: string; outer: string; inner: string }> = {
  hero: {
    frame: "h-[640px] w-[320px] rounded-[42px]",
    pad: "p-[9px]",
    outer: "rounded-[42px]",
    inner: "rounded-[34px]",
  },
  feature: {
    frame: "h-[546px] w-[280px] rounded-[34px]",
    pad: "p-[8px]",
    outer: "rounded-[34px]",
    inner: "rounded-[27px]",
  },
};

/**
 * Device mockup that renders a real screenshot when one exists for `slot`,
 * otherwise a tasteful dark placeholder that mirrors the app's dark UI
 * (status bar + tab bar chrome) so it reads as intentional, not missing.
 */
export default function PhoneMock({
  slot,
  alt,
  label,
  variant = "feature",
  priority = false,
}: {
  slot: string;
  alt: string;
  /** Human label shown on the placeholder (defaults to alt). */
  label?: string;
  variant?: Variant;
  priority?: boolean;
}) {
  const src = SCREENSHOTS[slot];
  const d = DIMS[variant];
  const isHero = variant === "hero";

  return (
    <div className="relative shrink-0 self-center">
      {/* Glow plate behind the device */}
      <div
        aria-hidden
        className={`absolute -z-10 bg-gradient-to-br from-moss-100/70 via-paper to-clay-100/50 blur-2xl ${
          isHero ? "-inset-8 rounded-[56px]" : "-inset-6 rounded-[44px]"
        }`}
      />

      <div
        className={`relative ${d.frame} bg-ink-900 ${d.pad} shadow-[0_30px_80px_-20px_rgba(12,29,19,0.4),0_8px_30px_-10px_rgba(194,65,12,0.12)]`}
      >
        {isHero && (
          <div className="absolute left-1/2 top-[14px] z-10 h-[22px] w-[110px] -translate-x-1/2 rounded-full bg-ink-900" />
        )}

        <div className={`relative h-full w-full overflow-hidden bg-ink-900 ${d.inner}`}>
          {src ? (
            <Image
              src={asset(src)}
              alt={alt}
              fill
              sizes={isHero ? "320px" : "280px"}
              className="object-contain"
              priority={priority}
            />
          ) : (
            <ScreenshotPlaceholder slot={slot} label={label ?? alt} />
          )}
        </div>
      </div>
    </div>
  );
}

/** Dark placeholder that mirrors the app chrome (status bar + tab bar). */
function ScreenshotPlaceholder({ slot, label }: { slot: string; label: string }) {
  return (
    <div className="flex h-full w-full flex-col bg-gradient-to-b from-moss-950 to-ink-900 text-ink-300">
      {/* faux status bar */}
      <div className="flex items-center justify-between px-5 pt-4 text-[11px] font-semibold text-ink-200/70">
        <span className="tabular-nums">9:41</span>
        <span className="flex items-center gap-1">
          <span className="h-[7px] w-[7px] rounded-full bg-ink-300/40" />
          <span className="h-[9px] w-[9px] rounded-full bg-ink-300/40" />
          <span className="inline-block h-[10px] w-[18px] rounded-[3px] border border-ink-300/40" />
        </span>
      </div>

      {/* centred placeholder marker */}
      <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
        <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-moss-900/70 text-moss-300 ring-1 ring-inset ring-moss-700/50">
          <ImageIcon className="h-7 w-7" strokeWidth={1.6} />
        </span>
        <span className="kicker text-clay-300">Screenshot</span>
        <span className="font-heading text-[17px] font-bold leading-snug text-ink-100">
          {label}
        </span>
        <span className="rounded-md bg-ink-900/60 px-2 py-1 font-mono text-[10.5px] text-ink-400 ring-1 ring-inset ring-ink-700/60">
          /screenshots/{slot}.png
        </span>
      </div>

      {/* faux tab bar */}
      <div className="flex items-center justify-around border-t border-ink-800/80 px-4 pb-6 pt-3">
        {[0, 1, 2, 3].map((i) => (
          <span
            key={i}
            className={`h-1.5 w-1.5 rounded-full ${i === 2 ? "bg-moss-400" : "bg-ink-600"}`}
          />
        ))}
      </div>
    </div>
  );
}
