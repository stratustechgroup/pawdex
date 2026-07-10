"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import { Icon } from "@/components/brand/icon";
import { PawdexMark } from "@/components/brand/mark";
import {
  HouseholdSwitcher,
  type SwitcherHousehold,
} from "@/components/pawdex/household-switcher";
import { cn } from "@/lib/utils";

type NavLink = { label: string; href: string };

const NAV: NavLink[] = [
  { label: "Pets", href: "/" },
  { label: "Expiring", href: "/expiring" },
  { label: "Vets", href: "/vets" },
  { label: "Insurance", href: "/insurance" },
  { label: "Inbox", href: "/inbox" },
  { label: "Ask", href: "/ask" },
];

// Breeder-only surface. Shown just after Pets, and only when the active
// household is a breeding operation, so personal households stay uncluttered.
const BREEDING_LINK: NavLink = { label: "Breeding", href: "/breeding" };

export function TopNav({
  households,
  userInitials,
  onSignOut,
}: {
  households: SwitcherHousehold[];
  userInitials: string;
  onSignOut: () => void;
}) {
  const pathname = usePathname();
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [menuOpen, setMenuOpen] = useState(false);

  const isBreeder =
    households.find((h) => h.isActive)?.kind === "breeder";
  const navLinks: NavLink[] = isBreeder
    ? [NAV[0], BREEDING_LINK, ...NAV.slice(1)]
    : NAV;

  // Close the mobile menu whenever the route changes, so a tapped link never
  // leaves the panel hanging open over the new page.
  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    const stored =
      typeof window !== "undefined"
        ? (localStorage.getItem("pw-theme") as "light" | "dark" | null)
        : null;
    const sysDark =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches;
    const initial = stored ?? (sysDark ? "dark" : "light");
    setTheme(initial);
    document.documentElement.classList.toggle("dark", initial === "dark");
    document.documentElement.setAttribute("data-theme", initial);
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
        position: "relative",
        height: 56,
        borderBottom: "1px solid var(--pw-border)",
        background: "var(--pw-surface)",
        display: "flex",
        alignItems: "center",
        padding: "0 24px",
        gap: 16,
      }}
    >
      <Link
        href="/"
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          font: "600 15px var(--font-inter)",
          letterSpacing: "-0.01em",
          color: "var(--pw-text)",
          textDecoration: "none",
        }}
      >
        <PawdexMark size={22} color="var(--pw-accent)" />
        <span>Pawdex</span>
      </Link>
      <span
        style={{
          width: 1,
          height: 22,
          background: "var(--pw-border)",
          flexShrink: 0,
        }}
      />
      <HouseholdSwitcher households={households} />
      <nav
        // Display is driven by the `hidden md:flex` classes below (hidden under
        // 768px, flex at md+). An inline `display: flex` here would beat the
        // `.hidden` rule via specificity and pin the nav visible on mobile,
        // overflowing the header, so only non-display props live inline.
        style={{
          gap: 2,
          marginLeft: 8,
        }}
        className="hidden md:flex"
      >
        {navLinks.map((link) => {
          const active =
            link.href === "/"
              ? pathname === "/" || pathname.startsWith("/pets")
              : pathname.startsWith(link.href);
          return (
            <Link
              key={link.href}
              href={link.href}
              style={{
                height: 30,
                padding: "0 10px",
                borderRadius: 6,
                display: "inline-flex",
                alignItems: "center",
                font: "500 13px var(--font-inter)",
                color: active ? "var(--pw-text)" : "var(--pw-text-muted)",
                background: active ? "var(--pw-surface-2)" : "transparent",
                textDecoration: "none",
              }}
            >
              {link.label}
            </Link>
          );
        })}
      </nav>
      <div style={{ flex: 1 }} />
      <button
        type="button"
        // Mobile-only. Display is class-driven ("inline-flex" base, hidden at
        // md+); no inline `display` so `md:hidden` isn't beaten by specificity.
        className="inline-flex md:hidden hover:bg-[var(--pw-surface-2)] hover:text-[var(--pw-text)]"
        onClick={() => setMenuOpen((v) => !v)}
        aria-label="Menu"
        aria-expanded={menuOpen}
        aria-controls="pw-mobile-menu"
        title="Menu"
        style={{
          width: 32,
          height: 32,
          alignItems: "center",
          justifyContent: "center",
          background: "transparent",
          border: 0,
          borderRadius: 6,
          color: "var(--pw-text-secondary)",
          cursor: "pointer",
        }}
      >
        <Icon name={menuOpen ? "x" : "menu"} size={17} />
      </button>
      <IconButton title={theme === "dark" ? "Light" : "Dark"} onClick={toggleTheme}>
        <Icon name={theme === "dark" ? "sun" : "moon"} size={15} />
      </IconButton>
      <Link
        href="/expiring"
        title="Expiring soon"
        aria-label="Expiring soon"
        style={{
          width: 32,
          height: 32,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          borderRadius: 6,
          color: "var(--pw-text-secondary)",
        }}
        className="hover:bg-[var(--pw-surface-2)] hover:text-[var(--pw-text)]"
      >
        <Icon name="bell" size={15} />
      </Link>
      <IconButton title="Sign out" onClick={onSignOut}>
        <Icon name="logOut" size={15} />
      </IconButton>
      <span className="pw-avatar" style={{ background: "var(--pw-photo-tint-4)" }}>
        {userInitials}
      </span>

      {menuOpen && (
        <div
          id="pw-mobile-menu"
          role="menu"
          // Mobile-only panel. `md:hidden` guards it if the viewport grows to
          // desktop while open; default block layout, so no inline `display`
          // that would beat the class.
          className="md:hidden"
          style={{
            position: "absolute",
            top: 56,
            left: 0,
            right: 0,
            background: "var(--pw-surface)",
            borderBottom: "1px solid var(--pw-border)",
            boxShadow: "0 10px 28px rgba(0,0,0,0.12)",
            padding: 8,
            zIndex: 60,
          }}
        >
          {navLinks.map((link) => {
            const active =
              link.href === "/"
                ? pathname === "/" || pathname.startsWith("/pets")
                : pathname.startsWith(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                role="menuitem"
                onClick={() => setMenuOpen(false)}
                style={{
                  display: "block",
                  padding: "11px 12px",
                  borderRadius: 8,
                  font: "500 14px var(--font-inter)",
                  color: active ? "var(--pw-text)" : "var(--pw-text-secondary)",
                  background: active ? "var(--pw-surface-2)" : "transparent",
                  textDecoration: "none",
                }}
              >
                {link.label}
              </Link>
            );
          })}
          <button
            type="button"
            role="menuitem"
            onClick={toggleTheme}
            style={{
              width: "100%",
              display: "flex",
              alignItems: "center",
              gap: 8,
              marginTop: 4,
              padding: "11px 12px",
              borderRadius: 8,
              border: 0,
              borderTop: "1px solid var(--pw-border)",
              background: "transparent",
              color: "var(--pw-text-secondary)",
              font: "500 14px var(--font-inter)",
              cursor: "pointer",
              textAlign: "left",
            }}
          >
            <Icon name={theme === "dark" ? "sun" : "moon"} size={16} />
            {theme === "dark" ? "Light mode" : "Dark mode"}
          </button>
        </div>
      )}
    </header>
  );
}

function IconButton({
  children,
  onClick,
  title,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  title?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      style={{
        width: 32,
        height: 32,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        background: "transparent",
        border: 0,
        borderRadius: 6,
        color: "var(--pw-text-secondary)",
        cursor: "pointer",
      }}
      className={cn("hover:bg-[var(--pw-surface-2)] hover:text-[var(--pw-text)]")}
    >
      {children}
    </button>
  );
}
