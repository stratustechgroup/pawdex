"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Icon } from "@/components/brand/icon";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { DeletePetDialog } from "@/components/deletion/delete-pet-dialog";

/**
 * Overflow menu for the pet detail header. Houses everything that didn't
 * earn a primary slot — Briefing (pre-visit sheet), EU travel readiness,
 * Emergency ID card, Edit, and Delete. Wrapped in a Radix DropdownMenu so
 * keyboard nav + focus return work for free.
 */
export function PetActionsMenu({
  petId,
  petName,
}: {
  petId: string;
  petName: string;
}) {
  const router = useRouter();
  const [deleteOpen, setDeleteOpen] = useState(false);

  const items: Array<
    | { kind: "item"; label: string; icon: Parameters<typeof Icon>[0]["name"]; href: string; tooltip?: string }
    | { kind: "separator" }
  > = [
    {
      kind: "item",
      label: "Pre-visit briefing",
      icon: "fileText",
      href: `/pets/${petId}/briefing`,
      tooltip: "Recent symptoms, current meds, weight trend, questions to ask",
    },
    {
      kind: "item",
      label: "EU travel readiness",
      icon: "paw",
      href: `/pets/${petId}/eu-travel`,
      tooltip: "Post-April-2026 EU pet passport rules",
    },
    {
      kind: "item",
      label: "Emergency ID card",
      icon: "shield",
      href: `/pets/${petId}/emergency-card`,
      tooltip: "Wallet-sized card with microchip, allergies, current meds",
    },
    { kind: "separator" },
    {
      kind: "item",
      label: "Edit pet details",
      icon: "edit",
      href: `/pets/${petId}/edit`,
    },
  ];

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          aria-label="More actions"
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: 32,
            height: 32,
            borderRadius: 6,
            border: "1px solid var(--pw-border-strong)",
            background: "var(--pw-surface)",
            color: "var(--pw-text)",
            cursor: "pointer",
          }}
        >
          <Icon name="moreH" size={15} />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" sideOffset={6} className="w-56">
          <DropdownMenuLabel>More for this pet</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {items.map((it, i) =>
            it.kind === "separator" ? (
              <DropdownMenuSeparator key={`sep-${i}`} />
            ) : (
              <DropdownMenuItem
                key={it.label}
                onSelect={() => router.push(it.href)}
                title={it.tooltip}
              >
                <Icon name={it.icon} size={14} />
                <span>{it.label}</span>
              </DropdownMenuItem>
            ),
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onSelect={() => setDeleteOpen(true)}
            style={{ color: "var(--pw-danger, #B4231F)" }}
          >
            <Icon name="alert" size={14} />
            <span>Delete pet</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <DeletePetDialog
        petId={petId}
        petName={petName}
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
      />
    </>
  );
}
