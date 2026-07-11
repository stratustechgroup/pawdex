"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

import { Icon } from "@/components/brand/icon";
import { PetPhoto } from "@/components/pawdex/pet-photo";
import type { NavPet } from "@/lib/db/cockpit";

export const OPEN_PALETTE_EVENT = "pw-open-command-palette";

type Command = {
  id: string;
  label: string;
  group: "Pets" | "Go to" | "Quick actions";
  href: string;
  keywords?: string;
  icon?: string;
  petName?: string;
};

function buildCommands(pets: NavPet[], isBreeder: boolean): Command[] {
  const petCmds: Command[] = pets.map((p) => ({
    id: `pet-${p.id}`,
    label: p.name,
    group: "Pets",
    href: `/pets/${p.id}`,
    keywords: p.species,
    petName: p.name,
  }));

  const nav: Command[] = [
    { id: "nav-home", label: "Dashboard", group: "Go to", href: "/", icon: "home" },
    { id: "nav-expiring", label: "Expiring soon", group: "Go to", href: "/expiring", icon: "clock", keywords: "reminders radar vaccines due" },
    { id: "nav-reminders", label: "Reminders", group: "Go to", href: "/reminders", icon: "bell" },
    { id: "nav-inbox", label: "Inbox", group: "Go to", href: "/inbox", icon: "inbox", keywords: "documents unassigned forward" },
    { id: "nav-documents", label: "All documents", group: "Go to", href: "/documents", icon: "fileText" },
    { id: "nav-vets", label: "Vets", group: "Go to", href: "/vets", icon: "stethoscope", keywords: "clinic veterinarian" },
    { id: "nav-insurance", label: "Insurance", group: "Go to", href: "/insurance", icon: "shield", keywords: "policy claim coverage" },
    { id: "nav-ask", label: "Ask", group: "Go to", href: "/ask", icon: "sparkles", keywords: "question search records" },
    ...(isBreeder
      ? [{ id: "nav-breeding", label: "Breeding", group: "Go to" as const, href: "/breeding", icon: "paw", keywords: "litter" }]
      : []),
    { id: "nav-settings-household", label: "Household settings", group: "Go to", href: "/settings/household", icon: "home", keywords: "members" },
    { id: "nav-settings-account", label: "Account settings", group: "Go to", href: "/settings/account", icon: "user" },
    { id: "nav-settings-auth", label: "Authorizations", group: "Go to", href: "/settings/authorizations", icon: "shieldCheck", keywords: "consent permissions" },
    { id: "nav-settings-activity", label: "Account activity", group: "Go to", href: "/settings/activity", icon: "activity", keywords: "audit log history" },
    { id: "nav-settings-billing", label: "Billing & plan", group: "Go to", href: "/settings/billing", icon: "receipt", keywords: "subscription upgrade payment" },
  ];

  const actions: Command[] = [
    { id: "act-add-pet", label: "Add a pet", group: "Quick actions", href: "/pets/new", icon: "plus" },
    { id: "act-upload", label: "Upload a document", group: "Quick actions", href: "/inbox", icon: "upload", keywords: "scan add file" },
  ];

  return [...petCmds, ...nav, ...actions];
}

