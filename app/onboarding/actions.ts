"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { requireSession } from "@/lib/auth/household";
import { updateDisplayName } from "@/lib/auth/profile";
import {
  AUTHORIZATION_DESCRIPTORS,
  grantAuthorization,
} from "@/lib/auth/authorizations";
import { getOrCreateInboundAddress, inboxAddressFor } from "@/lib/db/inbound-addresses";
import {
  buildFirstYearPlan,
  remindableItems,
  type PlanSpecies,
} from "@/lib/clinical/first-year";
import { ONBOARDED_COOKIE } from "@/components/onboarding/constants";
import type { PetActionPayload } from "@/lib/schemas/pet";
import type { AuthorizationType } from "@/lib/supabase/types";

const RESEARCH_TYPE = "research_data_sharing" as AuthorizationType;

type Ok<T = unknown> = { ok: true } & T;
type Err = { ok: false; error: string };

/**
 * Step 1, save the display name (profiles) and rename the auto-created
 * household. The household already exists (bootstrap ran in the callback and
 * on the onboarding page), so this is a rename, done through the RLS client:
 * owners can update households.name under the households_update policy.
 */
export async function saveIdentity(input: {
  displayName: string;
  householdName: string;
}): Promise<Ok | Err> {
  const displayName = input.displayName.trim();
  const householdName = input.householdName.trim();
  if (!displayName) return { ok: false, error: "Tell us what to call you." };
  if (!householdName) return { ok: false, error: "Give your household a name." };

  const session = await requireSession();

  const nameResult = await updateDisplayName(session.userId, displayName);
  if (!nameResult.ok) return nameResult;

  const supabase = await createClient();
  const { error } = await supabase
    .from("households")
    .update({ name: householdName })
    .eq("id", session.householdId);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/", "layout");
  return { ok: true };
}

/**
 * Step 2, create the first pet. Mirrors the DB writes of the pets/new
 * createPet action (same columns, same revalidate) but RETURNS the new petId
 * instead of redirecting, so the wizard can advance in place. There is no
 * pets->animals insert trigger, so onboarding pets have no animal row; that is
 * fine (research consent stores a null animal_id).
 */
export async function createOnboardingPet(
  payload: PetActionPayload,
): Promise<(Ok & { petId: string }) | Err> {
  if (!payload.name) return { ok: false, error: "Name is required." };

  const session = await requireSession();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("pets")
    .insert({
      household_id: session.householdId,
      name: payload.name,
      species: payload.species,
      breed: payload.breed,
      sex: payload.sex,
      altered: payload.altered,
      date_of_birth: payload.date_of_birth,
      dob_is_estimated: payload.dob_is_estimated,
      acquired_on: payload.acquired_on,
      color: payload.color,
      markings: payload.markings,
      microchip_number: payload.microchip_number,
      microchip_registry: payload.microchip_registry,
      microchip_implanted_on: payload.microchip_implanted_on,
      current_weight_kg: payload.current_weight_kg,
      allergies: payload.allergies,
      notes: payload.notes,
      created_by: session.userId,
    })
    .select("id")
    .single();

  if (error || !data) {
    return { ok: false, error: error?.message ?? "Failed to create pet" };
  }

  revalidatePath("/", "layout");
  return { ok: true, petId: data.id };
}

/**
 * Step 3, research consent. Opting in grants the versioned authorization and
 * writes a household-level research_consents row (animal_id null), the same
 * path the transfer accept flow uses. Declining is a first-class no-op: nothing
 * is written, so a declined onboarding leaves zero consent rows. Idempotent,
 * re-submitting an opt-in won't duplicate the consent row.
 */
export async function setResearchConsent(input: {
  optIn: boolean;
}): Promise<(Ok & { granted: boolean }) | Err> {
  const session = await requireSession();

  if (!input.optIn) {
    return { ok: true, granted: false };
  }

  const descriptor = AUTHORIZATION_DESCRIPTORS[RESEARCH_TYPE];
  if (!descriptor) {
    // Descriptor missing → cannot honestly record consent. Don't half-write.
    return { ok: false, error: "Research consent is unavailable right now." };
  }

  const supabase = await createClient();
  try {
    const auth = await grantAuthorization({
      householdId: session.householdId,
      userId: session.userId,
      type: RESEARCH_TYPE,
    });

    // Only insert a consent row if this grant doesn't already have one.
    const { data: existing } = await supabase
      .from("research_consents")
      .select("id")
      .eq("household_id", session.householdId)
      .eq("authorization_id", auth.id)
      .is("animal_id", null)
      .maybeSingle();

    if (!existing) {
      const { error } = await supabase.from("research_consents").insert({
        household_id: session.householdId,
        animal_id: null,
        authorization_id: auth.id,
      });
      if (error) return { ok: false, error: error.message };
    }

    return { ok: true, granted: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Couldn't save consent.",
    };
  }
}

