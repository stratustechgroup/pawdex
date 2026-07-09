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

export function daysBetween(from: Date, to: Date): number {
  const ms = to.getTime() - from.getTime();
  return Math.round(ms / 86_400_000);
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
