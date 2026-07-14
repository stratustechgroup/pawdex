import "server-only";

import { createClient } from "@/lib/supabase/server";
import { isMedicationActive } from "@/lib/utils";
import { listExpiringForHousehold } from "@/lib/db/expiring";
import { listPetsForHousehold, type PetWithStatus } from "@/lib/db/pets";

/**
 * Per-pet vitals for the cockpit health tiles. Aggregated over tables the app
 * already reads (weight_log, medications, insurance_policies) plus the vaccine
 * status that `listPetsForHousehold` computes. No new capture.
 */
export type PetVitals = {
  pet: PetWithStatus;
  latestWeightKg: number | null;
  latestWeightOn: string | null;
  /** Chronological kg readings (older to newer), trimmed for the sparkline. */
  weightSeries: number[];
  weightTrend: "up" | "down" | "flat" | null;
  activeMedCount: number;
  hasInsurance: boolean;
  insurerName: string | null;
};

const SPARK_MAX_POINTS = 16;

export async function listPetVitals(householdId: string): Promise<PetVitals[]> {
  const supabase = await createClient();

  // The weight/meds/policy reads are household-scoped, not pet-scoped, so they
  // don't depend on the pets list — run all four together instead of blocking
  // the three aggregates behind listPetsForHousehold. (Trade-off: a household
  // with zero pets now issues three empty reads instead of short-circuiting,
  // which is negligible and rare next to the round trip saved on every loaded
  // dashboard.)
  const [pets, weightRes, medsRes, policyRes] = await Promise.all([
    listPetsForHousehold(householdId),
    supabase
      .from("weight_log")
      .select("pet_id, recorded_on, weight_kg")
      .eq("household_id", householdId)
      .order("recorded_on", { ascending: true }),
    supabase
      .from("medications")
      .select("pet_id, ended_on")
      .eq("household_id", householdId),
    supabase
      .from("insurance_policies")
      .select("pet_id, insurer_name")
      .eq("household_id", householdId)
      .is("archived_at", null),
  ]);

  if (pets.length === 0) return [];

  const weightByPet = new Map<string, { on: string; kg: number }[]>();
  for (const w of weightRes.data ?? []) {
    const arr = weightByPet.get(w.pet_id) ?? [];
    arr.push({ on: w.recorded_on, kg: Number(w.weight_kg) });
    weightByPet.set(w.pet_id, arr);
  }

  const activeMedByPet = new Map<string, number>();
  for (const m of medsRes.data ?? []) {
    if (isMedicationActive(m.ended_on)) {
      activeMedByPet.set(m.pet_id, (activeMedByPet.get(m.pet_id) ?? 0) + 1);
    }
  }

  const policyByPet = new Map<string, string>();
  for (const p of policyRes.data ?? []) {
    if (p.pet_id && !policyByPet.has(p.pet_id)) {
      policyByPet.set(p.pet_id, p.insurer_name);
    }
  }

  return pets.map((pet) => {
    const series = weightByPet.get(pet.id) ?? [];
    const latest = series.length > 0 ? series[series.length - 1] : null;
    const sparkPoints = series.slice(-SPARK_MAX_POINTS).map((s) => s.kg);
    let trend: PetVitals["weightTrend"] = null;
    if (series.length >= 2) {
      const a = series[series.length - 2].kg;
      const b = series[series.length - 1].kg;
      const delta = b - a;
      const threshold = Math.max(0.05, a * 0.005); // ignore sub-0.5% noise
      trend = delta > threshold ? "up" : delta < -threshold ? "down" : "flat";
    }
    return {
      pet,
      latestWeightKg: latest?.kg ?? pet.current_weight_kg ?? null,
      latestWeightOn: latest?.on ?? null,
      weightSeries: sparkPoints,
      weightTrend: trend,
      activeMedCount: activeMedByPet.get(pet.id) ?? 0,
      hasInsurance: policyByPet.has(pet.id),
      insurerName: policyByPet.get(pet.id) ?? null,
    };
  });
}

/**
 * One thing that needs the owner's attention now. Every item is a NAVIGATION
 * into an existing capture route, never a mutation: the cockpit surfaces the
 * deadline and hands the owner to the screen where they act on it.
 */
export type ActionItem = {
  id: string;
  severity: "overdue" | "due" | "attention";
  icon: string;
  title: string;
  petName: string | null;
  petId: string | null;
  href: string;
  cta: string;
  /** Sort key: lower is more urgent. */
  sortKey: number;
};

const SEVERITY_RANK: Record<ActionItem["severity"], number> = {
  overdue: 0,
  due: 1000,
  attention: 2000,
};

/** Normalize em-dashes (banned by house rule) to a middot. */
export function cleanTitle(s: string): string {
  return s.replace(/\s*—\s*/g, " · ");
}

/**
 * Aggregate everything that needs doing now, severity-ordered, from real data:
 *   - overdue / due-soon vaccines and insurance renewals (via the same
 *     `listExpiringForHousehold` that powers /expiring, the single source)
 *   - documents extracted and waiting for review (or unfiled in the inbox)
 *   - outgoing ownership transfers still waiting on the new owner
 */
