import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function ageFromDob(dob: string | null | undefined): string | null {
  if (!dob) return null;
  const birth = new Date(dob);
  if (Number.isNaN(birth.getTime())) return null;
  const now = new Date();
  let years = now.getFullYear() - birth.getFullYear();
  let months = now.getMonth() - birth.getMonth();
  if (now.getDate() < birth.getDate()) months -= 1;
  if (months < 0) {
    years -= 1;
    months += 12;
  }
  if (years >= 2) return `${years} years`;
  if (years === 1) return months > 0 ? `1 year ${months} mo` : "1 year";
  return `${years * 12 + months} mo`;
}

export function kgToLbs(kg: number): number {
  return Math.round(kg * 2.20462 * 10) / 10;
}

export function lbsToKg(lbs: number): number {
  return Math.round((lbs / 2.20462) * 1000) / 1000;
}

/**
 * Whole calendar days between two dates — compares at the date level so
 * the result is independent of what time of day each Date represents.
 *
 * Critical for vaccine status math: `parseISO("2026-05-27")` is local
 * midnight, but `new Date()` is whatever time it is right now. Naive
 * subtraction would treat "expires today, it's 3pm now" as -0.625 days →
 * round to -1 → classify as overdue when it should be 0 (due today).
 */
export function daysBetween(from: Date, to: Date): number {
  const fromDay = new Date(
    from.getFullYear(),
    from.getMonth(),
    from.getDate(),
  );
  const toDay = new Date(to.getFullYear(), to.getMonth(), to.getDate());
  // DST transitions can give 23h or 25h "days" — round to the nearest
  // whole day to absorb that without losing accuracy.
  return Math.round((toDay.getTime() - fromDay.getTime()) / 86_400_000);
}

/**
 * A medication is "active" if it has no ended_on date or the ended_on is in
 * the future. Mirrors the comment in lib/supabase/types.ts — we compute this
 * in the app because Postgres rejected the generated column (`current_date`
 * is non-immutable).
 */
export function isMedicationActive(endedOn: string | null): boolean {
  if (!endedOn) return true;
  const end = new Date(endedOn);
  if (Number.isNaN(end.getTime())) return true;
  return end.getTime() > Date.now();
}

export type VaccineStatus = "up_to_date" | "due_soon" | "overdue" | "incomplete";

export function vaccineStatusFromExpiries(
  expiries: (string | null)[],
): VaccineStatus {
  const valid = expiries.filter((e): e is string => Boolean(e));
  if (valid.length === 0) return "incomplete";
  const now = new Date();
  let hasOverdue = false;
  let hasDueSoon = false;
  for (const e of valid) {
    const exp = new Date(e);
    if (Number.isNaN(exp.getTime())) continue;
    const days = daysBetween(now, exp);
    if (days < 0) {
      hasOverdue = true;
    } else if (days <= 30) {
      hasDueSoon = true;
    }
  }
  if (hasOverdue) return "overdue";
  if (hasDueSoon) return "due_soon";
  return "up_to_date";
}
