import "server-only";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

export type Session = {
  userId: string;
  email: string | null;
  householdId: string;
  householdName: string;
  role: "owner" | "member" | "viewer";
};

/**
 * Resolves the authenticated user's primary household for Server Components.
 * Redirects to /login if unauthenticated, /onboarding if no household yet.
 */
export async function requireSession(): Promise<Session> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: memberRows, error: memberErr } = await supabase
    .from("household_members")
    .select("household_id, role")
    .eq("user_id", user.id)
    .order("invited_at", { ascending: true })
    .limit(1);

  if (memberErr) {
    throw new Error(`requireSession member: ${memberErr.message}`);
  }

  const member = memberRows?.[0];
  if (!member) {
    redirect("/onboarding");
  }

  const { data: household, error: hhErr } = await supabase
    .from("households")
    .select("id, name")
    .eq("id", member.household_id)
    .maybeSingle();

  if (hhErr) {
    throw new Error(`requireSession household: ${hhErr.message}`);
  }
  if (!household) {
    redirect("/onboarding");
  }

  return {
    userId: user.id,
    email: user.email ?? null,
    householdId: household.id,
    householdName: household.name,
    role: member.role,
  };
}
