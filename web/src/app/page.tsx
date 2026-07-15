"use client";

import { useEffect } from "react";
import { routing } from "@/i18n/routing";

// Root redirect: middleware handles this in dev, but static export needs an HTML
// page that bounces visitors to the default locale.
export default function RootPage() {
  useEffect(() => {
    const preferred = navigator.language?.toLowerCase().startsWith("en")
      ? "en"
      : routing.defaultLocale;
    window.location.replace(`./${preferred}/`);
  }, []);

  return (
    <div
      style={{
        fontFamily: "system-ui, sans-serif",
        padding: "40px",
        color: "#0f1d13",
      }}
    >
      Redirecting to TTPortal…
    </div>
  );
}
