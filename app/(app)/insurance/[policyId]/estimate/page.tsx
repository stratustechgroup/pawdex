import Link from "next/link";
import { format } from "date-fns";
import { notFound } from "next/navigation";

import { Icon } from "@/components/brand/icon";
import { SectionHead } from "@/components/pawdex/chips";
import { requireSession } from "@/lib/auth/household";
import { listCostEstimatesForPolicy } from "@/lib/db/cost-estimates";
import { getInsurancePolicy } from "@/lib/db/insurance";
import { listPetsForHousehold } from "@/lib/db/pets";
import { getPolicyYtdTotals } from "@/lib/db/policy-ytd";
import { createClient } from "@/lib/supabase/server";

import { createCostEstimate, deleteCostEstimate } from "./actions";
import { RequestQuoteForm } from "./request-quote-form";

export const metadata = { title: "Cost estimate · Pawdex" };
export const dynamic = "force-dynamic";

function formatMoney(cents: number | null): string {
  if (cents === null || !Number.isFinite(cents)) return "—";
  return `$${(cents / 100).toLocaleString(undefined, {
    minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatPercent(rate: number | null): string {
  if (rate === null || !Number.isFinite(rate)) return "—";
  return `${Math.round(rate * 100)}%`;
}

export default async function EstimatePage({
  params,
}: {
  params: Promise<{ policyId: string }>;
}) {
  const { policyId } = await params;
  const session = await requireSession();

  const [policy, pets, estimates] = await Promise.all([
    getInsurancePolicy(session.householdId, policyId),
    listPetsForHousehold(session.householdId),
    listCostEstimatesForPolicy(session.householdId, policyId),
  ]);

  if (!policy) notFound();

  // YTD totals (approved + reimbursed during the current policy year) feed
  // remaining deductible + remaining annual max so the OOP defaults aren't
  // worst-case "full deductible every time".
  const ytd = await getPolicyYtdTotals(session.householdId, policy);

  // Clinics the user has on file — for the quote-request form.
  const supabase = await createClient();
  const { data: clinicRows } = await supabase
    .from("vet_clinics")
    .select("id, name, email")
    .eq("household_id", session.householdId)
    .order("name", { ascending: true });
  const clinics = (clinicRows ?? []).map((c) => ({
    id: c.id,
    name: c.name,
    hasEmail: !!c.email,
  }));
  const deductibleRemainingCents =
    policy.deductible_annual_cents !== null
      ? Math.max(0, policy.deductible_annual_cents - ytd.approved_cents)
      : null;
  const annualMaxRemainingCents =
    policy.annual_max_cents !== null
      ? Math.max(0, policy.annual_max_cents - ytd.reimbursed_cents)
      : null;

  const petLabelById = new Map<string, string>();
  for (const p of pets) petLabelById.set(p.id, p.name);

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
        <Link href="/insurance" style={{ color: "inherit", textDecoration: "none" }}>
          Insurance
        </Link>
        <Icon name="chevronRight" size={12} />
        <span style={{ color: "var(--pw-text)" }}>{policy.insurer_name}</span>
        <Icon name="chevronRight" size={12} />
        <span style={{ color: "var(--pw-text)" }}>Estimate procedure</span>
      </div>

      <SectionHead
        title="Estimate true out-of-pocket"
        sub={`Apply ${policy.insurer_name}'s ${formatPercent(policy.reimbursement_rate)} reimbursement and ${formatMoney(policy.deductible_annual_cents)} annual deductible to a procedure quote.`}
      />

      <RequestQuoteForm
        policyId={policy.id}
        pets={pets.map((p) => ({ id: p.id, name: p.name }))}
        clinics={clinics}
        defaultPetId={policy.pet_id}
      />

      <section className="pw-card" style={{ padding: 20 }}>
        <form
          action={createCostEstimate}
          style={{ display: "grid", gap: 14, gridTemplateColumns: "repeat(2, 1fr)" }}
        >
          <input type="hidden" name="policy_id" value={policy.id} />

          <Field full label="Procedure">
            <textarea
              name="procedure_summary"
              required
              rows={2}
              placeholder="e.g. Cruciate (CCL) repair on left rear leg, including pre-op bloodwork and 7-day post-op rechecks"
              style={textareaStyle}
            />
          </Field>

          <Field label="Pet">
            <select name="pet_id" required style={selectStyle} defaultValue="">
              <option value="" disabled>
                Pick a pet…
              </option>
              {pets.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Vet's gross estimate ($)">
            <input
              type="number"
              name="gross_estimate"
              required
              step="0.01"
              min="0"
              placeholder="e.g. 4500"
              style={inputStyle}
            />
          </Field>

          <Field
            full
            label="Deductible remaining this policy year ($)"
            hint={
              deductibleRemainingCents !== null
                ? `Defaults to ${formatMoney(deductibleRemainingCents)} based on ${ytd.claim_count} approved claim${ytd.claim_count === 1 ? "" : "s"} this policy year (${formatMoney(policy.deductible_annual_cents)} annual). Override if you have a more accurate number from the insurer.`
                : `Override if you've already met some of your deductible.`
            }
          >
            <input
              type="number"
              name="deductible_remaining"
              step="0.01"
              min="0"
              defaultValue={
                deductibleRemainingCents !== null
                  ? (deductibleRemainingCents / 100).toFixed(2)
                  : ""
              }
              placeholder={
                policy.deductible_annual_cents !== null
                  ? (policy.deductible_annual_cents / 100).toString()
                  : "0"
              }
              style={inputStyle}
            />
          </Field>
          {annualMaxRemainingCents !== null &&
            policy.annual_max_cents !== null &&
            annualMaxRemainingCents < policy.annual_max_cents && (
              <div
                style={{
                  gridColumn: "1 / -1",
                  padding: 10,
                  background: "var(--pw-info-bg)",
                  color: "var(--pw-info-fg)",
                  borderRadius: 6,
                  font: "400 12px var(--font-inter)",
                }}
              >
                Annual max remaining this policy year:{" "}
                <strong>{formatMoney(annualMaxRemainingCents)}</strong> of{" "}
                {formatMoney(policy.annual_max_cents)} (after{" "}
                {formatMoney(ytd.reimbursed_cents)} reimbursed). Pawdex caps
                insurance pay-out at this remaining amount.
              </div>
            )}

          <div
            style={{
              gridColumn: "1 / -1",
              display: "flex",
              justifyContent: "flex-end",
              gap: 10,
              marginTop: 4,
            }}
          >
            <button
              type="submit"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
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
              <Icon name="sparkles" size={12} />
              Compute true OOP
            </button>
          </div>
        </form>
      </section>

      {estimates.length === 0 ? (
        <div
          className="pw-card"
          style={{
            padding: 24,
            textAlign: "center",
            borderStyle: "dashed",
            background: "transparent",
            font: "400 13px var(--font-inter)",
            color: "var(--pw-text-muted)",
          }}
        >
          No estimates yet. Compute one above to see what an upcoming
          procedure will actually cost you.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {estimates.map((e) => (
            <article
              key={e.id}
              className="pw-card"
              style={{ padding: 18 }}
            >
              <header
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                  gap: 12,
                  marginBottom: 12,
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      font: "600 14px var(--font-inter)",
                      color: "var(--pw-text)",
                    }}
                  >
                    {e.procedure_summary}
                  </div>
                  <div
                    style={{
                      marginTop: 2,
                      font: "400 11.5px var(--font-inter)",
                      color: "var(--pw-text-muted)",
                    }}
                  >
                    {e.pet_id && petLabelById.has(e.pet_id)
                      ? petLabelById.get(e.pet_id)
                      : "—"}{" "}
                    · computed{" "}
                    {e.computed_at
                      ? format(new Date(e.computed_at), "MMM d, yyyy")
                      : "—"}
                  </div>
                </div>
                <form action={deleteCostEstimate}>
                  <input type="hidden" name="estimate_id" value={e.id} />
                  <button
                    type="submit"
                    title="Delete this estimate"
                    style={{
                      background: "transparent",
                      border: 0,
                      cursor: "pointer",
                      color: "var(--pw-text-muted)",
                      font: "500 11px var(--font-inter)",
                    }}
                  >
                    Delete
                  </button>
                </form>
              </header>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr 1fr",
                  gap: 12,
                  padding: 14,
                  borderRadius: 8,
                  background: "var(--pw-surface-muted)",
                }}
              >
                <Stat label="Vet's estimate" value={formatMoney(e.gross_estimate_cents)} muted />
                <Stat
                  label="Insurance pays"
                  value={formatMoney(
                    e.gross_estimate_cents !== null && e.true_oop_cents !== null
                      ? e.gross_estimate_cents - e.true_oop_cents
                      : null,
                  )}
                  muted
                />
                <Stat
                  label="You pay"
                  value={formatMoney(e.true_oop_cents)}
                  emphasis
                />
              </div>

              <div
                style={{
                  marginTop: 10,
                  font: "400 11.5px var(--font-inter)",
                  color: "var(--pw-text-muted)",
                  lineHeight: 1.5,
                }}
              >
                {formatMoney(e.applied_deductible_cents)} deductible applied ·{" "}
                {formatMoney(e.reimbursement_eligible_cents)} eligible at{" "}
                {formatPercent(e.reimbursement_rate)} reimbursement.
              </div>
            </article>
          ))}
        </div>
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
        Informational only. Annual maximums, co-pay variants, and per-condition
        sub-limits aren&apos;t modeled in v1 — verify with the insurer before
        committing. Pawdex never decides whether to file a claim on your behalf.
      </div>
    </div>
  );
}

