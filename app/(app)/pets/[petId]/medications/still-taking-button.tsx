"use client";

import { useTransition } from "react";
import { toast } from "sonner";

import { markStillTaking } from "./actions";

/**
 * Correction for a course that rolled off "Active" on an ESTIMATED end date the
 * pet is still taking. Clears the estimate so the med is active again. Only
 * rendered for rows with ended_estimated = true.
 */
export function StillTakingButton({
  petId,
  medicationId,
}: {
  petId: string;
  medicationId: string;
}) {
  const [isPending, startTransition] = useTransition();
  return (
    <button
      type="button"
      disabled={isPending}
      onClick={() =>
        startTransition(async () => {
          const res = await markStillTaking({ petId, medicationId });
          if (!res.ok) toast.error(res.error);
          else toast.success("Moved back to active medications.");
        })
      }
      style={{
        font: "500 11px var(--font-inter)",
        color: "var(--pw-accent)",
        background: "transparent",
        border: 0,
        padding: 0,
        cursor: isPending ? "default" : "pointer",
        textDecoration: "underline",
        textUnderlineOffset: 2,
        opacity: isPending ? 0.6 : 1,
      }}
    >
      Still taking it
    </button>
  );
}
