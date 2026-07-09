// Mirror of the SQL function `normalize_phone(text)`. Keep both in sync —
// commit-side dedupe relies on the two producing identical output.

export function normalizePhone(input: string | null | undefined): string | null {
  if (!input) return null;
  const digits = input.replace(/\D/g, "");
  if (digits.length < 10) return null;
  return digits.slice(-10);
}

/** Pretty-print a 10-digit normalized phone as (XXX) XXX-XXXX. */
export function formatPhone(input: string | null | undefined): string | null {
  const normalized = normalizePhone(input);
  if (!normalized) return input ?? null;
  return `(${normalized.slice(0, 3)}) ${normalized.slice(3, 6)}-${normalized.slice(6)}`;
}
