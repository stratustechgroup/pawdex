"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { Icon } from "@/components/brand/icon";
import { PawdexMark } from "@/components/brand/mark";
import {
  HouseholdSwitcher,
  type SwitcherHousehold,
} from "@/components/pawdex/household-switcher";
import { OPEN_PALETTE_EVENT } from "@/components/pawdex/cockpit/command-palette";
import { cn } from "@/lib/utils";

function openPalette() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(OPEN_PALETTE_EVENT));
  }
}

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
  displayName,
  email,
  onSignOut,
}: {
  households: SwitcherHousehold[];
  userInitials: string;
  displayName: string | null;
  email: string | null;
  onSignOut: () => void;
}) {
  const pathname = usePathname();
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [menuOpen, setMenuOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const accountRef = useRef<HTMLDivElement>(null);

  const isBreeder =
    households.find((h) => h.isActive)?.kind === "breeder";
  const navLinks: NavLink[] = isBreeder
    ? [NAV[0], BREEDING_LINK, ...NAV.slice(1)]
    : NAV;

  // Close both menus whenever the route changes, so a tapped link never leaves
  // a panel hanging open over the new page.
  useEffect(() => {
    setMenuOpen(false);
    setAccountOpen(false);
  }, [pathname]);

  // Close the account dropdown on any click outside it.
  useEffect(() => {
    if (!accountOpen) return;
    function onPointerDown(e: MouseEvent) {
      if (accountRef.current && !accountRef.current.contains(e.target as Node)) {
        setAccountOpen(false);
      }
    }
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [accountOpen]);

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
      {/* Command palette trigger. Desktop shows a labelled search pill; mobile
          collapses to the icon button below. Both dispatch the same event the
          palette listens for (alongside Cmd/Ctrl-K). */}
      <button
        type="button"
        onClick={openPalette}
        aria-label="Search (Command K)"
        title="Search"
        className="hidden md:inline-flex hover:border-[var(--pw-border-focus)]"
        style={{
          alignItems: "center",
          gap: 8,
          height: 32,
          padding: "0 8px 0 10px",
          borderRadius: 8,
          border: "1px solid var(--pw-border-strong)",
          background: "var(--pw-surface-2)",
          color: "var(--pw-text-secondary)",
          font: "400 13px var(--font-inter)",
          cursor: "pointer",
        }}
      >
        <Icon name="search" size={14} />
        <span>Search</span>
        <span style={{ display: "inline-flex", gap: 2 }}>
          <span className="pw-kbd">⌘</span>
          <span className="pw-kbd">K</span>
        </span>
      </button>
      <button
        type="button"
        onClick={openPalette}
        aria-label="Search"
        title="Search"
        className="inline-flex md:hidden hover:bg-[var(--pw-surface-2)] hover:text-[var(--pw-text)]"
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
        <Icon name="search" size={16} />
      </button>
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
      <div ref={accountRef} style={{ position: "relative" }}>
        <button
          type="button"
          onClick={() => setAccountOpen((v) => !v)}
          aria-label="Account menu"
          aria-haspopup="menu"
          aria-expanded={accountOpen}
          aria-controls="pw-account-menu"
          className="pw-avatar"
          style={{
            background: "var(--pw-photo-tint-4)",
            border: 0,
            cursor: "pointer",
          }}
        >
          {userInitials}
        </button>
        {accountOpen && (
          <div
            id="pw-account-menu"
            role="menu"
            style={{
              position: "absolute",
              top: 40,
              right: 0,
              minWidth: 220,
              background: "var(--pw-surface)",
              border: "1px solid var(--pw-border)",
              borderRadius: 10,
              boxShadow: "0 10px 28px rgba(0,0,0,0.14)",
              padding: 6,
              zIndex: 70,
            }}
          >
            <div style={{ padding: "8px 10px 10px" }}>
              <div
                style={{
                  font: "600 13px var(--font-inter)",
                  color: "var(--pw-text)",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {displayName || email?.split("@")[0] || "Your account"}
              </div>
              {email && (
                <div
                  style={{
                    font: "400 11.5px var(--font-inter)",
                    color: "var(--pw-text-muted)",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {email}
                </div>
              )}
            </div>
            <div
              style={{
                height: 1,
                background: "var(--pw-border)",
                margin: "2px 0 4px",
              }}
            />
            <AccountMenuLink href="/settings/account" icon="user" label="Account settings" />
            <AccountMenuLink href="/settings/household" icon="home" label="Household settings" />
            <AccountMenuLink href="/settings/authorizations" icon="shieldCheck" label="Authorizations" />
            <AccountMenuLink href="/settings/activity" icon="activity" label="Account activity" />
            <AccountMenuLink href="/settings/billing" icon="receipt" label="Billing & plan" />
            <div
              style={{
                height: 1,
                background: "var(--pw-border)",
                margin: "4px 0",
              }}
            />
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setAccountOpen(false);
                onSignOut();
              }}
              style={{
                width: "100%",
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "9px 10px",
                borderRadius: 7,
                border: 0,
                background: "transparent",
                color: "var(--pw-text-secondary)",
                font: "500 13px var(--font-inter)",
                cursor: "pointer",
                textAlign: "left",
              }}
              className="hover:bg-[var(--pw-surface-2)] hover:text-[var(--pw-text)]"
            >
              <Icon name="logOut" size={15} />
              Sign out
            </button>
          </div>
        )}
      </div>

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
          <Link
            href="/settings/account"
            role="menuitem"
            onClick={() => setMenuOpen(false)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              marginTop: 4,
              padding: "11px 12px",
              borderRadius: 8,
              borderTop: "1px solid var(--pw-border)",
              font: "500 14px var(--font-inter)",
              color: pathname.startsWith("/settings/account")
                ? "var(--pw-text)"
                : "var(--pw-text-secondary)",
              background: pathname.startsWith("/settings/account")
                ? "var(--pw-surface-2)"
                : "transparent",
              textDecoration: "none",
            }}
          >
            <Icon name="user" size={16} />
            Account
          </Link>
          <button
            type="button"
            role="menuitem"
            onClick={toggleTheme}
            style={{
              width: "100%",
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "11px 12px",
              borderRadius: 8,
              border: 0,
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

function AccountMenuLink({
  href,
  icon,
  label,
}: {
  href: string;
  icon: string;
  label: string;
}) {
  return (
    <Link
      href={href}
      role="menuitem"
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "9px 10px",
        borderRadius: 7,
        color: "var(--pw-text-secondary)",
        font: "500 13px var(--font-inter)",
        textDecoration: "none",
      }}
      className="hover:bg-[var(--pw-surface-2)] hover:text-[var(--pw-text)]"
    >
      <Icon name={icon} size={15} />
      {label}
    </Link>
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
