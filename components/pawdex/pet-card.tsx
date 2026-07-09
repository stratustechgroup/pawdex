import Link from "next/link";

import { Icon } from "@/components/brand/icon";
import { PetPhoto } from "@/components/pawdex/pet-photo";
import { StatusBadge, type StatusKind } from "@/components/pawdex/status-badge";
import { ageFromDob } from "@/lib/utils";
import type { PetWithStatus } from "@/lib/db/pets";

const STATUS_ICON: Record<StatusKind, { name: string; color: string }> = {
  up: { name: "checkCircle", color: "var(--pw-status-up-dot)" },
  due: { name: "clock", color: "var(--pw-status-due-dot)" },
  overdue: { name: "alert", color: "var(--pw-status-overdue-dot)" },
  incomplete: { name: "clock", color: "var(--pw-status-incomplete-dot)" },
};

export function PawdexPetCard({
  pet,
  photoUrl,
}: {
  pet: PetWithStatus;
  photoUrl: string | null;
}) {
  const age = ageFromDob(pet.date_of_birth);
  const meta = [
    pet.breed,
    pet.sex !== "unknown" ? capitalize(pet.sex) : null,
    age,
  ]
    .filter(Boolean)
    .join(" · ");

  const icon = STATUS_ICON[pet.status as StatusKind] ?? STATUS_ICON.incomplete;
  const actionText = pet.next_due_label ?? "No vaccinations on record yet";

  return (
    <Link
      href={`/pets/${pet.id}`}
      className="pw-card"
      style={{
        padding: 18,
        textDecoration: "none",
        color: "inherit",
        display: "block",
        transition: "border-color 0.12s, background 0.12s",
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
        <PetPhoto name={pet.name} src={photoUrl} size={56} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 8,
            }}
          >
            <span
              className="serif"
              style={{
                fontSize: 22,
                fontWeight: 500,
                lineHeight: 1.2,
                color: "var(--pw-text)",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {pet.name}
            </span>
            <StatusBadge kind={(pet.status as StatusKind) ?? "incomplete"} />
          </div>
          <div
            style={{
              font: "400 12.5px var(--font-inter)",
              color: "var(--pw-text-muted)",
              marginTop: 4,
            }}
          >
            {meta || capitalize(pet.species)}
          </div>
        </div>
      </div>
      <div
        style={{
          marginTop: 14,
          paddingTop: 14,
          borderTop: "1px solid var(--pw-border)",
          display: "flex",
          alignItems: "center",
          gap: 8,
        }}
      >
        <Icon name={icon.name} size={14} style={{ color: icon.color }} />
        <span
          style={{
            font: "500 13px var(--font-inter)",
            color: "var(--pw-text)",
            flex: 1,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {actionText}
        </span>
        <Icon
          name="chevronRight"
          size={14}
          style={{ color: "var(--pw-text-subtle)" }}
        />
      </div>
    </Link>
  );
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
