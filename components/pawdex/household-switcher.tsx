"use client";

import { useEffect, useRef, useState, useTransition } from "react";

import { Icon } from "@/components/brand/icon";
import { switchHousehold } from "@/lib/auth/switch-household";

export type SwitcherHousehold = {
  householdId: string;
  name: string;
  kind: "personal" | "breeder";
  role: "owner" | "member" | "viewer";
  isActive: boolean;
};

const ROLE_LABEL: Record<SwitcherHousehold["role"], string> = {
  owner: "Owner",
  member: "Member",
  viewer: "Viewer",
};

/**
 * Household chooser mounted in the top nav. With one household it renders an
 * inert label (no dropdown, no affordance). With more than one it becomes a
 * compact dropdown that switches the active household via a server action.
 */
export function HouseholdSwitcher({
  households,
}: {
  households: SwitcherHousehold[];
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const rootRef = useRef<HTMLDivElement>(null);

  const active =
    households.find((h) => h.isActive) ?? households[0] ?? null;
  const multiple = households.length > 1;

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (!active) return null;

  function select(id: string) {
    if (id === active?.householdId) {
      setOpen(false);
      return;
    }
    startTransition(async () => {
      await switchHousehold(id);
    });
  }

  return (
    <div ref={rootRef} style={{ position: "relative", flexShrink: 0 }}>
      <button
        type="button"
        onClick={() => multiple && setOpen((v) => !v)}
        title={active.name}
        aria-haspopup={multiple ? "menu" : undefined}
        aria-expanded={multiple ? open : undefined}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          font: "500 13px var(--font-inter)",
          color: "var(--pw-text-secondary)",
          background: open ? "var(--pw-surface-2)" : "transparent",
          border: 0,
          borderRadius: 6,
          cursor: multiple ? "pointer" : "default",
          padding: "5px 7px",
          margin: "0 -7px",
        }}
      >
        <Icon
          name={active.kind === "breeder" ? "paw" : "home"}
          size={14}
          style={{ color: "var(--pw-text-muted)" }}
        />
        <span
          style={{
            maxWidth: 160,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {active.name}
        </span>
        {active.kind === "breeder" && <KindBadge kind="breeder" />}
        {multiple && (
          <Icon
            name="chevronDown"
            size={13}
            style={{ color: "var(--pw-text-muted)" }}
          />
        )}
      </button>

      {open && multiple && (
        <div
          role="menu"
          style={{
            position: "absolute",
            top: "calc(100% + 6px)",
            left: 0,
            minWidth: 248,
            background: "var(--pw-surface)",
            border: "1px solid var(--pw-border-strong)",
            borderRadius: 10,
            boxShadow: "0 8px 28px rgba(0,0,0,0.14)",
            padding: 6,
            zIndex: 50,
          }}
        >
          <div
            style={{
              padding: "6px 8px 8px",
              font: "500 10.5px var(--font-inter)",
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              color: "var(--pw-text-muted)",
            }}
          >
            Switch household
          </div>
          {households.map((h) => (
            <button
              key={h.householdId}
              type="button"
              role="menuitem"
              disabled={pending}
              onClick={() => select(h.householdId)}
              style={{
                width: "100%",
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "8px 8px",
                borderRadius: 6,
                background: h.isActive ? "var(--pw-surface-2)" : "transparent",
                border: 0,
                cursor: pending ? "default" : "pointer",
                textAlign: "left",
                opacity: pending && !h.isActive ? 0.6 : 1,
              }}
              className="hover:bg-[var(--pw-surface-2)]"
            >
              <Icon
                name={h.kind === "breeder" ? "paw" : "home"}
                size={15}
                style={{ color: "var(--pw-text-muted)", flexShrink: 0 }}
              />
              <span style={{ flex: 1, minWidth: 0 }}>
                <span
                  style={{
                    display: "block",
                    font: "500 13px var(--font-inter)",
                    color: "var(--pw-text)",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {h.name}
                </span>
                <span
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    marginTop: 2,
                    font: "400 11.5px var(--font-inter)",
                    color: "var(--pw-text-muted)",
                  }}
                >
                  {ROLE_LABEL[h.role]}
                  {h.kind === "breeder" && <KindBadge kind="breeder" />}
                </span>
              </span>
              {h.isActive && (
                <Icon
                  name="check"
                  size={15}
                  style={{ color: "var(--pw-accent)", flexShrink: 0 }}
                />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function KindBadge({ kind }: { kind: "breeder" }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "1px 6px",
        borderRadius: 999,
        background: "var(--pw-accent-soft)",
        color: "var(--pw-accent-fg-on-soft)",
        font: "600 9.5px var(--font-inter)",
        letterSpacing: "0.04em",
        textTransform: "uppercase",
      }}
    >
      {kind === "breeder" ? "Breeder" : kind}
    </span>
  );
}
