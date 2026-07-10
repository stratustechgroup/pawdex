"use client";

import { useEffect, useState } from "react";

import { Icon } from "@/components/brand/icon";
import { Wordmark } from "@/components/brand/wordmark";

const NAV = [
  { label: "How it works", href: "#how" },
  { label: "Why Pawdex", href: "#why" },
  { label: "FAQ", href: "#faq" },
];

export function SiteHeader() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    const stored = localStorage.getItem("pw-theme") as
      | "light"
      | "dark"
      | null;
    const sysDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    setTheme(stored ?? (sysDark ? "dark" : "light"));

    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  function toggleTheme() {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.classList.toggle("dark", next === "dark");
    document.documentElement.setAttribute("data-theme", next);
    localStorage.setItem("pw-theme", next);
  }

  return (
    <header
      style={{
        position: "sticky",
        top: 0,
        zIndex: 50,
        borderBottom: scrolled
          ? "1px solid var(--pw-border)"
          : "1px solid transparent",
        background: scrolled
          ? "color-mix(in oklab, var(--pw-bg) 82%, transparent)"
          : "transparent",
        backdropFilter: scrolled ? "saturate(180%) blur(12px)" : "none",
        transition: "background 0.2s ease, border-color 0.2s ease",
      }}
    >
      <div
        className="mk-container"
        style={{
          height: 64,
          display: "flex",
          alignItems: "center",
          gap: 16,
        }}
      >
        <a href="#top" style={{ textDecoration: "none" }} aria-label="Pawdex home">
          <Wordmark size={22} />
        </a>

        <nav
          className="hidden md:flex"
          style={{ marginLeft: 18, gap: 4, alignItems: "center" }}
        >
          {NAV.map((n) => (
            <a
              key={n.href}
              href={n.href}
              style={{
                padding: "8px 12px",
                borderRadius: 8,
                font: "500 13.5px var(--font-inter)",
                color: "var(--pw-text-secondary)",
                textDecoration: "none",
              }}
            >
              {n.label}
            </a>
          ))}
        </nav>

        <div style={{ flex: 1 }} />

        <button
          type="button"
          onClick={toggleTheme}
          aria-label="Toggle theme"
          style={iconBtn}
        >
          <Icon name={theme === "dark" ? "sun" : "moon"} size={16} />
        </button>

        <a href="#waitlist" className="mk-btn mk-btn-primary hidden sm:inline-flex">
          Join the waitlist
        </a>

        <button
          type="button"
          className="md:hidden"
          onClick={() => setOpen((v) => !v)}
          aria-label="Menu"
          aria-expanded={open}
          style={iconBtn}
        >
          <Icon name={open ? "x" : "menu"} size={18} />
        </button>
      </div>

      {open && (
        <div
          className="md:hidden mk-container"
          style={{
            paddingBottom: 16,
            display: "flex",
            flexDirection: "column",
            gap: 4,
          }}
        >
          {NAV.map((n) => (
            <a
              key={n.href}
              href={n.href}
              onClick={() => setOpen(false)}
              style={{
                padding: "10px 8px",
                borderRadius: 8,
                font: "500 15px var(--font-inter)",
                color: "var(--pw-text)",
                textDecoration: "none",
              }}
            >
              {n.label}
            </a>
          ))}
          <a
            href="#waitlist"
            onClick={() => setOpen(false)}
            className="mk-btn mk-btn-primary"
            style={{ marginTop: 8, alignSelf: "flex-start" }}
          >
            Join the waitlist
          </a>
        </div>
      )}
    </header>
  );
}

const iconBtn: React.CSSProperties = {
  width: 38,
  height: 38,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  borderRadius: 999,
  border: "1px solid var(--pw-border)",
  background: "var(--pw-surface)",
  color: "var(--pw-text-secondary)",
  cursor: "pointer",
  flexShrink: 0,
};
