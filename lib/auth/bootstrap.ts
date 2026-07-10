import "server-only";

import { createServiceClient } from "@/lib/supabase/service";
import { pickDefaultMembership } from "@/lib/auth/active-household";

/**
 * Idempotent: if the user already belongs to at least one household, returns
 * their default one (earliest accepted membership, matching requireSession's
 * fallback so both agree on the "primary" household). Otherwise creates a
 * household named "{display}'s Household" and adds the user as owner.
 *
 * Uses the service-role client because creating the first household requires
 * inserting into household_members before the user has any rows that RLS
 * would let them see.
 */
export async function bootstrapHousehold(params: {
  userId: string;
  displayName: string | null;
}): Promise<{ householdId: string }> {
  const supabase = createServiceClient();

  const { data: existing, error: existingErr } = await supabase
    .from("household_members")
    .select("household_id, role, accepted_at, invited_at")
    .eq("user_id", params.userId);

  if (existingErr) {
    throw new Error(`bootstrap: lookup failed — ${existingErr.message}`);
  }

  const primary = pickDefaultMembership(existing ?? []);
  if (primary) {
    return { householdId: primary.household_id };
  }

  const name = params.displayName?.trim()
    ? `${params.displayName.trim()}'s Household`
    : "My Household";

  const { data: hh, error: hhErr } = await supabase
    .from("households")
    .insert({ name, created_by: params.userId })
    .select("id")
    .single();

  if (hhErr || !hh) {
    throw new Error(`bootstrap: household insert failed — ${hhErr?.message}`);
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
    throw new Error(`bootstrap: membership insert failed — ${memErr.message}`);
  }

  await supabase
    .from("reminder_preferences")
    .insert({ household_id: householdId })
    .select()
    .maybeSingle();

  return { householdId };
}
