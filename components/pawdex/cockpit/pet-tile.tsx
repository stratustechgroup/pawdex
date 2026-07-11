import Link from "next/link";

import { Icon } from "@/components/brand/icon";
import { PetPhoto } from "@/components/pawdex/pet-photo";
import { StatusBadge, type StatusKind } from "@/components/pawdex/status-badge";
import { Sparkline } from "@/components/pawdex/cockpit/sparkline";
import { ageFromDob, kgToLbs } from "@/lib/utils";
import type { PetVitals } from "@/lib/db/cockpit";

const STATUS_TO_KIND: Record<string, StatusKind> = {
  up_to_date: "up",
  due_soon: "due",
  overdue: "overdue",
  incomplete: "incomplete",
};

const RING_COLOR: Record<StatusKind, string> = {
  up: "var(--pw-status-up-dot)",
  due: "var(--pw-status-due-dot)",
  overdue: "var(--pw-status-overdue-dot)",
  incomplete: "var(--pw-border-strong)",
};

const TREND_META: Record<
  "up" | "down" | "flat",
  { icon: string; color: string; label: string }
> = {
  up: { icon: "trendUp", color: "var(--pw-text-secondary)", label: "up" },
  down: { icon: "trendDown", color: "var(--pw-text-secondary)", label: "down" },
  flat: { icon: "minus", color: "var(--pw-text-subtle)", label: "steady" },
};

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function PetTile({
  vitals,
  photoUrl,
}: {
  vitals: PetVitals;
  photoUrl: string | null;
}) {
  const { pet } = vitals;
  const kind = STATUS_TO_KIND[pet.status] ?? "incomplete";
  const ring = RING_COLOR[kind];
  const age = ageFromDob(pet.date_of_birth);
  const meta = [pet.breed, pet.sex !== "unknown" ? capitalize(pet.sex) : null, age]
    .filter(Boolean)
    .join(" · ");

  return (
    <div
      className="pw-tile"
      style={{ ["--pw-tile-accent" as string]: ring }}
    >
      <Link href={`/pets/${pet.id}`} className="pw-tile-head">
        <span
          style={{
            borderRadius: "50%",
            padding: 2,
            boxShadow: `0 0 0 2px var(--pw-surface), 0 0 0 3.5px ${ring}`,
            display: "inline-flex",
            flexShrink: 0,
          }}
        >
          <PetPhoto name={pet.name} src={photoUrl} size={46} ring={false} />
        </span>
        <span style={{ flex: 1, minWidth: 0 }}>
          <span
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
                fontSize: 19,
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
            <StatusBadge kind={kind} />
          </span>
          <span
            style={{
              display: "block",
              font: "400 12px var(--font-inter)",
              color: "var(--pw-text-muted)",
              marginTop: 3,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {meta || capitalize(pet.species)}
          </span>
        </span>
      </Link>

      <div className="pw-tile-vitals">
        <Link href={`/pets/${pet.id}/weight`} className="pw-vital" aria-label="Weight">
          <span className="pw-vital-label">Weight</span>
          {vitals.latestWeightKg != null ? (
            <span
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                marginTop: 2,
              }}
            >
              <span
                className="tnum"
                style={{
                  font: "600 14px var(--font-inter)",
                  color: "var(--pw-text)",
                }}
              >
                {kgToLbs(vitals.latestWeightKg)}
                <span
                  style={{
                    font: "400 10.5px var(--font-inter)",
                    color: "var(--pw-text-muted)",
                    marginLeft: 2,
                  }}
                >
                  lb
                </span>
              </span>
              {vitals.weightTrend && (
                <Icon
                  name={TREND_META[vitals.weightTrend].icon}
                  size={13}
                  style={{ color: TREND_META[vitals.weightTrend].color }}
                />
              )}
              {vitals.weightSeries.length >= 2 && (
                <Sparkline values={vitals.weightSeries} />
              )}
            </span>
          ) : (
            <span
              style={{
                display: "block",
                font: "500 12.5px var(--font-inter)",
                color: "var(--pw-text-muted)",
                marginTop: 2,
              }}
            >
              Not logged
            </span>
          )}
        </Link>

        <Link
          href={`/pets/${pet.id}/medications`}
          className="pw-vital"
          aria-label="Medications"
        >
          <span className="pw-vital-label">Meds</span>
          <span
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              marginTop: 2,
            }}
          >
            <Icon
              name="pill"
              size={13}
              style={{
                color:
                  vitals.activeMedCount > 0
                    ? "var(--pw-accent)"
                    : "var(--pw-text-subtle)",
              }}
            />
            <span
              style={{
                font: "600 14px var(--font-inter)",
                color:
                  vitals.activeMedCount > 0
                    ? "var(--pw-text)"
                    : "var(--pw-text-muted)",
              }}
            >
              {vitals.activeMedCount > 0 ? vitals.activeMedCount : "None"}
            </span>
            {vitals.activeMedCount > 0 && (
              <span
                style={{
                  font: "400 11px var(--font-inter)",
                  color: "var(--pw-text-muted)",
                }}
              >
                active
              </span>
            )}
          </span>
        </Link>
      </div>

      <Link href={`/pets/${pet.id}`} className="pw-tile-foot">
        <Icon
          name={kind === "overdue" ? "alert" : "clock"}
          size={13}
          style={{ color: ring }}
        />
        <span
          style={{
            font: "500 12.5px var(--font-inter)",
            color: "var(--pw-text)",
            flex: 1,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {pet.next_due_label ?? "No vaccinations on record yet"}
        </span>
        {vitals.hasInsurance && (
          <span
            title={vitals.insurerName ?? "Insured"}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 3,
              padding: "2px 7px",
              borderRadius: 999,
              background: "var(--pw-info-bg)",
              color: "var(--pw-info-fg)",
              font: "500 10.5px var(--font-inter)",
            }}
          >
            <Icon name="shieldCheck" size={11} />
            Insured
          </span>
        )}
        <Icon
          name="chevronRight"
          size={14}
          style={{ color: "var(--pw-text-subtle)" }}
        />
      </Link>
    </div>
  );
}
