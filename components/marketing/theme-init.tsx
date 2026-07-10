"use client";

import { useEffect } from "react";

// Applies the same theme the app uses (pw-theme in localStorage, else the OS
// preference) to <html> so the marketing page honors a returning visitor's
// choice and system setting. Mirrors the logic in components/pawdex/top-nav.
export function MarketingThemeInit() {
  useEffect(() => {
    const stored = localStorage.getItem("pw-theme") as
      | "light"
      | "dark"
      | null;
    const sysDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const theme = stored ?? (sysDark ? "dark" : "light");
    document.documentElement.classList.toggle("dark", theme === "dark");
    document.documentElement.setAttribute("data-theme", theme);
  }, []);

  return null;
}