export async function listActionItems(householdId: string): Promise<ActionItem[]> {
  const supabase = await createClient();

  const [expiring, docsRes, transfersRes, petsRes] = await Promise.all([
    listExpiringForHousehold(householdId),
    supabase
      .from("documents")
      .select("id, original_filename, doc_type, processing_status, pet_id")
      .eq("household_id", householdId)
      .in("processing_status", ["extracted"])
      .order("uploaded_at", { ascending: false }),
    supabase
      .from("animal_transfers")
      .select("id, animal_id, recipient_email, expires_at")
      .eq("from_household_id", householdId)
      .is("accepted_at", null)
      .is("revoked_at", null)
      .is("declined_at", null)
      .gt("expires_at", new Date().toISOString()),
    supabase
      .from("pets")
      .select("id, name, animal_id")
      .eq("household_id", householdId)
      .is("deleted_at", null),
  ]);

  const petIdByAnimalId = new Map<string, { id: string; name: string }>();
  for (const p of petsRes.data ?? []) {
    if (p.animal_id) petIdByAnimalId.set(p.animal_id, { id: p.id, name: p.name });
  }

  const items: ActionItem[] = [];

  for (const e of expiring) {
    if (e.status !== "overdue" && e.status !== "due_soon") continue;
    const severity: ActionItem["severity"] =
      e.status === "overdue" ? "overdue" : "due";
    const href =
      e.kind === "vaccine" && e.pet_id
        ? `/pets/${e.pet_id}/vaccines`
        : e.kind === "policy_renewal"
          ? "/insurance"
          : "/expiring";
    // Some upstream titles (policy names) carry an em-dash; the house rule bans
    // them, so normalize to a middot at the render boundary.
    const label = cleanTitle(e.title);
    const title =
      e.days_until < 0
        ? `${label} expired ${Math.abs(e.days_until)}d ago`
        : e.days_until === 0
          ? `${label} expires today`
          : `${label} in ${e.days_until}d`;
    items.push({
      id: `${e.kind}-${e.entity_id}`,
      severity,
      icon: e.kind === "policy_renewal" ? "shield" : "syringe",
      title,
      petName: e.pet_name,
      petId: e.pet_id,
      href,
      cta: e.kind === "policy_renewal" ? "Review" : "Update",
      sortKey: SEVERITY_RANK[severity] + e.days_until,
    });
  }

  for (const d of docsRes.data ?? []) {
    const href = d.pet_id
      ? `/pets/${d.pet_id}/documents/${d.id}/review`
      : "/inbox";
    items.push({
      id: `doc-${d.id}`,
      severity: "attention",
      icon: "fileText",
      title: d.pet_id
        ? "Document ready to review"
        : "Document waiting to be filed",
      petName: null,
      petId: d.pet_id,
      href,
      cta: "Review",
      sortKey: SEVERITY_RANK.attention,
    });
  }

  for (const t of transfersRes.data ?? []) {
    const pet = petIdByAnimalId.get(t.animal_id);
    items.push({
      id: `transfer-${t.id}`,
      severity: "attention",
      icon: "refresh",
      title: "Transfer waiting on the new owner",
      petName: pet?.name ?? null,
      petId: pet?.id ?? null,
      href: pet ? `/pets/${pet.id}/transfer` : "/pets",
      cta: "View",
      sortKey: SEVERITY_RANK.attention + 1,
    });
  }

  items.sort((a, b) => a.sortKey - b.sortKey);
  return items;
}

/**
 * Map of pet id -> litter name, for breeder households that want their tiles
 * grouped by litter. Pets link to a canonical animal (pets.animal_id), animals
 * carry litter_id, litters carry the name. Returns an empty map when nothing is
 * grouped, so a personal household renders a flat grid untouched.
 */
export async function listPetLitterLabels(
  householdId: string,
): Promise<Map<string, string>> {
  const supabase = await createClient();
  const { data: pets } = await supabase
    .from("pets")
    .select("id, animal_id")
    .eq("household_id", householdId)
    .is("archived_at", null)
    .is("deleted_at", null)
    .not("animal_id", "is", null);

  const animalIds = (pets ?? [])
    .map((p) => p.animal_id)
    .filter((a): a is string => Boolean(a));
  if (animalIds.length === 0) return new Map();

  const { data: animals } = await supabase
    .from("animals")
    .select("id, litter_id")
    .in("id", animalIds)
    .not("litter_id", "is", null);

  const litterIds = Array.from(
    new Set((animals ?? []).map((a) => a.litter_id).filter((l): l is string => Boolean(l))),
  );
  if (litterIds.length === 0) return new Map();

  const { data: litters } = await supabase
    .from("litters")
    .select("id, name")
    .in("id", litterIds);
  const litterNameById = new Map((litters ?? []).map((l) => [l.id, l.name]));

  const animalLitter = new Map(
    (animals ?? []).map((a) => [a.id, a.litter_id as string]),
  );
  const out = new Map<string, string>();
  for (const p of pets ?? []) {
    if (!p.animal_id) continue;
    const litterId = animalLitter.get(p.animal_id);
    if (!litterId) continue;
    const name = litterNameById.get(litterId);
    if (name) out.set(p.id, name);
  }
  return out;
}

/** Lightweight pets list for the command palette / quick-add (no vaccine join). */
export type NavPet = { id: string; name: string; species: string };

export async function listPetsForNav(householdId: string): Promise<NavPet[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("pets")
    .select("id, name, species")
    .eq("household_id", householdId)
    .is("archived_at", null)
    .is("deleted_at", null)
    .order("created_at", { ascending: true });
  return (data ?? []) as NavPet[];
}
