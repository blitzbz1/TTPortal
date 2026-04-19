import { useTranslations } from "next-intl";

export default function HowItWorks() {
  const t = useTranslations("howItWorks");

  return (
    <section
      id="how-it-works"
      className="relative bg-surface px-6 py-28 md:px-20"
    >
      <div className="mx-auto flex max-w-[820px] flex-col items-center gap-4 pb-16 text-center">
        <span className="kicker flex items-center gap-2 text-clay-700">
          <span className="inline-block h-[6px] w-[6px] rounded-full bg-clay-500" />
          {t("label")}
        </span>
        <h2 className="font-heading text-[36px] font-extrabold leading-[1.08] tracking-[-0.025em] text-ink-900 md:text-[48px]">
          {t("title")}
        </h2>
        <p className="text-[17px] leading-relaxed text-ink-600">
          {t("description")}
        </p>
      </div>

      <div className="relative mx-auto max-w-[1100px]">
        {/* connector line between steps */}
        <div
          aria-hidden
          className="trajectory absolute left-[16.66%] right-[16.66%] top-[48px] -z-0 hidden h-[14px] md:block"
        />

        <div className="relative z-10 grid grid-cols-1 gap-6 md:grid-cols-3">
          {[1, 2, 3].map((num) => (
            <div
              key={num}
              className="relative flex flex-col items-center gap-5 rounded-[24px] bg-gradient-to-b from-moss-50 to-surface p-8 text-center ring-1 ring-inset ring-moss-100"
            >
              {/* Numeral in a beveled moss disc */}
              <div className="relative flex h-[88px] w-[88px] items-center justify-center">
                <span className="absolute inset-0 rounded-full bg-gradient-to-br from-moss-700 to-moss-900 shadow-[inset_0_1px_0_rgba(255,255,255,0.18),0_12px_28px_-10px_rgba(20,83,45,0.45)]" />
                <span className="relative font-heading text-[32px] font-bold text-paper">
                  0{num}
                </span>
                {/* tiny clay ball notch */}
                <span className="absolute -right-1 -top-1 h-3 w-3 rounded-full bg-clay-500 ring-[3px] ring-surface" />
              </div>
              <h3 className="font-heading text-[21px] font-bold tracking-tight text-ink-900">
                {t(`step${num}Title`)}
              </h3>
              <p className="max-w-[260px] text-[14.5px] leading-relaxed text-ink-600">
                {t(`step${num}Description`)}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
