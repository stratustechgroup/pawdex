"use client";

import { usePathname } from "next/navigation";

import { Icon } from "@/components/brand/icon";
import { PrefetchLink } from "@/components/pawdex/prefetch-link";

// The phone's primary navigation.
//
// This is the de-crowding that docs/mobile-audit.md deferred as "a design
// change, not a layout patch." The old shell put a wordmark, a household
// switcher, a search control, a theme toggle, a notification bell and an
// avatar into one 390px row, and then hid every actual destination behind a
// hamburger. On a product whose brief is that the web app IS the phone
// experience until a native app ships, the destinations were the one thing
// that should never have been the thing behind a menu.
//
// Five slots, because six is where labels start truncating at 360px. Four
// destinations plus More, which opens the existing header menu rather than
// inventing a second one, so there is exactly one place the secondary routes
// live.
//
// Desktop keeps the horizontal top nav and never renders this: a tab bar
// pinned to the bottom of a 1440px window is a phone idiom worn as costume.

type Tab = {
  label: string;
  href: string;
  icon: string;
  /** Extra path prefixes that should light this tab up. */
  also?: string[];
};

const TABS: Tab[] = [
  { label: "Pets", href: "/", icon: "paw", also: ["/pets"] },
  { label: "Radar", href: "/expiring", icon: "clock" },
  { label: "Inbox", href: "/inbox", icon: "inbox", also: ["/documents"] },
  { label: "Ask", href: "/ask", icon: "search" },
];

function isActive(pathname: string, tab: Tab) {
  if (tab.href === "/") {
    return pathname === "/" || (tab.also ?? []).some((p) => pathname.startsWith(p));
  }
  return (
    pathname.startsWith(tab.href) ||
    (tab.also ?? []).some((p) => pathname.startsWith(p))
  );
}

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="pw-bottomnav" aria-label="Primary">
      {TABS.map((tab) => {
        const active = isActive(pathname, tab);
        return (
          <PrefetchLink
            key={tab.href}
            href={tab.href}
            className="pw-bottomnav-item"
            data-active={active ? "true" : undefined}
            aria-current={active ? "page" : undefined}
          >
            <Icon name={tab.icon} size={19} />
            <span>{tab.label}</span>
          </PrefetchLink>
        );
      })}
      <button
        type="button"
        className="pw-bottomnav-item"
        // Reuses the header's own disclosure rather than duplicating the menu.
        onClick={() =>
          window.dispatchEvent(new CustomEvent("pawdex:open-nav-menu"))
        }
      >
        <Icon name="menu" size={19} />
        <span>More</span>
      </button>
    </nav>
  );
}
