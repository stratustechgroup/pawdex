"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { requireSession } from "@/lib/auth/household";
import { bootstrapHousehold } from "@/lib/auth/bootstrap";
import {
  AUTHORIZATION_DESCRIPTORS,
  grantAuthorization,
} from "@/lib/auth/authorizations";
import { acceptTransfer, lookupTransferByToken } from "@/lib/db/transfers";
import { recordAudit } from "@/lib/db/audit";
import type { AuthorizationType } from "@/lib/supabase/types";

type AcceptResult =
  | { ok: true; petId: string | null }
  | { ok: false; error: string };

const RESEARCH_TYPE = "research_data_sharing" as AuthorizationType;

export async function acceptTransferAction(
  rawToken: string,
  contributeResearch: boolean,
): Promise<AcceptResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, error: "Sign in to accept this transfer." };
  }

  // Re-validate the token server-side: pending, unexpired, not revoked/declined.
  const transfer = await lookupTransferByToken(rawToken);
  if (!transfer) {
    return {
      ok: false,
      error: "This transfer link is no longer valid. Ask the sender for a fresh one.",
    };
  }

  const service = createServiceClient();

  // Receive into the user's ACTIVE household. If they already belong to one,
  // reuse it (requireSession resolves the same household the pets page will,
  // including once it becomes cookie/active aware) so the post-accept redirect
  // never 404s. Only brand-new users get a freshly bootstrapped household.
  let householdId: string;
  try {
    const { data: memberships } = await service
      .from("household_members")
      .select("household_id")
      .eq("user_id", user.id)
      .limit(1);
    if (memberships && memberships.length > 0) {
      householdId = (await requireSession()).householdId;
    } else {
      const displayName =
        (user.user_metadata?.full_name as string | undefined)?.trim() || null;
      householdId = (
        await bootstrapHousehold({ userId: user.id, displayName })
      ).householdId;
    }

    // Atomic ownership + record move (service role, security-definer RPC).
    await acceptTransfer({
      transferId: transfer.id,
      animalId: transfer.animal_id,
      toHouseholdId: householdId,
      acceptedBy: user.id,
    });
  } catch (err) {
    console.error("acceptTransferAction failed:", err);
    return {
      ok: false,
      error:
        "We couldn't complete this transfer. It may have just been revoked or already accepted. Refresh and try again.",
    };
  }

  // If the animal came from a litter, mark it placed now that it has landed.
  const { data: animal } = await service
    .from("animals")
    .select("litter_id")
    .eq("id", transfer.animal_id)
    .maybeSingle();
  if (animal?.litter_id) {
    await service
      .from("animals")
      .update({ placement_status: "placed" })
      .eq("id", transfer.animal_id);
  }

  // Optional research opt-in. Runs through the real versioned consent path only
  // when the descriptor exists; otherwise it is a safe no-op (deferred) rather
  // than a half-written consent record.
  if (contributeResearch) {
    const descriptor = AUTHORIZATION_DESCRIPTORS[RESEARCH_TYPE] as
      | (typeof AUTHORIZATION_DESCRIPTORS)[AuthorizationType]
      | undefined;
    if (descriptor) {
      try {
        const auth = await grantAuthorization({
          householdId,
          userId: user.id,
          type: RESEARCH_TYPE,
        });
        await service.from("research_consents").insert({
          household_id: householdId,
          animal_id: transfer.animal_id,
          authorization_id: auth.id,
        });
      } catch (err) {
        // Consent is optional; never block the transfer on it.
        console.error("research consent capture failed:", err);
      }
    }
  }

  // Resolve the new pet row (in the receiving household) for a clean redirect.
  const { data: pet } = await service
    .from("pets")
    .select("id")
    .eq("animal_id", transfer.animal_id)
    .eq("household_id", householdId)
    .maybeSingle();

  revalidatePath("/");
  return { ok: true, petId: pet?.id ?? null };
}

export async function declineTransferAction(
  rawToken: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const transfer = await lookupTransferByToken(rawToken);
  if (!transfer) {
    return { ok: false, error: "This transfer link is no longer active." };
  }

  const service = createServiceClient();
  const { error } = await service
    .from("animal_transfers")
    .update({ declined_at: new Date().toISOString() })
    .eq("id", transfer.id)
    .is("accepted_at", null)
    .is("revoked_at", null);
  if (error) return { ok: false, error: error.message };

  await recordAudit({
    householdId: transfer.from_household_id,
    actorId: null,
    action: "update",
    entityType: "animal_transfer",
    entityId: transfer.id,
    diff: { after: { declined: true } },
  });

  return { ok: true };
}
