"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { TypeToConfirm, confirmMatches } from "@/components/deletion/type-to-confirm";
import { softDeletePetAction } from "@/app/(app)/pets/[petId]/delete-actions";

/**
 * Confirmation ladder rung 1: delete a pet by typing its name. Soft delete, so
 * the copy reassures that it is reversible for 30 days and points to the free
 * export first (records are never held hostage).
 */
export function DeletePetDialog({
  petId,
  petName,
  open,
  onOpenChange,
}: {
  petId: string;
  petName: string;
  open: boolean;
  onOpenChange: (next: boolean) => void;
}) {
  const [typed, setTyped] = useState("");
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  useEffect(() => {
    if (open) setTyped("");
  }, [open]);

  const canDelete = confirmMatches(petName, typed);

  function onDelete() {
    if (!canDelete) return;
    startTransition(async () => {
      const r = await softDeletePetAction(petId, typed);
      if (r.ok) {
        toast.success(`${petName} deleted. You can restore it for 30 days.`);
        onOpenChange(false);
        // The pet detail route now 404s; go home.
        router.push("/");
        router.refresh();
      } else {
        toast.error(r.error);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle style={{ color: "var(--pw-text)" }}>Delete {petName}?</DialogTitle>
          <DialogDescription style={{ color: "var(--pw-text-muted)" }}>
            This hides {petName} and all of their records right away. You can
            restore them from Settings for 30 days, after which everything is
            permanently deleted.
          </DialogDescription>
        </DialogHeader>

        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <p
            style={{
              margin: 0,
              font: "400 12.5px var(--font-inter)",
              color: "var(--pw-text-muted)",
              lineHeight: 1.55,
            }}
          >
            Want a copy first? {" "}
            <Link
              href={`/pets/${petId}/packet`}
              style={{ color: "var(--pw-accent)", textDecoration: "underline" }}
            >
              Export {petName}&rsquo;s record
            </Link>{" "}
            before deleting. Export stays free forever.
          </p>

          <TypeToConfirm
            phrase={petName}
            value={typed}
            onChange={setTyped}
            id="delete-pet-confirm"
          />
        </div>

        <DialogFooter className="gap-2">
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={isPending}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={onDelete}
            disabled={!canDelete || isPending}
            style={{ background: "var(--pw-danger, #B4231F)", borderColor: "transparent" }}
          >
            {isPending ? "Deleting…" : "Delete pet"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
