"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { restoreAccountAction } from "@/app/(app)/settings/account/actions";

/**
 * Restore control for the grace-period screen: cancels the scheduled deletion
 * and brings back every household it soft-deleted, then returns the user to the
 * app.
 */
export function RestoreAccountPanel() {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function restore() {
    startTransition(async () => {
      const r = await restoreAccountAction();
      if (r.ok) {
        toast.success("Welcome back. Your account and households are restored.");
        router.replace("/");
        router.refresh();
      } else {
        toast.error(r.error);
      }
    });
  }

  return (
    <Button type="button" onClick={restore} disabled={isPending}>
      {isPending ? "Restoring…" : "Restore my account"}
    </Button>
  );
}
