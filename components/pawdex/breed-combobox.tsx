"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { Icon } from "@/components/brand/icon";
import { filterBreeds } from "@/lib/clinical/breed-catalog";

/**
 * Linear-style breed combobox: text input + dropdown of curated matches,
 * keyboard navigable (↑/↓ to move, Enter to select, Esc to close). Accepts
 * free text — if the user types something not in the catalog they can still
 * submit it.
 */
export function BreedCombobox({
  name,
  defaultValue = "",
  species,
  placeholder,
  id,
  onChange,
}: {
  name: string;
  defaultValue?: string;
  species: "dog" | "cat" | "other" | null;
  placeholder?: string;
  id?: string;
  onChange?: (value: string) => void;
}) {
  const [value, setValueState] = useState(defaultValue);
  const setValue = (next: string) => {
    setValueState(next);
    onChange?.(next);
  };
  const [open, setOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(0);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const matches = useMemo(
    () => filterBreeds(value, species, 32),
    [value, species],
  );

  // Reset highlight whenever the visible list changes shape.
  useEffect(() => {
    setHighlighted(0);
  }, [matches.length, species]);

  // Click-outside to close.
  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (!wrapperRef.current) return;
      if (!wrapperRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  // Keep the highlighted row in view.
  useEffect(() => {
    if (!open || !listRef.current) return;
    const el = listRef.current.querySelector<HTMLElement>(
      `[data-idx="${highlighted}"]`,
    );
    if (el) el.scrollIntoView({ block: "nearest" });
  }, [highlighted, open]);

  function commitSelection(name: string) {
    setValue(name);
    setOpen(false);
    inputRef.current?.focus();
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (!open) setOpen(true);
      setHighlighted((h) => Math.min(h + 1, Math.max(matches.length - 1, 0)));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlighted((h) => Math.max(h - 1, 0));
    } else if (e.key === "Enter") {
      if (open && matches[highlighted]) {
        e.preventDefault();
        commitSelection(matches[highlighted].name);
      }
    } else if (e.key === "Escape") {
      if (open) {
        e.preventDefault();
        setOpen(false);
      }
    }
  }

  return (
    <div ref={wrapperRef} style={{ position: "relative" }}>
      <div
        style={{
          position: "relative",
          display: "flex",
          alignItems: "center",
        }}
      >
        <Icon
          name="search"
          size={13}
          style={{
            position: "absolute",
            left: 10,
            color: "var(--pw-text-subtle)",
            pointerEvents: "none",
          }}
        />
        <input
          ref={inputRef}
          id={id}
          type="text"
          name={name}
          value={value}
          placeholder={placeholder ?? "Type to search breeds…"}
          onChange={(e) => {
            setValue(e.target.value);
            if (!open) setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          autoComplete="off"
          style={{
            width: "100%",
            height: 36,
            padding: "0 30px 0 30px",
            borderRadius: 6,
            border: "1px solid var(--pw-border-strong)",
            background: "var(--pw-surface)",
            color: "var(--pw-text)",
            font: "400 13px var(--font-inter)",
            outline: "none",
          }}
        />
        {value && (
          <button
            type="button"
            onClick={() => {
              setValue("");
              setOpen(true);
              inputRef.current?.focus();
            }}
            style={{
              position: "absolute",
              right: 6,
              width: 22,
              height: 22,
              border: 0,
              background: "transparent",
              color: "var(--pw-text-muted)",
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              borderRadius: 4,
            }}
            aria-label="Clear breed"
            tabIndex={-1}
          >
            <Icon name="x" size={11} />
          </button>
        )}
      </div>

      {open && matches.length > 0 && (
        <ul
          ref={listRef}
          role="listbox"
          style={{
            position: "absolute",
            top: "calc(100% + 4px)",
            left: 0,
            right: 0,
            zIndex: 20,
            margin: 0,
            padding: 4,
            listStyle: "none",
            background: "var(--pw-surface)",
            border: "1px solid var(--pw-border-strong)",
            borderRadius: 8,
            boxShadow: "0 8px 24px rgba(0,0,0,0.15)",
            maxHeight: 280,
            overflowY: "auto",
          }}
        >
          {matches.map((b, i) => {
            const isActive = i === highlighted;
            return (
              <li
                key={`${b.species}-${b.name}`}
                role="option"
                data-idx={i}
                aria-selected={isActive}
                onMouseEnter={() => setHighlighted(i)}
                onMouseDown={(e) => {
                  // mousedown (not click) so the input doesn't blur first.
                  e.preventDefault();
                  commitSelection(b.name);
                }}
                style={{
                  padding: "7px 10px",
                  borderRadius: 5,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  background: isActive
                    ? "var(--pw-surface-2, var(--pw-surface-muted))"
                    : "transparent",
                  color: "var(--pw-text)",
                  font: "400 13px var(--font-inter)",
                }}
              >
                <span style={{ flex: 1 }}>{b.name}</span>
                {isActive && (
                  <kbd
                    style={{
                      font: "500 10px var(--font-jetbrains-mono)",
                      color: "var(--pw-text-muted)",
                      letterSpacing: "0.04em",
                    }}
                  >
                    ↵
                  </kbd>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {open && matches.length === 0 && value.trim().length > 0 && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 4px)",
            left: 0,
            right: 0,
            zIndex: 20,
            padding: "10px 12px",
            background: "var(--pw-surface)",
            border: "1px solid var(--pw-border-strong)",
            borderRadius: 8,
            font: "400 12.5px var(--font-inter)",
            color: "var(--pw-text-muted)",
            boxShadow: "0 8px 24px rgba(0,0,0,0.15)",
          }}
        >
          No catalog match — you can still submit{" "}
          <strong style={{ color: "var(--pw-text)" }}>
            &ldquo;{value.trim()}&rdquo;
          </strong>
          .
        </div>
      )}
    </div>
  );
}
