import Link from "next/link";
import { format } from "date-fns";
import { notFound } from "next/navigation";

import { Icon } from "@/components/brand/icon";
import { SectionHead } from "@/components/pawdex/chips";
import { requireSession } from "@/lib/auth/household";
import { createClient } from "@/lib/supabase/server";
import type { MedicationPriceQuote, PharmacySource } from "@/lib/supabase/types";

import { addPriceQuote, deletePriceQuote } from "./actions";

export const metadata = { title: "Pharmacy prices — Pawdex" };
export const dynamic = "force-dynamic";

const SOURCE_LABEL: Record<PharmacySource, string> = {
  chewy: "Chewy Pharmacy",
  costco: "Costco",
  goodrx: "GoodRx for Pets",
  "1800petmeds": "1-800-PetMeds",
  walmart: "Walmart",
  vet_in_house: "Vet (in-house)",
  other: "Other",
};

function formatMoney(cents: number): string {
  return `$${(cents / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default async function PricesPage({
  params,
}: {
  params: Promise<{ petId: string; medId: string }>;
}) {
  const { petId, medId } = await params;
  const session = await requireSession();
  const supabase = await createClient();

  const [{ data: med }, { data: quotes }] = await Promise.all([
    supabase
      .from("medications")
      .select("id, name, generic_name, dose")
      .eq("household_id", session.householdId)
      .eq("pet_id", petId)
      .eq("id", medId)
      .maybeSingle(),
    supabase
      .from("medication_price_quotes")
      .select("*")
      .eq("household_id", session.householdId)
      .eq("medication_id", medId)
      .order("price_cents", { ascending: true }),
  ]);

  if (!med) notFound();
  const sorted = (quotes ?? []) as MedicationPriceQuote[];
  const cheapest = sorted[0] ?? null;
  const dearest = sorted[sorted.length - 1] ?? null;
  const savings =
    cheapest && dearest && cheapest.id !== dearest.id
      ? dearest.price_cents - cheapest.price_cents
      : null;

  return (
    <div
      style={{
        maxWidth: 860,
        margin: "0 auto",
        padding: "32px 24px 56px",
        display: "flex",
        flexDirection: "column",
        gap: 24,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          font: "400 12.5px var(--font-inter)",
          color: "var(--pw-text-muted)",
        }}
      >
        <Link
          href={`/pets/${petId}/medications`}
          style={{ color: "inherit", textDecoration: "none" }}
        >
          Medications
        </Link>
        <Icon name="chevronRight" size={12} />
        <span style={{ color: "var(--pw-text)" }}>{med.name}</span>
        <Icon name="chevronRight" size={12} />
        <span style={{ color: "var(--pw-text)" }}>Pharmacy prices</span>
      </div>

      <SectionHead
        title={`Compare pharmacy prices — ${med.name}`}
        sub={`${med.generic_name && med.generic_name !== med.name ? `Generic: ${med.generic_name} · ` : ""}Dose ${med.dose}. Pawdex doesn't pull live pricing — log quotes you see and we'll rank by cost.`}
      />

      {savings && cheapest && (
        <div
          style={{
            padding: 14,
            background: "var(--pw-accent-soft)",
            color: "var(--pw-accent-fg-on-soft)",
            borderRadius: 10,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
          }}
        >
          <div>
            <div
              style={{
                font: "500 10.5px var(--font-inter)",
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                opacity: 0.85,
              }}
            >
              Potential savings
            </div>
            <div
              style={{
                font: "700 22px var(--font-source-serif)",
                marginTop: 2,
                color: "var(--pw-accent)",
              }}
            >
              {formatMoney(savings)}
            </div>
          </div>
          <div
            style={{
              font: "400 12px var(--font-inter)",
              lineHeight: 1.5,
              textAlign: "right",
            }}
          >
            Cheapest is{" "}
            <strong>{SOURCE_LABEL[cheapest.source]}</strong> at{" "}
            <strong className="tnum">{formatMoney(cheapest.price_cents)}</strong>
            {cheapest.pack_size_label && (
              <> ({cheapest.pack_size_label})</>
            )}
          </div>
        </div>
      )}

      <section
        className="pw-card"
        style={{ padding: 18, display: "flex", flexDirection: "column", gap: 12 }}
      >
        <h2
          style={{
            margin: 0,
            font: "600 13.5px var(--font-inter)",
            color: "var(--pw-text)",
          }}
        >
          Add a price quote
        </h2>
        <form
          action={addPriceQuote}
          style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 10 }}
        >
          <input type="hidden" name="pet_id" value={petId} />
          <input type="hidden" name="medication_id" value={med.id} />
          <Field label="Pharmacy">
            <select name="source" required style={inputStyle} defaultValue="">
              <option value="" disabled>
                Pick…
              </option>
              {(Object.keys(SOURCE_LABEL) as PharmacySource[]).map((s) => (
                <option key={s} value={s}>
                  {SOURCE_LABEL[s]}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Price ($)">
            <input
              type="number"
              name="price"
              required
              step="0.01"
              min="0"
              style={inputStyle}
            />
          </Field>
          <Field label="Pack size (optional)">
            <input
              type="text"
              name="pack_size_label"
              placeholder="e.g. 30 ct, 75mg"
              style={inputStyle}
            />
          </Field>
          <Field label="Link (optional)">
            <input
              type="url"
              name="link_url"
              placeholder="https://"
              style={inputStyle}
            />
          </Field>
          <div style={{ gridColumn: "1 / -1" }}>
            <Field label="Notes (optional)">
              <input type="text" name="notes" style={inputStyle} />
            </Field>
          </div>
          <div
            style={{
              gridColumn: "1 / -1",
              display: "flex",
              justifyContent: "flex-end",
            }}
          >
            <button
              type="submit"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 5,
                height: 34,
                padding: "0 14px",
                borderRadius: 6,
                border: "1px solid var(--pw-accent)",
                background: "var(--pw-accent)",
                color: "var(--pw-accent-fg)",
                font: "500 12.5px var(--font-inter)",
                cursor: "pointer",
              }}
            >
              <Icon name="plus" size={12} />
              Add quote
            </button>
          </div>
        </form>
      </section>

      {sorted.length === 0 ? (
        <div
          className="pw-card"
          style={{
            padding: 32,
            textAlign: "center",
            borderStyle: "dashed",
            background: "transparent",
            font: "400 13px var(--font-inter)",
            color: "var(--pw-text-muted)",
            lineHeight: 1.55,
          }}
        >
          No quotes yet. Add one above — typical sources for pet meds: Chewy
          Pharmacy, Costco Pharmacy (some accept pet Rx), GoodRx for Pets,
          1-800-PetMeds, Walmart $4 list for common generics.
        </div>
      ) : (
        <ul
          style={{
            listStyle: "none",
            margin: 0,
            padding: 0,
            display: "flex",
            flexDirection: "column",
            gap: 8,
          }}
        >
          {sorted.map((q, i) => (
            <li
              key={q.id}
              className="pw-card"
              style={{
                padding: 14,
                display: "flex",
                alignItems: "center",
                gap: 12,
                borderLeft: `3px solid ${i === 0 ? "var(--pw-accent)" : "var(--pw-border)"}`,
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    font: "600 14px var(--font-inter)",
                    color: "var(--pw-text)",
                  }}
                >
                  {SOURCE_LABEL[q.source]}
                  {i === 0 && (
                    <span
                      style={{
                        marginLeft: 8,
                        padding: "1px 6px",
                        borderRadius: 4,
                        background: "var(--pw-accent-soft)",
                        color: "var(--pw-accent-fg-on-soft)",
                        font: "500 9.5px var(--font-jetbrains-mono)",
                        letterSpacing: "0.06em",
                        textTransform: "uppercase",
                      }}
                    >
                      Cheapest
                    </span>
                  )}
                </div>
                <div
                  style={{
                    marginTop: 2,
                    font: "400 11.5px var(--font-inter)",
                    color: "var(--pw-text-muted)",
                  }}
                >
                  {q.pack_size_label ? `${q.pack_size_label} · ` : ""}
                  Quoted {format(new Date(q.recorded_on), "MMM d, yyyy")}
                  {q.link_url && (
                    <>
                      {" · "}
                      <a
                        href={q.link_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          color: "var(--pw-accent)",
                          textDecoration: "underline",
                          textUnderlineOffset: 2,
                        }}
                      >
                        Open listing
                      </a>
                    </>
                  )}
                </div>
                {q.notes && (
                  <div
                    style={{
                      marginTop: 4,
                      font: "400 11.5px var(--font-inter)",
                      color: "var(--pw-text-secondary)",
                    }}
                  >
                    {q.notes}
                  </div>
                )}
              </div>
              <div
                className="tnum"
                style={{
                  font: "700 18px var(--font-source-serif)",
                  color: i === 0 ? "var(--pw-accent)" : "var(--pw-text)",
                  minWidth: 80,
                  textAlign: "right",
                }}
              >
                {formatMoney(q.price_cents)}
              </div>
              <form action={deletePriceQuote}>
                <input type="hidden" name="quote_id" value={q.id} />
                <input type="hidden" name="pet_id" value={petId} />
                <input type="hidden" name="medication_id" value={med.id} />
                <button
                  type="submit"
                  title="Delete"
                  style={{
                    background: "transparent",
                    border: 0,
                    cursor: "pointer",
                    color: "var(--pw-text-muted)",
                  }}
                >
                  <Icon name="x" size={13} />
                </button>
              </form>
            </li>
          ))}
        </ul>
      )}

      <div
        style={{
          padding: 12,
          background: "var(--pw-info-bg)",
          color: "var(--pw-info-fg)",
          borderRadius: 8,
          font: "400 11.5px var(--font-inter)",
          lineHeight: 1.55,
        }}
      >
        Pet meds often cost 50%+ less outside the vet's in-house pharmacy.
        Always check the dose + count match — a $20 30-count bottle isn't
        cheaper than a $30 90-count from another pharmacy. Verify the
        pharmacy accepts veterinary prescriptions before paying.
      </div>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <span
        style={{
          font: "500 11px var(--font-inter)",
          color: "var(--pw-text-muted)",
          letterSpacing: "0.04em",
          textTransform: "uppercase",
        }}
      >
        {label}
      </span>
      {children}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  height: 34,
  padding: "0 10px",
  borderRadius: 6,
  border: "1px solid var(--pw-border-strong)",
  background: "var(--pw-surface)",
  color: "var(--pw-text)",
  font: "400 13px var(--font-inter)",
  outline: "none",
};
