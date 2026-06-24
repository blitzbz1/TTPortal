import Image from "next/image";
import { useTranslations } from "next-intl";
import { CalendarDays, Backpack, Trophy, Radio, Swords } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { asset } from "@/lib/asset";

/** Two media cards anchored by a real in-app screenshot. */
const mediaCards: { icon: LucideIcon; img: string; titleKey: string; descKey: string }[] = [
  {
    icon: CalendarDays,
    img: "/screenshots/evenimente.png",
    titleKey: "eventsTitle",
    descKey: "eventsDesc",
  },
  {
    icon: Backpack,
    img: "/screenshots/echipament.png",
    titleKey: "equipmentTitle",
    descKey: "equipmentDesc",
  },
];

/** Compact "mode" cards for the competitive/social play surfaces. */
// Quick Match has its own dedicated section (see QuickMatch.tsx), so it is not
// repeated here.
const modeCards: { icon: LucideIcon; titleKey: string; descKey: string }[] = [
  { icon: Trophy, titleKey: "tournamentsTitle", descKey: "tournamentsDesc" },
  { icon: Radio, titleKey: "openPlayTitle", descKey: "openPlayDesc" },
  { icon: Swords, titleKey: "rivalsTitle", descKey: "rivalsDesc" },
];

export default function WaysToPlay() {
  const t = useTranslations("waysToPlay");

  return (
    <section className="bg-gradient-to-b from-surface via-paper to-moss-50/40 px-6 py-28 md:px-20">
      <div className="mx-auto flex max-w-[820px] flex-col items-center gap-5 pb-16 text-center">
        <span className="kicker flex items-center gap-2 text-clay-700">
          <span className="inline-block h-[6px] w-[6px] rounded-full bg-clay-500" />
          {t("label")}
        </span>
        <h2 className="font-heading text-[36px] font-extrabold leading-[1.06] tracking-[-0.028em] text-ink-900 md:text-[48px]">
          {t("title")}
          <br />
          {t("titleLine2")}
        </h2>
        <p className="max-w-[560px] text-[17px] leading-relaxed text-ink-600">
          {t("description")}
        </p>
      </div>

      <div className="mx-auto flex max-w-[1180px] flex-col gap-5">
        {/* Two screenshot-anchored cards */}
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          {mediaCards.map((card) => (
            <div
              key={card.titleKey}
              className="card-tactile group flex flex-col overflow-hidden"
            >
              <div className="relative h-[210px] w-full overflow-hidden bg-ink-900">
                <Image
                  src={asset(card.img)}
                  alt={t(card.titleKey)}
                  fill
                  sizes="(min-width: 768px) 560px, 100vw"
                  className="object-cover object-top transition-transform duration-500 group-hover:scale-[1.03]"
                />
                <div
                  aria-hidden
                  className="absolute inset-0 bg-gradient-to-t from-ink-900/75 via-ink-900/10 to-transparent"
                />
                <div className="absolute left-5 top-5 flex h-11 w-11 items-center justify-center rounded-xl bg-surface/90 text-moss-800 ring-1 ring-inset ring-moss-200/60 backdrop-blur">
                  <card.icon className="h-[21px] w-[21px]" strokeWidth={1.8} />
                </div>
              </div>
              <div className="flex flex-col gap-2 p-7">
                <h3 className="font-heading text-[20px] font-bold tracking-tight text-ink-900">
                  {t(card.titleKey)}
                </h3>
                <p className="text-[14.5px] leading-relaxed text-ink-600">
                  {t(card.descKey)}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Compact mode cards */}
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
          {modeCards.map((card) => (
            <div
              key={card.titleKey}
              className="card-tactile group flex flex-col gap-4 p-7 transition-transform hover:-translate-y-[2px]"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-clay-50 to-moss-50 text-clay-700 ring-1 ring-inset ring-clay-100">
                <card.icon className="h-[22px] w-[22px]" strokeWidth={1.8} />
              </div>
              <h3 className="font-heading text-[18px] font-bold tracking-tight text-ink-900">
                {t(card.titleKey)}
              </h3>
              <p className="text-[14px] leading-relaxed text-ink-600">
                {t(card.descKey)}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
