import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { bootstrapHousehold } from "@/lib/auth/bootstrap";

export const metadata = { title: "Welcome — Puppy" };

export default async function OnboardingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

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

  redirect("/");
}
