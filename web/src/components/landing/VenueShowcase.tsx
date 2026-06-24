import Image from "next/image";
import { asset } from "@/lib/asset";
import LiveBadge from "@/components/landing/LiveBadge";

/**
 * Feature 02 visual — the redesigned, weather-first venue screen in front, with
 * the live "right now" busyness screen fanned behind it (its busyness band peeks
 * above the front device). Two real screens from venue detail in one frame:
 * weather playability + live busyness. The device frames share the screenshot's
 * aspect ratio so each screen fills edge-to-edge with no letterboxing.
 */
function Device({
  src,
  alt,
  className = "",
  priority = false,
}: {
  src: string;
  alt: string;
  className?: string;
  priority?: boolean;
}) {
  return (
    <div
      className={`rounded-[30px] bg-ink-900 p-[7px] shadow-[0_30px_80px_-20px_rgba(12,29,19,0.4),0_8px_30px_-10px_rgba(194,65,12,0.12)] ${className}`}
    >
      <div className="relative aspect-[1179/2556] w-full overflow-hidden rounded-[24px] bg-ink-900">
        <Image
          src={asset(src)}
          alt={alt}
          fill
          sizes="240px"
          className="object-cover"
          priority={priority}
        />
      </div>
    </div>
  );
}

export default function VenueShowcase({
  weatherAlt,
  busynessAlt,
}: {
  weatherAlt: string;
  busynessAlt: string;
}) {
  return (
    <div className="relative shrink-0 self-center">
      {/* shared glow plate behind both devices */}
      <div
        aria-hidden
        className="absolute -inset-6 -z-10 rounded-[44px] bg-gradient-to-br from-moss-100/70 via-paper to-clay-100/50 blur-2xl"
      />

      <div className="relative h-[548px] w-[min(300px,calc(100vw-3rem))] sm:w-[346px]">
        {/* back — live busyness, fanned up and to the right */}
        <Device
          src="/screenshots/venue-busyness.png"
          alt={busynessAlt}
          className="absolute right-0 top-0 w-[210px] rotate-[6deg]"
        />
        {/* "Live" badge pinned to the busyness device */}
        <LiveBadge className="absolute right-2 top-2 z-20 rotate-[6deg]" />

        {/* front — weather-first hero */}
        <Device
          src="/screenshots/venue-weather.png"
          alt={weatherAlt}
          priority
          className="absolute bottom-0 left-0 z-10 w-[244px] -rotate-[2deg]"
        />
      </div>
    </div>
  );
}
