import { useTranslations } from "next-intl";

/**
 * Shared sports-style "Live" badge — a single translatable source for the dot +
 * label used across the hero, the venue showcase, and the Quick Match board.
 * The pulse honours prefers-reduced-motion (motion-safe). Position/rotation are
 * supplied by the caller via `className`.
 */
export default function LiveBadge({ className = "" }: { className?: string }) {
  const t = useTranslations("common");
  return (
    <div
      className={`rounded-md border border-ink-100 bg-surface px-2 py-1 shadow-[0_6px_16px_-6px_rgba(12,29,19,0.18)] ${className}`}
    >
      <span className="kicker flex items-center gap-1.5 text-moss-800">
        <span className="inline-block h-[6px] w-[6px] rounded-full bg-clay-500 motion-safe:animate-pulse" />
        {t("live")}
      </span>
    </div>
  );
}
