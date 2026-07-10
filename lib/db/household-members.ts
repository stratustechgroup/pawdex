import "server-only";

import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import type {
  HouseholdInvitation,
  HouseholdMember,
} from "@/lib/supabase/types";

export type MemberWithEmail = HouseholdMember & {
  email: string | null;
  display_name: string | null;
  is_self: boolean;
};

/**
 * List household members along with the auth email for each. Uses the service
 * client to resolve emails (auth.users isn't queryable from anon/authenticated).
 */
export async function listHouseholdMembers(
  householdId: string,
  currentUserId: string,
): Promise<MemberWithEmail[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("household_members")
    .select("*")
    .eq("household_id", householdId)
    .order("invited_at", { ascending: true });
  if (error) throw new Error(`listHouseholdMembers: ${error.message}`);

  const rows = (data ?? []) as HouseholdMember[];
  if (rows.length === 0) return [];

  const service = createServiceClient();
  const { data: users } = await service.auth.admin.listUsers({ perPage: 1000 });
  const emailById = new Map<string, string | null>();
  for (const u of users?.users ?? []) emailById.set(u.id, u.email ?? null);

  // Display names come from profiles (service client, so RLS never hides a
  // fellow member's name). A missing row falls back to null → email downstream.
  const { data: profiles } = await service
    .from("profiles")
    .select("id, display_name")
    .in("id", rows.map((m) => m.user_id));
  const nameById = new Map<string, string | null>();
  for (const p of profiles ?? []) nameById.set(p.id, p.display_name ?? null);

  return rows.map((m) => ({
    ...m,
    email: emailById.get(m.user_id) ?? null,
    display_name: nameById.get(m.user_id) ?? null,
    is_self: m.user_id === currentUserId,
  }));
}

export async function listPendingInvitations(
  householdId: string,
): Promise<HouseholdInvitation[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("household_invitations")
    .select("*")
    .eq("household_id", householdId)
    .is("accepted_at", null)
    .is("revoked_at", null)
    .order("created_at", { ascending: false });
  if (error) throw new Error(`listPendingInvitations: ${error.message}`);
  return (data ?? []) as HouseholdInvitation[];
}
