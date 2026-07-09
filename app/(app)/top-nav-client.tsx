"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";

import { TopNav } from "@/components/pawdex/top-nav";
import { createClient } from "@/lib/supabase/browser";

export function TopNavClient({
  householdName,
  userInitials,
}: {
  householdName: string;
  userInitials: string;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  function handleSignOut() {
    startTransition(async () => {
      const supabase = createClient();
      await supabase.auth.signOut();
      router.replace("/login");
      router.refresh();
    });
  }

  return (
    <TopNav
      householdName={householdName}
      userInitials={userInitials}
      onSignOut={handleSignOut}
    />
  );
}
