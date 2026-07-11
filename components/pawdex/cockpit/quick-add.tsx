"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

import { Icon } from "@/components/brand/icon";
import { PetPhoto } from "@/components/pawdex/pet-photo";
import type { NavPet } from "@/lib/db/cockpit";

type PetScopedAction = {
  id: string;
  label: string;
  icon: string;
  /** Route builder given a chosen pet id. */
  to: (petId: string) => string;
};

const GLOBAL_ADD_PET = {
  id: "add-pet",
  label: "Add a pet",
  icon: "paw",
  href: "/pets/new",
};

const PET_ACTIONS: PetScopedAction[] = [
  { id: "upload", label: "Upload a document", icon: "upload", to: (id) => `/pets/${id}/upload` },
  { id: "weight", label: "Log a weight", icon: "scale", to: (id) => `/pets/${id}/weight` },
  { id: "med", label: "Log a medication", icon: "pill", to: (id) => `/pets/${id}/medications` },
];

export function QuickAdd({ pets }: { pets: NavPet[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [picking, setPicking] = useState<PetScopedAction | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Close the menu once the route actually changes, rather than tearing it
  // down in the same tick as the push (which can abort the client navigation).
  useEffect(() => {
    setOpen(false);
    setPicking(null);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
        setPicking(null);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        if (picking) setPicking(null);
        else {
          setOpen(false);
          buttonRef.current?.focus();
        }
      }
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, picking]);

  function go(href: string) {
    // Navigate only; the pathname effect closes the menu once the route
    // changes. A same-tick teardown here can abort the App Router navigation.
    if (href === pathname) {
      setOpen(false);
      setPicking(null);
      return;
    }
    router.push(href);
  }

  function chooseAction(action: PetScopedAction) {
    if (pets.length === 0) {
      go("/pets/new");
      return;
    }
    if (pets.length === 1) {
      go(action.to(pets[0].id));
      return;
    }
    setPicking(action);
  }

  return (
    <div ref={rootRef} style={{ position: "relative" }}>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => {
          setOpen((v) => !v);
          setPicking(null);
        }}
        aria-haspopup="true"
        aria-expanded={open}
        aria-controls="pw-quick-add-menu"
        className="pw-accent-fill"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          height: 34,
          padding: "0 13px 0 11px",
          borderRadius: 8,
          border: 0,
          font: "600 13px var(--font-inter)",
          cursor: "pointer",
        }}
      >
        <Icon name="plus" size={15} />
        Quick add
      </button>

      {open && (
        <div
          id="pw-quick-add-menu"
          aria-label="Quick add"
          className="pw-quick-menu"
        >
          {picking ? (
            <>
              <button
                type="button"
                className="pw-quick-back"
                onClick={() => setPicking(null)}
              >
                <Icon name="arrowLeft" size={14} />
                {picking.label} · pick a pet
              </button>
              <div className="pw-quick-divider" />
              {pets.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  className="pw-quick-item"
                  onClick={() => go(picking.to(p.id))}
                >
                  <PetPhoto name={p.name} size={22} ring={false} />
                  <span className="pw-quick-label">{p.name}</span>
                  <Icon
                    name="chevronRight"
                    size={13}
                    style={{ color: "var(--pw-text-subtle)" }}
                  />
                </button>
              ))}
            </>
          ) : (
            <>
              <button
                type="button"
                className="pw-quick-item"
                onClick={() => go(GLOBAL_ADD_PET.href)}
              >
                <span className="pw-quick-icon">
                  <Icon name={GLOBAL_ADD_PET.icon} size={15} />
                </span>
                <span className="pw-quick-label">{GLOBAL_ADD_PET.label}</span>
              </button>
              <div className="pw-quick-divider" />
              {PET_ACTIONS.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  className="pw-quick-item"
                  onClick={() => chooseAction(a)}
                >
                  <span className="pw-quick-icon">
                    <Icon name={a.icon} size={15} />
                  </span>
                  <span className="pw-quick-label">{a.label}</span>
                  {pets.length > 1 && (
                    <Icon
                      name="chevronRight"
                      size={13}
                      style={{ color: "var(--pw-text-subtle)" }}
                    />
                  )}
                </button>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}
