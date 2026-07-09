"use server";

import { revalidatePath } from "next/cache";

import { requireSession } from "@/lib/auth/household";
import { createClient } from "@/lib/supabase/server";
import {
  LEAD_DAY_PRESETS,
  TIMEZONE_OPTIONS,
} from "@/lib/db/reminder-preferences";

export type SaveReminderPrefsInput = {
  email_enabled: boolean;
  email_address: string;
  preset: keyof typeof LEAD_DAY_PRESETS;
  timezone: string;
  auto_request_records: boolean;
  auto_request_lead_days: number;
};

export type SaveReminderPrefsResult =
  | { ok: true }
  | { ok: false; error: string };

export async function saveReminderPreferences(
  input: SaveReminderPrefsInput,
): Promise<SaveReminderPrefsResult> {
  const session = await requireSession();

  // Sanity check inputs — server-side enforcement on top of the form's
  // client-side controls.
  if (!Object.keys(LEAD_DAY_PRESETS).includes(input.preset)) {
    return { ok: false, error: "Unknown reminder preset." };
  }
  if (!(TIMEZONE_OPTIONS as readonly string[]).includes(input.timezone)) {
    return { ok: false, error: "Unknown timezone." };
  }
  const emailAddress = input.email_address.trim();
  if (emailAddress && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailAddress)) {
    return { ok: false, error: "Email override doesn't look valid." };
  }
  const leadDays = Math.round(input.auto_request_lead_days);
  if (!Number.isFinite(leadDays) || leadDays < 0 || leadDays > 30) {
    return {
      ok: false,
      error: "Auto-request lead time must be between 0 and 30 days.",
    };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("reminder_preferences")
    .upsert(
      {
        household_id: session.householdId,
        email_enabled: input.email_enabled,
        email_address: emailAddress || null,
        vaccine_lead_days: [...LEAD_DAY_PRESETS[input.preset].days],
        timezone: input.timezone,
        auto_request_records: input.auto_request_records,
        auto_request_lead_days: leadDays,
      },
      { onConflict: "household_id" },
    );

  if (error) return { ok: false, error: error.message };

  revalidatePath("/settings");
  return { ok: true };
}
