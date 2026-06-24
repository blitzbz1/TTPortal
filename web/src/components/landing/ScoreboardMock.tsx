/**
 * Quick Match — the QR-paired live scoreboard, rebuilt as a landscape device.
 *
 * Mirrors the in-app scoreboard: a split green/clay board, the serving player
 * lit along their edge, a big tappable score on each side, a centre console
 * with the games tally + format, and an undo strip. Everything is sized in
 * container-query units (`cqw`) off the device width, so the whole board scales
 * cleanly from a phone to a wide desktop column with no JS and no layout flash.
 */

type Side = "left" | "right";

function Minus() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.6}
      strokeLinecap="round"
      className="h-[2.1cqw] w-[2.1cqw]"
      aria-hidden
    >
      <path d="M5 12h14" />
    </svg>
  );
}

function Half({
  side,
  name,
  score,
  serving,
  serveLabel,
  undoLabel,
}: {
  side: Side;
  name: string;
  score: string;
  serving?: boolean;
  serveLabel: string;
  undoLabel: string;
}) {
  const isLeft = side === "left";
  const nameColor = isLeft ? "text-moss-300" : "text-clay-300";
  const scoreColor = isLeft ? "text-[#eafff1]" : "text-[#fff1e6]";
  const pipOn = isLeft ? "bg-moss-400" : "bg-clay-400";
  const bg = isLeft
    ? "radial-gradient(120% 80% at 50% 8%, rgba(86,156,120,0.20), transparent 60%), linear-gradient(to bottom, #0f1f15, #0a120d)"
    : "radial-gradient(120% 80% at 50% 8%, rgba(216,85,42,0.18), transparent 60%), linear-gradient(to bottom, #1d130b, #110b07)";
  const servingGlow = serving
    ? isLeft
      ? "inset 0.6cqw 0 0 -0.1cqw var(--color-moss-400)"
      : "inset -0.6cqw 0 0 -0.1cqw var(--color-clay-400)"
    : undefined;

  return (
    <div
      className="relative flex flex-1 flex-col items-center"
      style={{ background: bg, boxShadow: servingGlow }}
    >
      {/* identity */}
      <div className="flex items-center gap-[1.2cqw] pt-[2.6cqw]">
        <span className={`text-[2cqw] font-bold tracking-tight ${nameColor}`}>
          {name}
        </span>
        <span className="flex gap-[0.6cqw]">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className={`h-[0.95cqw] w-[0.95cqw] rounded-full ${
                i === 0 ? pipOn : "bg-white/15"
              }`}
            />
          ))}
        </span>
        {serving && (
          <span
            className={`flex items-center gap-[0.6cqw] text-[1.2cqw] font-extrabold uppercase tracking-[0.16em] ${nameColor}`}
          >
            <span className="h-[0.8cqw] w-[0.8cqw] rounded-full bg-current shadow-[0_0_0_0.35cqw_rgba(255,255,255,0.06)] motion-safe:animate-pulse" />
            {serveLabel}
          </span>
        )}
      </div>

      {/* score (the +1 tap zone) */}
      <div className="flex w-full flex-1 items-center justify-center">
        <span
          className={`font-heading text-[22cqw] font-extrabold leading-[0.82] tracking-[-0.04em] ${scoreColor}`}
        >
          {score}
        </span>
      </div>

      {/* undo (−1) strip */}
      <div className="flex h-[5.8cqw] w-full items-center justify-center gap-[0.9cqw] border-t border-white/[0.07] bg-black/15 text-white/55">
        <Minus />
        <span className="text-[1.22cqw] font-bold uppercase tracking-[0.12em]">
          {undoLabel}
        </span>
      </div>
    </div>
  );
}

export default function ScoreboardMock({
  alt,
  youLabel,
  opponentLabel,
  serveLabel,
  undoLabel,
  gameLabel,
  formatLabel,
}: {
  alt: string;
  youLabel: string;
  opponentLabel: string;
  serveLabel: string;
  undoLabel: string;
  gameLabel: string;
  formatLabel: string;
}) {
  return (
    <div className="relative w-full max-w-[760px] self-center">
      {/* glow plate behind the device */}
      <div
        aria-hidden
        className="absolute -inset-6 -z-10 rounded-[44px] bg-gradient-to-br from-moss-200/60 via-paper to-clay-200/50 blur-2xl"
      />

      {/* container — cqw resolves against this padding-less box. The board is a
          decorative illustration: expose one summary label, hide the fragments. */}
      <div
        role="img"
        aria-label={alt}
        className="relative aspect-[860/412] w-full"
        style={{ containerType: "inline-size" }}
      >
        {/* device frame */}
        <div
          aria-hidden
          className="absolute inset-0 rounded-[5.8cqw] bg-[#101310] p-[1.16cqw] shadow-[0_50px_120px_-30px_rgba(12,29,19,0.6),0_8px_30px_-10px_rgba(194,65,12,0.18)] ring-[1.5px] ring-inset ring-white/[0.05]"
        >
          {/* side dynamic island */}
          <div className="absolute left-[1.6cqw] top-1/2 z-40 h-[12.6cqw] w-[3.5cqw] -translate-y-1/2 rounded-[1.9cqw] bg-black" />

          <div className="relative h-full w-full overflow-hidden rounded-[4.6cqw] border border-white/[0.04] bg-[#0f120f]">
            {/* split board */}
            <div className="absolute inset-0 flex">
              <Half
                side="left"
                name={youLabel}
                score="8"
                serving
                serveLabel={serveLabel}
                undoLabel={undoLabel}
              />
              <Half
                side="right"
                name={opponentLabel}
                score="6"
                serveLabel={serveLabel}
                undoLabel={undoLabel}
              />
            </div>

            {/* centre console */}
            <div className="absolute left-1/2 top-1/2 z-20 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-[0.8cqw] rounded-[2.3cqw] border border-white/10 bg-[#090b09]/85 px-[1.9cqw] py-[1.6cqw] shadow-[0_18px_44px_-16px_rgba(0,0,0,0.85)]">
              <svg
                viewBox="0 0 24 16"
                fill="none"
                stroke="currentColor"
                strokeWidth={2.4}
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-[1.4cqw] w-[2cqw] text-moss-300"
                aria-hidden
              >
                <path d="M10 3 3 8l7 5" />
                <path d="M3 8h13" />
              </svg>
              <div className="flex items-center gap-[1.3cqw] font-heading text-[3cqw] font-extrabold leading-none">
                <span className="text-moss-300">1</span>
                <span className="text-ink-400 font-semibold">–</span>
                <span className="text-clay-300">1</span>
              </div>
              <span className="text-[1.16cqw] font-bold uppercase tracking-[0.16em] text-ink-400">
                {gameLabel}
              </span>
            </div>

            {/* exit (top-left, clear of the island) */}
            <div className="absolute left-[5.6cqw] top-[1.6cqw] z-30 flex h-[3.95cqw] w-[3.95cqw] items-center justify-center rounded-[1.3cqw] border border-white/[0.12] bg-[#0a0c0a]/50 text-white">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2.4}
                strokeLinecap="round"
                className="h-[1.75cqw] w-[1.75cqw]"
                aria-hidden
              >
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
            </div>

            {/* format (top-right) */}
            <span className="absolute right-[2.8cqw] top-[2.6cqw] z-30 text-[1.22cqw] font-extrabold uppercase tracking-[0.16em] text-white/60">
              {formatLabel}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
