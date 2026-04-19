import { useTranslations } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import Header from "@/components/Header";
import Hero from "@/components/landing/Hero";
import Features from "@/components/landing/Features";
import SecondaryFeatures from "@/components/landing/SecondaryFeatures";
import HowItWorks from "@/components/landing/HowItWorks";
import CTASection from "@/components/CTASection";
import Footer from "@/components/Footer";

export default async function LandingPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <LandingContent />;
}

function LandingContent() {
  const t = useTranslations("landingCta");

  return (
    <main>
      <Header />
      <Hero />
      <Features />
      <SecondaryFeatures />
      <HowItWorks />
      <CTASection
        titleLine1={t("title")}
        titleLine2={t("titleLine2")}
        subtitle={t("subtitle")}
      />
      <Footer />
    </main>
  );
}
