import "server-only";

import { differenceInCalendarDays, parseISO } from "date-fns";

import { createClient } from "@/lib/supabase/server";
import { kgToLbs } from "@/lib/utils";

/**
 * A derived, descriptive observation for the dashboard. Every insight is
 * deterministic and cited: it names the exact records it was computed from and
 * links back to them. It never prescribes or diagnoses (roadmap tone rule:
 * Pawdex surfaces and defers to the vet). When nothing true can be said, the
 * list is empty and the card is not rendered.
 */
export type Insight = {
  id: string;
  petId: string;
  petName: string;
  tone: "watch" | "info";
  icon: string;
  headline: string;
  /** Human citation, e.g. "12.4 lb on Mar 3 → 11.3 lb on Jun 18, 2 of 5 entries". */
  citation: string;
  href: string;
};

type WeightRow = {
  pet_id: string;
  recorded_on: string;
  weight_kg: number;
};

const ADULT_AGE_MONTHS = 12;

function ageInMonths(dob: string | null): number | null {
  if (!dob) return null;
  const birth = parseISO(dob);
  if (Number.isNaN(birth.getTime())) return null;
  const now = new Date();
  return (
    (now.getFullYear() - birth.getFullYear()) * 12 +
    (now.getMonth() - birth.getMonth())
  );
}

function fmtDate(iso: string): string {
  return parseISO(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/**
 * Compute the honest set of dashboard insights. Currently one family:
 * weight movement. Direction and age are load-bearing so the observation is
 * true, not alarming:
 *   - Weight LOSS of >=5% between the earliest and latest reading in a window
 *     that spans real time is surfaced for any pet (loss is notable at any age).
 *   - Weight GAIN of >=10% is surfaced only for adults (>=12 months). A growing
 *     puppy or kitten gaining weight is expected, not a signal, so we stay quiet
 *     rather than raise a false alarm.
 * Both require at least two readings spanning >=21 days and cite the two
 * endpoints and how many entries the pet has.
 */
export async function listInsightsForHousehold(
  householdId: string,
): Promise<Insight[]> {
  const supabase = await createClient();

  const [petsRes, weightRes] = await Promise.all([
    supabase
      .from("pets")
      .select("id, name, date_of_birth")
      .eq("household_id", householdId)
      .is("archived_at", null)
      .is("deleted_at", null),
    supabase
      .from("weight_log")
      .select("pet_id, recorded_on, weight_kg")
      .eq("household_id", householdId)
      .order("recorded_on", { ascending: true }),
  ]);

  const pets = petsRes.data ?? [];
  const petById = new Map(pets.map((p) => [p.id, p]));

  const byPet = new Map<string, WeightRow[]>();
  for (const w of (weightRes.data ?? []) as WeightRow[]) {
    const arr = byPet.get(w.pet_id) ?? [];
    arr.push(w);
    byPet.set(w.pet_id, arr);
  }

  const insights: Insight[] = [];

  for (const [petId, rows] of byPet.entries()) {
    const pet = petById.get(petId);
    if (!pet || rows.length < 2) continue;

    const first = rows[0];
    const last = rows[rows.length - 1];
    const spanDays = differenceInCalendarDays(
      parseISO(last.recorded_on),
      parseISO(first.recorded_on),
    );
    if (spanDays < 21) continue;
    if (first.weight_kg <= 0) continue;

    const pct = ((last.weight_kg - first.weight_kg) / first.weight_kg) * 100;
    const months = ageInMonths(pet.date_of_birth);
    const isAdult = months === null || months >= ADULT_AGE_MONTHS;

    let surfaced = false;
    let tone: Insight["tone"] = "info";
    let headline = "";
    if (pct <= -5) {
      surfaced = true;
      tone = "watch";
      headline = `${pet.name} is down ${Math.abs(Math.round(pct))}% since ${fmtDate(
        first.recorded_on,
      )}`;
    } else if (pct >= 10 && isAdult) {
      surfaced = true;
      tone = "watch";
      headline = `${pet.name} is up ${Math.round(pct)}% since ${fmtDate(
        first.recorded_on,
      )}`;
    }
    if (!surfaced) continue;

    const citation = `${kgToLbs(first.weight_kg)} lb on ${fmtDate(
      first.recorded_on,
    )} to ${kgToLbs(last.weight_kg)} lb on ${fmtDate(last.recorded_on)}, ${
      rows.length
    } weigh-ins on record`;

    insights.push({
      id: `weight-${petId}`,
      petId,
      petName: pet.name,
      tone,
      icon: pct < 0 ? "trendDown" : "trendUp",
      headline,
      citation,
      href: `/pets/${petId}/weight`,
    });
  }

  return insights;
}
