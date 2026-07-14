"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * Reusable "type the exact name to confirm" field. Case-insensitive match on the
 * trimmed value. The parent owns the value + validity so it can gate a submit
 * button; this component just renders the labelled input and the match hint.
 */
export function TypeToConfirm({
  phrase,
  value,
  onChange,
  label,
  id = "type-to-confirm",
}: {
  phrase: string;
  value: string;
  onChange: (next: string) => void;
  label?: string;
  id?: string;
}) {
  const matches = value.trim().toLowerCase() === phrase.trim().toLowerCase();
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <Label htmlFor={id} style={{ color: "var(--pw-text)" }}>
        {label ?? (
          <>
            Type <strong style={{ fontWeight: 600 }}>{phrase}</strong> to confirm
          </>
        )}
      </Label>
      <Input
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete="off"
        autoCapitalize="off"
        spellCheck={false}
        aria-invalid={value.length > 0 && !matches}
        placeholder={phrase}
      />
    </div>
  );
}

/** Shared validity check so callers agree with the field on what "matches". */
export function confirmMatches(phrase: string, value: string): boolean {
  return value.trim().toLowerCase() === phrase.trim().toLowerCase();
}
