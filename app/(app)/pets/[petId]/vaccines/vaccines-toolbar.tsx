"use client";

import { useCallback, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { Icon } from "@/components/brand/icon";

const STATUS_OPTIONS = [
  { value: "all", label: "All" },
  { value: "current", label: "Active" },
  { value: "archived", label: "Archived" },
] as const;

export type VaccineToolbarStatus = (typeof STATUS_OPTIONS)[number]["value"];

/**
 * Toolbar above the vaccines table — search input + scope toggle chips. We
 * lean on URL search params (`?q=`, `?scope=`) rather than local state so
 * the back button works and shares/bookmarks are stable. The page itself
 * stays server-rendered.
 */
export function VaccinesToolbar({
  initialQ,
  initialScope,
}: {
  initialQ: string;
  initialScope: VaccineToolbarStatus;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const updateParam = useCallback(
    (key: "q" | "scope", value: string | null) => {
      const next = new URLSearchParams(params?.toString() ?? "");
      if (value === null || value === "" || value === "all") next.delete(key);
      else next.set(key, value);
      const qs = next.toString();
      startTransition(() => {
        router.replace(qs ? `?${qs}` : "?", { scroll: false });
      });
    },
    [params, router],
  );

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        flexWrap: "wrap",
      }}
    >
      {/* Search input */}
      <label
        style={{
          position: "relative",
          display: "inline-flex",
          alignItems: "center",
          minWidth: 220,
          flex: "0 1 260px",
        }}
      >
        <span
          aria-hidden
          style={{
            position: "absolute",
            left: 9,
            top: "50%",
            transform: "translateY(-50%)",
            color: "var(--pw-text-muted)",
            display: "inline-flex",
          }}
        >
          <Icon name="search" size={13} />
        </span>
        <input
          type="search"
          name="q"
          placeholder="Search vaccines…"
          defaultValue={initialQ}
          onChange={(e) => updateParam("q", e.currentTarget.value)}
          style={{
            width: "100%",
            height: 30,
            padding: "0 12px 0 28px",
            borderRadius: 6,
            border: "1px solid var(--pw-border)",
            background: "var(--pw-surface)",
            color: "var(--pw-text)",
            font: "400 12.5px var(--font-inter)",
            outline: "none",
          }}
        />
      </label>

      {/* Scope chips */}
      <div
        role="tablist"
        aria-label="Filter vaccines by scope"
        style={{ display: "inline-flex", gap: 4 }}
      >
        {STATUS_OPTIONS.map((opt) => {
          const isActive = initialScope === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              role="tab"
              aria-selected={isActive}
              disabled={isPending}
              onClick={() => updateParam("scope", opt.value)}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 5,
                height: 30,
                padding: "0 12px",
                borderRadius: 6,
                border: "1px solid",
                borderColor: isActive
                  ? "var(--pw-accent)"
                  : "var(--pw-border)",
                background: isActive
                  ? "var(--pw-accent-soft)"
                  : "var(--pw-surface)",
                color: isActive
                  ? "var(--pw-accent-fg-on-soft)"
                  : "var(--pw-text-secondary)",
                font: "500 12.5px var(--font-inter)",
                cursor: "pointer",
              }}
            >
              {opt.label}
              {isActive && opt.value !== "all" && (
                <Icon name="check" size={11} />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export { STATUS_OPTIONS };
