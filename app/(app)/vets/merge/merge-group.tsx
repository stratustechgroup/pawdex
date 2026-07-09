"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { format } from "date-fns";

import { Icon } from "@/components/brand/icon";
import { formatPhone } from "@/lib/utils/phone";

import { mergeVetClinics } from "./actions";

type Clinic = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  address_line1: string | null;
  last_seen_at: string | null;
  verified_at: string | null;
  vaccination_count: number;
  medication_count: number;
  medical_event_count: number;
  pet_count: number;
};

export function MergeGroup({
  groupKey,
  reason,
  clinics,
}: {
  groupKey: string;
  reason: "phone" | "name";
  clinics: Clinic[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // Default keeper: the clinic with the most attached records (richest history),
  // breaking ties by who's been verified.
  const initialKeeper = [...clinics].sort((a, b) => {
    const scoreA = a.vaccination_count + a.medication_count + a.medical_event_count;
    const scoreB = b.vaccination_count + b.medication_count + b.medical_event_count;
    if (scoreA !== scoreB) return scoreB - scoreA;
    if (a.verified_at && !b.verified_at) return -1;
    if (!a.verified_at && b.verified_at) return 1;
    return 0;
  })[0].id;

  const [keeperId, setKeeperId] = useState(initialKeeper);

  function handleMerge() {
    const mergeAwayIds = clinics.filter((c) => c.id !== keeperId).map((c) => c.id);
    if (mergeAwayIds.length === 0) return;
    const keeper = clinics.find((c) => c.id === keeperId);
    if (
      !window.confirm(
        `Merge ${mergeAwayIds.length} ${mergeAwayIds.length === 1 ? "duplicate" : "duplicates"} into "${keeper?.name}"? All vaccines, medications, and events will move over and the duplicates will be deleted.`,
      )
    )
      return;
    startTransition(async () => {
      const r = await mergeVetClinics({ keeperId, mergeAwayIds });
      if (r.ok) {
        toast.success(
          `Merged ${mergeAwayIds.length} ${mergeAwayIds.length === 1 ? "clinic" : "clinics"} — moved ${r.movedCount} records.`,
        );
        router.refresh();
      } else {
        toast.error(r.error);
      }
    });
  }

  return (
    <section
      className="pw-card"
      style={{ padding: 16, display: "flex", flexDirection: "column", gap: 12 }}
    >
      <header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
        }}
      >
        <div>
          <div
            style={{
              font: "600 12.5px var(--font-inter)",
              color: "var(--pw-text-secondary)",
              letterSpacing: "0.04em",
              textTransform: "uppercase",
            }}
          >
            {clinics.length} duplicates
          </div>
          <div
            style={{
              font: "400 12px var(--font-inter)",
              color: "var(--pw-text-muted)",
              marginTop: 2,
            }}
          >
            Matched by{" "}
            {reason === "phone"
              ? "shared phone number"
              : "fuzzy name match"}
          </div>
        </div>
        <button
          type="button"
          onClick={handleMerge}
          disabled={isPending}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            height: 32,
            padding: "0 14px",
            borderRadius: 6,
            background: "var(--pw-accent)",
            border: "1px solid var(--pw-accent)",
            color: "#fff",
            font: "500 12.5px var(--font-inter)",
            cursor: isPending ? "default" : "pointer",
            opacity: isPending ? 0.6 : 1,
          }}
        >
          <Icon name="copy" size={13} />
          {isPending ? "Merging…" : "Merge into selected"}
        </button>
      </header>

      <ul
        style={{
          listStyle: "none",
          padding: 0,
          margin: 0,
          display: "flex",
          flexDirection: "column",
          gap: 6,
        }}
      >
        {clinics.map((c) => {
          const isKeeper = c.id === keeperId;
          const totalRecords =
            c.vaccination_count + c.medication_count + c.medical_event_count;
          return (
            <li key={c.id}>
              <label
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 10,
                  padding: 12,
                  borderRadius: 10,
                  border: `1px solid ${isKeeper ? "var(--pw-accent)" : "var(--pw-border)"}`,
                  background: isKeeper ? "var(--pw-accent-soft)" : "var(--pw-surface)",
                  cursor: "pointer",
                }}
              >
                <input
                  type="radio"
                  name={`keeper-${groupKey}`}
                  value={c.id}
                  checked={isKeeper}
                  onChange={() => setKeeperId(c.id)}
                  style={{
                    accentColor: "var(--pw-accent)",
                    marginTop: 3,
                    flexShrink: 0,
                  }}
                />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      font: "500 13.5px var(--font-inter)",
                      color: "var(--pw-text)",
                    }}
                  >
                    {c.name}
                    {isKeeper && (
                      <span
                        style={{
                          font: "600 9.5px var(--font-jetbrains)",
                          letterSpacing: "0.06em",
                          padding: "1px 6px",
                          borderRadius: 4,
                          background: "var(--pw-accent)",
                          color: "#fff",
                          textTransform: "uppercase",
                        }}
                      >
                        Keeper
                      </span>
                    )}
                    {c.verified_at && (
                      <span
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 3,
                          font: "500 10.5px var(--font-inter)",
                          color: "var(--pw-accent-fg-on-soft)",
                        }}
                        title="Manually verified"
                      >
                        <Icon name="checkCircle" size={10} />
                        verified
                      </span>
                    )}
                  </div>
                  <div
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      gap: 12,
                      marginTop: 4,
                      font: "400 12px var(--font-inter)",
                      color: "var(--pw-text-muted)",
                    }}
                  >
                    {c.phone && (
                      <span className="mono">
                        <Icon name="bell" size={11} style={{ marginRight: 3 }} />
                        {formatPhone(c.phone)}
                      </span>
                    )}
                    {c.email && (
                      <span>
                        <Icon name="mail" size={11} style={{ marginRight: 3 }} />
                        {c.email}
                      </span>
                    )}
                    {c.address_line1 && (
                      <span>
                        <Icon name="home" size={11} style={{ marginRight: 3 }} />
                        {c.address_line1}
                      </span>
                    )}
                  </div>
                  <div
                    style={{
                      marginTop: 6,
                      font: "400 11.5px var(--font-inter)",
                      color: "var(--pw-text-muted)",
                    }}
                  >
                    {totalRecords} {totalRecords === 1 ? "record" : "records"} ·{" "}
                    {c.pet_count} {c.pet_count === 1 ? "pet" : "pets"}
                    {c.last_seen_at && (
                      <>
                        {" "}· last seen{" "}
                        {format(new Date(c.last_seen_at), "MMM d, yyyy")}
                      </>
                    )}
                  </div>
                </div>
              </label>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
