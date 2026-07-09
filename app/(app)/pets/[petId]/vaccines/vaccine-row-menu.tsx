"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Icon } from "@/components/brand/icon";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { deleteVaccination } from "./actions";

/**
 * Per-row overflow menu on the vaccines table. Houses delete (the only
 * destructive action) and View source (a quick jump to the linked document
 * viewer when there is one). Sized to match the table row height so the
 * cell layout doesn't shift when the menu mounts.
 */
export function VaccineRowMenu({
  vaccinationId,
  petId,
  documentId,
  vaccineLabel,
}: {
  vaccinationId: string;
  petId: string;
  documentId: string | null;
  vaccineLabel: string;
}) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleDelete() {
    const ok = window.confirm(
      `Delete the ${vaccineLabel} record? This cannot be undone — the source document stays on file.`,
    );
    if (!ok) return;
    startTransition(async () => {
      const result = await deleteVaccination({
        id: vaccinationId,
        pet_id: petId,
      });
      if (result.ok) {
        toast.success("Vaccine deleted");
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger
        aria-label={`More actions for ${vaccineLabel}`}
        disabled={isPending}
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          width: 26,
          height: 26,
          borderRadius: 4,
          border: "none",
          background: "transparent",
          color: "var(--pw-text-muted)",
          cursor: isPending ? "wait" : "pointer",
        }}
      >
        <Icon name="moreH" size={14} />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={4} className="w-48">
        <DropdownMenuLabel>{vaccineLabel}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {documentId && (
          <DropdownMenuItem
            onSelect={() =>
              router.push(`/pets/${petId}/documents/${documentId}`)
            }
          >
            <Icon name="file" size={14} />
            <span>View source document</span>
          </DropdownMenuItem>
        )}
        <DropdownMenuItem
          onSelect={handleDelete}
          variant="destructive"
          disabled={isPending}
        >
          <Icon name="alert" size={14} />
          <span>Delete record</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
