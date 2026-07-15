import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  locales: ["en", "ro"],
  defaultLocale: "ro",
});

export type Locale = (typeof routing.locales)[number];
