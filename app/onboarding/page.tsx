import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { bootstrapHousehold } from "@/lib/auth/bootstrap";
import { requireSession } from "@/lib/auth/household";

import { OnboardingWizard } from "@/components/onboarding/onboarding-wizard";

export const metadata = { title: "Welcome, Pawdex" };
export const dynamic = "force-dynamic";

/** "The Farmer household" from a display name; falls back gracefully. */
function suggestHouseholdName(displayName: string | null, email: string | null): string {
  const source = (displayName ?? email?.split("@")[0] ?? "").trim();
  const tokens = source.split(/[\s._-]+/).filter(Boolean);
  const last = tokens.length > 1 ? tokens[tokens.length - 1] : tokens[0];
  if (!last) return "My household";
  const cap = last.charAt(0).toUpperCase() + last.slice(1);
  return `The ${cap} household`;
}

export default async function OnboardingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Idempotent, creates the auto-household on first visit, returns the
  // existing one otherwise. Same call the auth callback makes.
  try {
    await bootstrapHousehold({
      userId: user.id,
      displayName:
        (user.user_metadata?.full_name as string | undefined) ??
        (user.email ? user.email.split("@")[0] : null),
    });
  } catch (err) {
    return (
      <main className="flex flex-1 items-center justify-center px-6 py-12">
        <div className="max-w-md text-center space-y-3">
          <h1 className="text-xl font-semibold">Couldn&apos;t set up your account</h1>
          <p className="text-muted-foreground text-sm">
            {err instanceof Error ? err.message : "Unknown error"}
          </p>
          <p className="text-muted-foreground text-xs">
            Try refreshing the page. If this persists, check that the database migrations have
            been applied.
          </p>
        </div>
      </main>
    );
  }

  const session = await requireSession();

  const prefillDisplayName =
    session.displayName?.trim() ||
    (user.user_metadata?.full_name as string | undefined)?.trim() ||
    "";

  return (
    <OnboardingWizard
      householdId={session.householdId}
      initialDisplayName={prefillDisplayName}
      initialHouseholdName={session.householdName}
      suggestedHouseholdName={suggestHouseholdName(session.displayName, session.email)}
    />
  );
}
