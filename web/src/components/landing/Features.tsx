import { useTranslations } from "next-intl";
import PhoneMock from "@/components/landing/PhoneMock";
import VenueShowcase from "@/components/landing/VenueShowcase";

/**
 * The curated set of flagship "phone block" features, in narrative order.
 * `slot` maps to a screenshot in PhoneMock — slots without a real screenshot
 * render an app-matched placeholder until one is dropped in.
 */
const FEATURES: { index: number; slot: string }[] = [
  { index: 1, slot: "map" },
  { index: 2, slot: "venue" },
  { index: 3, slot: "checkin" },
  { index: 4, slot: "ladder-rating" },
  { index: 5, slot: "find-players" },
  { index: 6, slot: "challenges" },
];

function FeatureBlock({
  index,
  slot,
  reversed,
}: {
  index: number;
  slot: string;
  reversed: boolean;
}) {
  const t = useTranslations("features");
  const prefix = `feature${index}` as const;

  const bullets = [
    t(`${prefix}Bullet1`),
    t(`${prefix}Bullet2`),
    t(`${prefix}Bullet3`),
  ];

  const textBlock = (
    <div className="relative flex flex-1 flex-col gap-5">
      {/* Large editorial numeral sitting in the whitespace above the block */}
      <span
        aria-hidden
        className="pointer-events-none absolute -left-1 -top-20 font-heading text-[80px] font-bold leading-none tracking-[-0.06em] text-moss-100 md:-top-28 md:text-[112px]"
      >
        {t(`${prefix}Number`)}
      </span>

      <div className="relative flex items-center gap-3 pt-4">
        <span className="h-[2px] w-10 bg-clay-500" />
        <span className="kicker text-clay-700">
          Feature {t(`${prefix}Number`)}
        </span>
      </div>

      <h3 className="font-heading text-[34px] font-extrabold leading-[1.08] tracking-[-0.025em] text-ink-900 md:text-[44px]">
        {t(`${prefix}Title`)}
        <br />
        {t(`${prefix}TitleLine2`)}
      </h3>

      <p className="max-w-[480px] text-[16px] leading-relaxed text-ink-600">
        {t(`${prefix}Description`)}
      </p>

      <ul className="flex flex-col gap-2.5 pt-2">
        {bullets.map((bullet) => (
          <li key={bullet} className="flex items-start gap-3">
            <span className="mt-[7px] inline-block h-[6px] w-[6px] shrink-0 rounded-full bg-moss-500" />
            <span className="text-[14.5px] font-medium leading-relaxed text-ink-800">
              {bullet}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );

  const phoneBlock =
    slot === "venue" ? (
      <VenueShowcase
        weatherAlt={t("feature2AltWeather")}
        busynessAlt={t("feature2AltBusyness")}
      />
    ) : (
      <PhoneMock
        slot={slot}
        variant="feature"
        alt={`${t(`${prefix}Title`)} ${t(`${prefix}TitleLine2`)}`}
        label={t(`${prefix}Title`)}
      />
    );

  return (
    <div className="flex flex-col items-center gap-16 lg:flex-row lg:gap-24">
      {reversed ? (
        <>
          {phoneBlock}
          {textBlock}
        </>
      ) : (
        <>
          {textBlock}
          {phoneBlock}
        </>
      )}
    </div>
  );
}

export default function Features() {
  const t = useTranslations("features");

  return (
    <section
      id="features"
      className="overflow-x-clip bg-surface px-6 py-28 md:px-20"
    >
      <div className="mx-auto flex max-w-[820px] flex-col items-center gap-5 pb-20 text-center">
        <span className="kicker flex items-center gap-2 text-clay-700">
          <span className="inline-block h-[6px] w-[6px] rounded-full bg-clay-500" />
          {t("label")}
        </span>
        <h2 className="font-heading text-[40px] font-extrabold leading-[1.05] tracking-[-0.03em] text-ink-900 md:text-[56px]">
          {t("title")}
          <br />
          {t("titleLine2")}
        </h2>
        <p className="max-w-[580px] text-[17px] leading-relaxed text-ink-600">
          {t("description")}
        </p>
      </div>

      <div className="flex flex-col gap-28">
        {FEATURES.map((feat, idx) => (
          <div key={feat.index} className="flex flex-col gap-24">
            <FeatureBlock
              index={feat.index}
              slot={feat.slot}
              reversed={idx % 2 === 1}
            />
            {idx < FEATURES.length - 1 && (
              <div className="rule-moss mx-auto w-full max-w-[600px]" />
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