/**
 * Step 4c, turn the FUTURE-dated vaccine milestones of the first-year plan
 * into scheduled reminders. Only vaccine milestones that are still upcoming are
 * eligible: the reminders pipeline frames every row as a "vaccine coming due",
 * so a non-vaccine item (spay/neuter, heartworm) or a past milestone would send
 * a misleading email. Idempotent via the unique (entity_type, entity_id,
 * lead_days) index, entity_id is the pet, entity_type is a per-milestone slug.
 *
 * Returns how many were requested vs. actually created so the UI can be honest
 * about what it did.
 */
export async function scheduleFirstYearReminders(input: {
  petId: string;
  species: PlanSpecies;
  birthDate: string;
}): Promise<(Ok & { created: number; requested: number }) | Err> {
  const session = await requireSession();
  const supabase = await createClient();

  // Confirm the pet is in this household (RLS scoped) before writing.
  const { data: pet, error: petErr } = await supabase
    .from("pets")
    .select("id")
    .eq("id", input.petId)
    .eq("household_id", session.householdId)
    .maybeSingle();
  if (petErr) return { ok: false, error: petErr.message };
  if (!pet) return { ok: false, error: "Pet not found in your household." };

  const plan = buildFirstYearPlan({
    species: input.species,
    birthDate: input.birthDate,
  });
  if (!plan) return { ok: true, created: 0, requested: 0 };

  const items = remindableItems(plan);
  if (items.length === 0) return { ok: true, created: 0, requested: 0 };

  // Send the nudge a week AHEAD of each date: the copy promises advance notice,
  // and the point is to give time to book the visit. A milestone due within 7
  // days schedules in the past, so the cron sends it on its next run, still a
  // valid "coming due soon" heads-up. lead_days=7 also keeps the idempotency
  // key distinct from any real vaccination reminder for this pet.
  const LEAD_DAYS = 7;
  const rows = items.map((item) => {
    const scheduledFor = new Date(item.dueOn);
    scheduledFor.setDate(scheduledFor.getDate() - LEAD_DAYS);
    return {
      household_id: session.householdId,
      pet_id: input.petId,
      // entity_id is uuid NOT NULL; anchor on the pet. entity_type carries the
      // milestone identity so each milestone is a distinct idempotency key.
      entity_type: `plan_${item.key}`,
      entity_id: input.petId,
      due_on: item.dueOn,
      lead_days: LEAD_DAYS,
      channel: "email" as const,
      scheduled_for: scheduledFor.toISOString(),
      status: "scheduled" as const,
    };
  });

  const { data, error } = await supabase
    .from("reminders")
    .upsert(rows, {
      onConflict: "entity_type,entity_id,lead_days",
      ignoreDuplicates: true,
    })
    .select("id");

  if (error) return { ok: false, error: error.message };

  revalidatePath("/", "layout");
  return { ok: true, created: data?.length ?? 0, requested: rows.length };
}

/**
 * Step 4a, the household's inbound email address, get-or-create. Called lazily
 * when the user opens the "forward a vet email" card so we don't mint an
 * address for people who never open it.
 */
export async function getOnboardingInbox(): Promise<
  (Ok & { address: string }) | Err
> {
  const session = await requireSession();
  try {
    const row = await getOrCreateInboundAddress(session.householdId);
    return { ok: true, address: inboxAddressFor(row.slug) };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Couldn't load your inbox.",
    };
  }
}

/**
 * Step 4a polling, how many documents the household has, plus the newest one's
 * ids for a deep link. The wizard polls this on a modest interval while waiting
 * for a forwarded email to land.
 */
export async function getInboxStatus(): Promise<
  | (Ok & {
      documentsCount: number;
      latestDocumentId: string | null;
      latestPetId: string | null;
    })
  | Err
> {
  const session = await requireSession();
  const supabase = await createClient();

  const { count, error } = await supabase
    .from("documents")
    .select("id", { head: true, count: "exact" })
    .eq("household_id", session.householdId);
  if (error) return { ok: false, error: error.message };

  let latestDocumentId: string | null = null;
  let latestPetId: string | null = null;
  if ((count ?? 0) > 0) {
    const { data: latest } = await supabase
      .from("documents")
      .select("id, pet_id")
      .eq("household_id", session.householdId)
      .order("uploaded_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    latestDocumentId = latest?.id ?? null;
    latestPetId = latest?.pet_id ?? null;
  }

  return {
    ok: true,
    documentsCount: count ?? 0,
    latestDocumentId,
    latestPetId,
  };
}

/**
 * Finish (or skip). Writes the durable marker cookie so the callback stops
 * forcing onboarding. The client navigates to the dashboard afterward.
 */
export async function completeOnboarding(): Promise<Ok> {
  const jar = await cookies();
  jar.set(ONBOARDED_COOKIE, "1", {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    httpOnly: false,
    sameSite: "lax",
  });
  revalidatePath("/", "layout");
  return { ok: true };
}
