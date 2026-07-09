"use server";

import { revalidatePath } from "next/cache";

import { requireSession } from "@/lib/auth/household";

/**
 * Dev-only: POST to the Edge Function manually so the user can verify the
 * cron flow without waiting for the daily schedule. Owners only.
 *
 * Reads CRON_SECRET from the Next env so the developer has it locally — in
 * production this stays on the Edge Function side. If your local CRON_SECRET
 * differs from the one set in Supabase Edge Function secrets, this will 401.
 */
export async function runRemindersNow(): Promise<{
  ok: true;
  result: unknown;
} | { ok: false; error: string }> {
  const session = await requireSession();
  if (session.role !== "owner") {
    return { ok: false, error: "Owners only." };
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const cronSecret = process.env.CRON_SECRET;
  if (!supabaseUrl) return { ok: false, error: "Missing NEXT_PUBLIC_SUPABASE_URL" };
  if (!cronSecret) {
    return {
      ok: false,
      error:
        "CRON_SECRET not set locally. Add it to .env.local (matching the secret on the Edge Function).",
    };
  }

  try {
    const res = await fetch(`${supabaseUrl}/functions/v1/reminders-cron`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${cronSecret}`,
      },
      body: JSON.stringify({ triggered_at: new Date().toISOString(), manual: true }),
    });

    const text = await res.text();
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = text;
    }

    if (!res.ok) {
      return {
        ok: false,
        error: `Edge Function returned ${res.status}: ${typeof parsed === "string" ? parsed : JSON.stringify(parsed)}`,
      };
    }

    revalidatePath("/reminders");
    return { ok: true, result: parsed };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
