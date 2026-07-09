"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { hashToken } from "@/lib/auth/invitations";
import { recordAudit } from "@/lib/db/audit";

type AcceptResult =
  | { ok: true; householdId: string }
  | { ok: false; error: string };

export async function acceptInvitation(rawToken: string): Promise<AcceptResult> {
  if (!rawToken) return { ok: false, error: "Missing invitation token." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, error: "Sign in to accept this invitation." };
  }

  // Use service client to bypass RLS — household_invitations RLS allows only
  // members of that household to read, and the invitee isn't a member yet.
  const service = createServiceClient();
  const tokenHash = hashToken(rawToken);

  const { data: invitation, error: fetchErr } = await service
    .from("household_invitations")
    .select("*")
    .eq("token_hash", tokenHash)
    .maybeSingle();

  if (fetchErr || !invitation) {
    return { ok: false, error: "This invitation is invalid or has been removed." };
  }
  if (invitation.revoked_at) {
    return { ok: false, error: "This invitation was revoked." };
  }
  if (invitation.accepted_at) {
    return { ok: false, error: "This invitation has already been accepted." };
  }
  if (new Date(invitation.expires_at).getTime() < Date.now()) {
    return { ok: false, error: "This invitation has expired. Ask for a fresh one." };
  }

  // If the user is already a member of this household, just route them home.
  const { data: existing } = await service
    .from("household_members")
    .select("user_id")
    .eq("household_id", invitation.household_id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!existing) {
    const { error: insErr } = await service.from("household_members").insert({
      household_id: invitation.household_id,
      user_id: user.id,
      role: invitation.role,
      accepted_at: new Date().toISOString(),
    });
    if (insErr) {
      return { ok: false, error: insErr.message };
    }
  }

  await service
    .from("household_invitations")
    .update({
      accepted_at: new Date().toISOString(),
      accepted_by: user.id,
    })
    .eq("id", invitation.id);

  await recordAudit({
    householdId: invitation.household_id,
    actorId: user.id,
    action: "accept_invitation",
    entityType: "household_invitation",
    entityId: invitation.id,
    diff: { after: { user_id: user.id, role: invitation.role } },
  });

  revalidatePath("/");
  revalidatePath("/settings/household");
  return { ok: true, householdId: invitation.household_id };
}
