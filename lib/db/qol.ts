import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { QolEntry } from "@/lib/supabase/types";

// HHHHHMM dimensions in display order. Storage column names match keys.
export const QOL_DIMENSIONS = [
  {
    key: "hurt",
    label: "Hurt",
    helper: "Higher = less pain. Watch for panting, hiding, reluctance to move.",
  },
  {
    key: "hunger",
    label: "Hunger",
    helper: "Higher = eating normally. Note hand-feeding or appetite changes.",
  },
  {
    key: "hydration",
    label: "Hydration",
    helper:
      "Higher = drinking well. Lift the skin between shoulders — quick spring back = good.",
  },
  {
    key: "hygiene",
    label: "Hygiene",
    helper: "Higher = clean, dry, comfortable. Bedsores, soiling, mat-checking.",
  },
  {
    key: "happiness",
    label: "Happiness",
    helper:
      "Higher = engaged, responsive, interested. Tail wags, eye contact, play attempts.",
  },
  {
    key: "mobility",
    label: "Mobility",
    helper: "Higher = able to move on their own to eat, drink, eliminate.",
  },
  {
    key: "more_good",
    label: "More good days than bad",
    helper:
      "Looking back at the past week, did good days outnumber bad days? 10 = mostly good, 0 = mostly bad.",
  },
] as const;

export type QolDimensionKey = (typeof QOL_DIMENSIONS)[number]["key"];

export const QOL_MAX = QOL_DIMENSIONS.length * 10;

export function totalScore(entry: QolEntry): number {
  return (
    entry.hurt +
    entry.hunger +
    entry.hydration +
    entry.hygiene +
    entry.happiness +
    entry.mobility +
    entry.more_good
  );
}

export async function listQolEntriesForPet(
  householdId: string,
  petId: string,
  limit = 30,
): Promise<QolEntry[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("qol_entries")
    .select("*")
    .eq("household_id", householdId)
    .eq("pet_id", petId)
    .order("recorded_on", { ascending: false })
    .limit(limit);
  if (error) throw new Error(`listQolEntriesForPet: ${error.message}`);
  return (data ?? []) as QolEntry[];
}
