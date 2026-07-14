import "server-only";
import { cache } from "react";

import { differenceInCalendarDays, parseISO } from "date-fns";

import { createClient } from "@/lib/supabase/server";

export type ExpiringStatus = "overdue" | "due_soon" | "warning" | "ok";

export type ExpiringItem = {
  kind: "vaccine" | "policy_renewal";
  pet_id: string | null;
  pet_name: string | null;
  entity_id: string;
  title: string;
  expires_on: string;
  days_until: number;
  status: ExpiringStatus;
  detail: string | null;
  is_rabies: boolean;
};

function statusForDays(days: number): ExpiringStatus {
  if (days < 0) return "overdue";
  if (days <= 14) return "due_soon";
  if (days <= 60) return "warning";
  return "ok";
}

/**
 * Aggregate every expiration-bearing record in the household into one list,
 * sorted by days-until-expiry. Currently covers:
 *   - vaccinations (latest per vaccine_family per pet)
 *   - insurance_policies (renews_on)
 *
 * Future: USDA APHIS 7001 certs, microchip registration renewals, license
 * renewals, treatment courses with hard end dates.
 */
/**
 * Wrapped in React cache() because the dashboard renders it twice per request:
 * once directly (for the "Upcoming" rail) and once inside listActionItems (which
 * derives its overdue/due items from the same source). cache() memoizes on
 * householdId within a single request only, so the two callers now share one
 * resolution instead of issuing the same cross-region query twice. No behavior
 * change: same args, same result.
 */
export const listExpiringForHousehold = cache(async function listExpiringForHousehold(
  householdId: string,
): Promise<ExpiringItem[]> {
  const supabase = await createClient();
  const today = new Date();

  // Latest vaccine per (pet, family) so we don't show duplicates.
  const { data: vaccs } = await supabase
    .from("vaccinations")
    .select(
      "id, pet_id, vaccine_type, vaccine_family, administered_on, expires_on, is_rabies",
    )
    .eq("household_id", householdId)
    .not("expires_on", "is", null)
    .order("administered_on", { ascending: false });

  type V = {
    id: string;
    pet_id: string;
    vaccine_type: string;
    vaccine_family: string | null;
    administered_on: string;
    expires_on: string;
    is_rabies: boolean | null;
  };

  const latestPerFamily = new Map<string, V>();
  for (const v of (vaccs ?? []) as V[]) {
    const key = `${v.pet_id}:${v.vaccine_family ?? v.vaccine_type.toLowerCase()}`;
    const prev = latestPerFamily.get(key);
    if (!prev || v.administered_on > prev.administered_on) {
      latestPerFamily.set(key, v);
    }
  }

  const petIds = Array.from(
    new Set(Array.from(latestPerFamily.values()).map((v) => v.pet_id)),
  );

  const { data: policies } = await supabase
    .from("insurance_policies")
    .select("id, pet_id, insurer_name, plan_name, renews_on")
    .eq("household_id", householdId)
    .is("archived_at", null)
    .not("renews_on", "is", null);

  for (const p of policies ?? []) {
    if (p.pet_id && !petIds.includes(p.pet_id)) petIds.push(p.pet_id);
  }

  const petNameById = new Map<string, string>();
  if (petIds.length > 0) {
    const { data: pets } = await supabase
      .from("pets")
      .select("id, name")
      .in("id", petIds)
      .is("deleted_at", null);
    for (const p of pets ?? []) petNameById.set(p.id, p.name);
  }

  const items: ExpiringItem[] = [];

  for (const v of latestPerFamily.values()) {
    // Soft-deleted pet: its vaccination rows linger during the retention window
    // but must not surface. petNameById only holds live pets, so a miss = hidden.
    if (!petNameById.has(v.pet_id)) continue;
    const days = differenceInCalendarDays(parseISO(v.expires_on), today);
    items.push({
      kind: "vaccine",
      pet_id: v.pet_id,
      pet_name: petNameById.get(v.pet_id) ?? null,
      entity_id: v.id,
      title: v.vaccine_type,
      expires_on: v.expires_on,
      days_until: days,
      status: statusForDays(days),
      detail: `Last given ${v.administered_on}`,
      is_rabies: v.is_rabies === true,
    });
  }

  for (const p of (policies ?? []) as Array<{
    id: string;
    pet_id: string | null;
    insurer_name: string;
    plan_name: string | null;
    renews_on: string;
  }>) {
    // Pet-scoped policy on a soft-deleted pet is hidden too; household-level
    // policies (pet_id null) are unaffected.
    if (p.pet_id && !petNameById.has(p.pet_id)) continue;
    const days = differenceInCalendarDays(parseISO(p.renews_on), today);
    items.push({
      kind: "policy_renewal",
      pet_id: p.pet_id,
      pet_name: p.pet_id ? (petNameById.get(p.pet_id) ?? null) : null,
      entity_id: p.id,
      title: `${p.insurer_name}${p.plan_name ? ` · ${p.plan_name}` : ""}`,
      expires_on: p.renews_on,
      days_until: days,
      status: statusForDays(days),
      detail: "Insurance policy renews",
      is_rabies: false,
    });
  }

  items.sort((a, b) => a.days_until - b.days_until);
  return items;
});
