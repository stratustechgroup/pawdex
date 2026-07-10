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

  const isBreeder =
    households.find((h) => h.isActive)?.kind === "breeder";
  const navLinks: NavLink[] = isBreeder
    ? [NAV[0], BREEDING_LINK, ...NAV.slice(1)]
    : NAV;

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
        style={{
          display: "flex",
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
      <div
        className="hidden sm:block"
        style={{ position: "relative", flex: "0 1 220px" }}
      >
        <Icon
          name="search"
          size={14}
          style={{
            position: "absolute",
            left: 10,
            top: "50%",
            transform: "translateY(-50%)",
            color: "var(--pw-text-muted)",
          }}
        />
        <input
          type="search"
          placeholder="Search anything…"
          style={{
            width: "100%",
            height: 32,
            padding: "0 56px 0 32px",
            border: "1px solid var(--pw-border-strong)",
            borderRadius: 6,
            background: "var(--pw-surface)",
            color: "var(--pw-text)",
            font: "400 12.5px var(--font-inter)",
            outline: "none",
          }}
        />
        <span
          style={{
            position: "absolute",
            right: 8,
            top: "50%",
            transform: "translateY(-50%)",
            display: "flex",
            gap: 3,
          }}
        >
          <span className="pw-kbd">⌘</span>
          <span className="pw-kbd">K</span>
        </span>
      </div>
      <IconButton title={theme === "dark" ? "Light" : "Dark"} onClick={toggleTheme}>
        <Icon name={theme === "dark" ? "sun" : "moon"} size={15} />
      </IconButton>
      <IconButton title="Notifications">
        <span style={{ position: "relative", display: "inline-flex" }}>
          <Icon name="bell" size={15} />
          <span
            style={{
              position: "absolute",
              top: -2,
              right: -2,
              width: 7,
              height: 7,
              borderRadius: "50%",
              background: "#B5732A",
              border: "1.5px solid var(--pw-surface)",
            }}
          />
        </span>
      </IconButton>
      <IconButton title="Sign out" onClick={onSignOut}>
        <Icon name="logOut" size={15} />
      </IconButton>
      <span className="pw-avatar" style={{ background: "var(--pw-photo-tint-4)" }}>
        {userInitials}
      </span>
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
