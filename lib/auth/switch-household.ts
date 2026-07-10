"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { ACTIVE_HOUSEHOLD_COOKIE } from "@/lib/auth/active-household";

const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

/**
 * Sets the active household for the current user. Validates that the user has
 * an accepted membership in the target household before writing the cookie, so
 * a crafted request can never point someone at a household they can't reach.
 * Redirects to home afterward: the previous page may reference resources that
 * belong to the household we just switched away from.
 */
export async function switchHousehold(householdId: string): Promise<void> {
  if (!householdId) {
    throw new Error("switchHousehold: missing household id.");
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }

  const { data: membership, error } = await supabase
    .from("household_members")
    .select("household_id")
    .eq("user_id", user.id)
    .eq("household_id", householdId)
    .not("accepted_at", "is", null)
    .maybeSingle();

  if (error) {
    throw new Error(`switchHousehold: ${error.message}`);
  }
  if (!membership) {
    throw new Error("You don't have access to that household.");
  }

  const cookieStore = await cookies();
  cookieStore.set(ACTIVE_HOUSEHOLD_COOKIE, householdId, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: ONE_YEAR_SECONDS,
  });

  revalidatePath("/", "layout");
  redirect("/");
}