function Field({
  label,
  hint,
  full,
  children,
}: {
  label: string;
  hint?: string;
  full?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        gridColumn: full ? "1 / -1" : undefined,
        display: "flex",
        flexDirection: "column",
        gap: 4,
      }}
    >
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
      {hint && (
        <span
          style={{
            font: "400 11.5px var(--font-inter)",
            color: "var(--pw-text-muted)",
          }}
        >
          {hint}
        </span>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  emphasis,
  muted,
}: {
  label: string;
  value: React.ReactNode;
  emphasis?: boolean;
  muted?: boolean;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <span
        style={{
          font: "500 10.5px var(--font-inter)",
          color: "var(--pw-text-muted)",
          letterSpacing: "0.04em",
          textTransform: "uppercase",
        }}
      >
        {label}
      </span>
      <span
        className="tnum"
        style={{
          font: emphasis
            ? "700 22px var(--font-source-serif)"
            : "600 15px var(--font-inter)",
          color: emphasis
            ? "var(--pw-accent)"
            : muted
              ? "var(--pw-text)"
              : "var(--pw-text)",
        }}
      >
        {value}
      </span>
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

const selectStyle: React.CSSProperties = { ...inputStyle };

const textareaStyle: React.CSSProperties = {
  width: "100%",
  padding: "10px 12px",
  borderRadius: 6,
  border: "1px solid var(--pw-border-strong)",
  background: "var(--pw-surface)",
  color: "var(--pw-text)",
  font: "400 13px var(--font-inter)",
  outline: "none",
  resize: "vertical",
};
