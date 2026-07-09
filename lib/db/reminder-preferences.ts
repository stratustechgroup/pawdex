import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { ReminderPreferences } from "@/lib/supabase/types";

export async function getReminderPreferences(
  householdId: string,
): Promise<ReminderPreferences | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("reminder_preferences")
    .select("*")
    .eq("household_id", householdId)
    .maybeSingle();
  if (error) throw new Error(`getReminderPreferences: ${error.message}`);
  return (data as ReminderPreferences | null) ?? null;
}

// Re-export presets/constants for ergonomic server-side imports. Client code
// should import from "@/lib/reminders/presets" directly.
export {
  TIMEZONE_OPTIONS,
  LEAD_DAY_PRESETS,
  presetFromDays,
  type LeadDayPreset,
} from "@/lib/reminders/presets";
