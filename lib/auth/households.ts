import "server-only";

import { createServiceClient } from "@/lib/supabase/service";
import type { HouseholdKind } from "@/lib/auth/active-household";

/**
 * Creates a brand-new household and makes the caller its owner. Unlike
 * bootstrapHousehold (which is idempotent and only fires when the user has no
 * household yet), this always inserts a fresh household. It backs the
 * "New household" flow where a user deliberately spins up a second one.
 *
 * Mirrors bootstrap.ts exactly: service-role insert of the household, an owner
 * membership accepted immediately, and a reminder_preferences row. The service
 * client is required because the owner membership must exist before RLS would
 * let the user read the household they just created.
 *
 * Validation (name length, per-user cap) lives at the call site so it can
 * return friendly errors; this helper assumes inputs are already clean.
 */
export async function createHousehold(params: {
  userId: string;
  name: string;
  kind: HouseholdKind;
}): Promise<{ householdId: string }> {
  const supabase = createServiceClient();

  const { data: hh, error: hhErr } = await supabase
    .from("households")
    .insert({ name: params.name, kind: params.kind, created_by: params.userId })
    .select("id")
    .single();

  if (hhErr || !hh) {
    throw new Error(`createHousehold: household insert failed: ${hhErr?.message}`);
  }

  const householdId = (hh as { id: string }).id;

  const { error: memErr } = await supabase
    .from("household_members")
    .insert({
      household_id: householdId,
      user_id: params.userId,
      role: "owner",
      accepted_at: new Date().toISOString(),
    });

  if (memErr) {
    throw new Error(`createHousehold: membership insert failed: ${memErr.message}`);
  }

  await supabase
    .from("reminder_preferences")
    .insert({ household_id: householdId })
    .select()
    .maybeSingle();

  return { householdId };
}