export function CommandPalette({
  pets,
  isBreeder,
}: {
  pets: NavPet[];
  isBreeder: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const restoreRef = useRef<HTMLElement | null>(null);

  const commands = useMemo(
    () => buildCommands(pets, isBreeder),
    [pets, isBreeder],
  );

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return commands;
    return commands.filter((c) =>
      `${c.label} ${c.keywords ?? ""} ${c.group}`.toLowerCase().includes(q),
    );
  }, [commands, query]);

  const close = useCallback(() => {
    setOpen(false);
    setQuery("");
    setActive(0);
    // Restore focus to whatever opened the palette (accessibility 2.4.3).
    const el = restoreRef.current;
    if (el && typeof el.focus === "function") el.focus();
  }, []);

  const openPalette = useCallback(() => {
    restoreRef.current = document.activeElement as HTMLElement | null;
    setOpen(true);
  }, []);

  // Global open triggers: Cmd/Ctrl-K and the custom event dispatched by the
  // visible search button in the top nav.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => {
          if (!v) restoreRef.current = document.activeElement as HTMLElement | null;
          return !v;
        });
      }
    }
    function onOpenEvent() {
      openPalette();
    }
    window.addEventListener("keydown", onKey);
    window.addEventListener(OPEN_PALETTE_EVENT, onOpenEvent);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener(OPEN_PALETTE_EVENT, onOpenEvent);
    };
  }, [openPalette]);

  // On open, move focus into the input and lock body scroll.
  useEffect(() => {
    if (!open) return;
    const t = requestAnimationFrame(() => inputRef.current?.focus());
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      cancelAnimationFrame(t);
      document.body.style.overflow = prevOverflow;
    };
  }, [open]);

  // Keep the active option in view as it moves.
  useEffect(() => {
    if (!open) return;
    const el = listRef.current?.querySelector<HTMLElement>(
      '[data-active="true"]',
    );
    el?.scrollIntoView({ block: "nearest" });
  }, [active, open]);

  useEffect(() => {
    setActive(0);
  }, [query]);

  // Close (and reset) whenever the route actually changes. Decoupling teardown
  // from the push this way mirrors the top-nav pattern and avoids aborting the
  // App Router client navigation by re-rendering the dialog in the same tick.
  useEffect(() => {
    setOpen(false);
    setQuery("");
    setActive(0);
  }, [pathname]);

  function navigate(cmd: Command | undefined) {
    if (!cmd) return;
    if (cmd.href === pathname) {
      // Already here: nothing to navigate, just close.
      setOpen(false);
      setQuery("");
      setActive(0);
      return;
    }
    router.push(cmd.href);
  }

  function onDialogKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") {
      e.preventDefault();
      close();
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => (results.length === 0 ? 0 : (i + 1) % results.length));
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) =>
        results.length === 0 ? 0 : (i - 1 + results.length) % results.length,
      );
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      navigate(results[active]);
      return;
    }
    if (e.key === "Tab") {
      // Focus trap: only the input and close button are focusable; keep the
      // ring inside the dialog.
      const focusables = dialogRef.current?.querySelectorAll<HTMLElement>(
        'input, button:not([disabled])',
      );
      if (!focusables || focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  }

  if (!open) return null;

  // Flatten with group headers while tracking the global option index so
  // aria-activedescendant and arrow navigation stay in sync.
  let idx = -1;
  const groups: { group: string; items: { cmd: Command; index: number }[] }[] = [];
  for (const cmd of results) {
    idx += 1;
    const last = groups[groups.length - 1];
    const entry = { cmd, index: idx };
    if (last && last.group === cmd.group) last.items.push(entry);
    else groups.push({ group: cmd.group, items: [entry] });
  }

  return (
    <div
      className="pw-palette-overlay"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        className="pw-palette"
        onKeyDown={onDialogKeyDown}
      >
        <div className="pw-palette-input-row">
          <Icon
            name="search"
            size={16}
            style={{ color: "var(--pw-text-muted)", flexShrink: 0 }}
          />
          <input
            ref={inputRef}
            type="text"
            role="combobox"
            aria-expanded="true"
            aria-controls="pw-palette-list"
            aria-activedescendant={
              results[active] ? `pw-cmd-${results[active].id}` : undefined
            }
            aria-autocomplete="list"
            placeholder="Search pets, pages, and actions…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pw-palette-input"
          />
          <button
            type="button"
            onClick={close}
            aria-label="Close command palette"
            className="pw-palette-close"
          >
            <span className="pw-kbd">Esc</span>
          </button>
        </div>

        <ul
          ref={listRef}
          id="pw-palette-list"
          role="listbox"
          aria-label="Results"
          className="pw-palette-list pw-scroll-y"
        >
          {results.length === 0 && (
            <li role="presentation" className="pw-palette-empty">
              No matches for “{query}”.
            </li>
          )}
          {groups.map((g) => (
            <li key={g.group} role="presentation">
              <div className="pw-palette-group">{g.group}</div>
              <ul role="presentation" style={{ margin: 0, padding: 0 }}>
                {g.items.map(({ cmd, index }) => {
                  const isActive = index === active;
                  return (
                    <li
                      key={cmd.id}
                      id={`pw-cmd-${cmd.id}`}
                      role="option"
                      aria-selected={isActive}
                      data-active={isActive}
                      className="pw-palette-option"
                      onMouseMove={() => setActive(index)}
                      onClick={() => navigate(cmd)}
                    >
                      <span className="pw-palette-option-icon" aria-hidden>
                        {cmd.group === "Pets" ? (
                          <PetPhoto name={cmd.petName} size={20} ring={false} />
                        ) : (
                          <Icon name={cmd.icon ?? "chevronRight"} size={15} />
                        )}
                      </span>
                      <span className="pw-palette-option-label">{cmd.label}</span>
                      {isActive && (
                        <Icon
                          name="arrowRight"
                          size={13}
                          style={{ color: "var(--pw-text-subtle)" }}
                        />
                      )}
                    </li>
                  );
                })}
              </ul>
            </li>
          ))}
        </ul>

        <div className="pw-palette-foot">
          <span>
            <span className="pw-kbd">↑</span>
            <span className="pw-kbd">↓</span> to move
          </span>
          <span>
            <span className="pw-kbd">↵</span> to open
          </span>
          <span>
            <span className="pw-kbd">esc</span> to close
          </span>
        </div>
      </div>
    </div>
  );
}
