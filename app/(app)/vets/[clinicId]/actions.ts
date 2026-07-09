"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireSession } from "@/lib/auth/household";
import { createClient } from "@/lib/supabase/server";
import { diffOf, recordAudit } from "@/lib/db/audit";

export type UpdateClinicInput = {
  clinicId: string;
  name: string;
  phone: string | null;
  email: string | null;
  address_line1: string | null;
  website: string | null;
  notes: string | null;
};

type Result = { ok: true } | { ok: false; error: string };

export async function updateVetClinic(input: UpdateClinicInput): Promise<Result> {
  const session = await requireSession();
  if (!input.name.trim()) return { ok: false, error: "Clinic name is required." };

  const supabase = await createClient();

  const { data: existing, error: fetchErr } = await supabase
    .from("vet_clinics")
    .select("*")
    .eq("household_id", session.householdId)
    .eq("id", input.clinicId)
    .maybeSingle();
  if (fetchErr) return { ok: false, error: fetchErr.message };
  if (!existing) return { ok: false, error: "Clinic not found." };

  const update = {
    name: input.name.trim(),
    phone: blank(input.phone),
    email: blank(input.email),
    address_line1: blank(input.address_line1),
    website: blank(input.website),
    notes: blank(input.notes),
    verified_at: new Date().toISOString(),
    verified_source: "manual",
  };

  const { data: updated, error: updErr } = await supabase
    .from("vet_clinics")
    .update(update)
    .eq("household_id", session.householdId)
    .eq("id", input.clinicId)
    .select("*")
    .single();

  if (updErr || !updated) {
    return { ok: false, error: updErr?.message ?? "Update failed" };
  }

  await recordAudit({
    householdId: session.householdId,
    actorId: session.userId,
    action: "update",
    entityType: "vet_clinic",
    entityId: input.clinicId,
    diff: diffOf(
      pickFields(existing as Record<string, unknown>),
      pickFields(updated as Record<string, unknown>),
    ),
  });

  revalidatePath("/vets");
  revalidatePath(`/vets/${input.clinicId}`);
  return { ok: true };
}

export async function deleteVetClinic(clinicId: string): Promise<Result | never> {
  const session = await requireSession();
  if (session.role !== "owner") {
    return { ok: false, error: "Only the household owner can delete clinics." };
  }
  const supabase = await createClient();

  // Refuse if any rows still reference this clinic — guard against silent
  // orphans. The user should merge first.
  const [vacc, events, meds] = await Promise.all([
    supabase
      .from("vaccinations")
      .select("id", { head: true, count: "exact" })
      .eq("household_id", session.householdId)
      .eq("vet_clinic_id", clinicId),
    supabase
      .from("medical_events")
      .select("id", { head: true, count: "exact" })
      .eq("household_id", session.householdId)
      .eq("vet_clinic_id", clinicId),
    supabase
      .from("medications")
      .select("id", { head: true, count: "exact" })
      .eq("household_id", session.householdId)
      .eq("vet_clinic_id", clinicId),
  ]);
  const refs =
    (vacc.count ?? 0) + (events.count ?? 0) + (meds.count ?? 0);
  if (refs > 0) {
    return {
      ok: false,
      error: `Can't delete — ${refs} records still reference this clinic. Merge into another clinic first.`,
    };
  }

  const { error } = await supabase
    .from("vet_clinics")
    .delete()
    .eq("household_id", session.householdId)
    .eq("id", clinicId);

  if (error) return { ok: false, error: error.message };

  await recordAudit({
    householdId: session.householdId,
    actorId: session.userId,
    action: "delete",
    entityType: "vet_clinic",
    entityId: clinicId,
  });

  revalidatePath("/vets");
  redirect("/vets");
}

function blank(v: string | null): string | null {
  if (v === null || v === undefined) return null;
  const t = v.trim();
  return t === "" ? null : t;
}

const TRACKED = [
  "name",
  "phone",
  "email",
  "address_line1",
  "website",
  "notes",
] as const;

function pickFields(row: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const k of TRACKED) out[k] = row[k] ?? null;
  return out;
}
