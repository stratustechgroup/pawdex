"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";

import { TopNav } from "@/components/pawdex/top-nav";
import type { SwitcherHousehold } from "@/components/pawdex/household-switcher";
import { createClient } from "@/lib/supabase/browser";

export function TopNavClient({
  households,
  userInitials,
}: {
  households: SwitcherHousehold[];
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
      households={households}
      userInitials={userInitials}
      onSignOut={handleSignOut}
    />
  );
}
