import Link from "next/link";
import { notFound } from "next/navigation";

import { Icon } from "@/components/brand/icon";
import { SectionHead } from "@/components/pawdex/chips";
import { requireSession } from "@/lib/auth/household";
import { getInsurancePolicy } from "@/lib/db/insurance";
import { createClient } from "@/lib/supabase/server";
import type { Claim, ClaimStatus } from "@/lib/supabase/types";

import { deleteClaim, updateClaim } from "../actions";

export const metadata = { title: "Claim — Pawdex" };
export const dynamic = "force-dynamic";

const STATUS_OPTIONS: { value: ClaimStatus; label: string }[] = [
  { value: "drafted", label: "Drafted" },
  { value: "submitted", label: "Submitted" },
  { value: "approved", label: "Approved" },
  { value: "partially_approved", label: "Partially approved" },
  { value: "denied", label: "Denied" },
  { value: "appealed", label: "Appealed" },
  { value: "closed", label: "Closed" },
];

export default async function ClaimDetailPage({
  params,
}: {
  params: Promise<{ policyId: string; claimId: string }>;
}) {
  const { policyId, claimId } = await params;
  const session = await requireSession();
  const supabase = await createClient();
  const policy = await getInsurancePolicy(session.householdId, policyId);
  if (!policy) notFound();

  const { data } = await supabase
    .from("claims")
    .select("*")
    .eq("household_id", session.householdId)
    .eq("id", claimId)
    .maybeSingle();
  if (!data) notFound();
  const claim = data as Claim;

  return (
    <div
      style={{
        maxWidth: 820,
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
        <Link
          href={`/insurance/${policy.id}/claims`}
          style={{ color: "inherit", textDecoration: "none" }}
        >
          {policy.insurer_name} claims
        </Link>
        <Icon name="chevronRight" size={12} />
        <span style={{ color: "var(--pw-text)" }}>
          {claim.claim_number ?? "Claim"}
        </span>
      </div>

      <SectionHead
        title="Claim details"
        sub="Record exactly what you submitted and what the insurer decided. Every status change is audit-logged."
      />

      <form
        action={updateClaim}
        className="pw-card"
        style={{
          padding: 18,
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 12,
        }}
      >
        <input type="hidden" name="claim_id" value={claim.id} />
        <input type="hidden" name="policy_id" value={policy.id} />

        <div style={{ gridColumn: "1 / -1" }}>
          <Label>Status</Label>
          <select
            name="status"
            defaultValue={claim.status}
            style={inputStyle}
          >
            {STATUS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        <Field label="Service date">
          <input
            type="date"
            name="service_date"
            defaultValue={claim.service_date ?? ""}
            style={inputStyle}
          />
        </Field>
        <Field label="Claim number">
          <input
            type="text"
            name="claim_number"
            defaultValue={claim.claim_number ?? ""}
            style={inputStyle}
          />
        </Field>

        <Field label="Submitted on">
          <input
            type="date"
            name="submitted_on"
            defaultValue={claim.submitted_on ?? ""}
            style={inputStyle}
          />
        </Field>
        <Field label="Decided on">
          <input
            type="date"
            name="decided_on"
            defaultValue={claim.decided_on ?? ""}
            style={inputStyle}
          />
        </Field>

        <Field label="Total billed ($)">
          <input
            type="number"
            name="total_billed"
            step="0.01"
            min="0"
            defaultValue={
              claim.total_billed_cents !== null
                ? (claim.total_billed_cents / 100).toFixed(2)
                : ""
            }
            style={inputStyle}
          />
        </Field>
        <Field label="Amount approved ($)">
          <input
            type="number"
            name="amount_approved"
            step="0.01"
            min="0"
            defaultValue={
              claim.amount_approved_cents !== null
                ? (claim.amount_approved_cents / 100).toFixed(2)
                : ""
            }
            style={inputStyle}
          />
        </Field>

        <Field label="Amount reimbursed ($)">
          <input
            type="number"
            name="amount_reimbursed"
            step="0.01"
            min="0"
            defaultValue={
              claim.amount_reimbursed_cents !== null
                ? (claim.amount_reimbursed_cents / 100).toFixed(2)
                : ""
            }
            style={inputStyle}
          />
        </Field>
        <Field label="Denial reason (if denied)">
          <input
            type="text"
            name="denial_reason"
            defaultValue={claim.denial_reason ?? ""}
            style={inputStyle}
            placeholder="e.g. Pre-existing — bilateral hip dysplasia"
          />
        </Field>

        <div style={{ gridColumn: "1 / -1" }}>
          <Label>Notes</Label>
          <textarea
            name="notes"
            rows={3}
            defaultValue={claim.notes ?? ""}
            style={{
              ...inputStyle,
              height: "auto",
              padding: "10px 12px",
              resize: "vertical",
            }}
          />
        </div>

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
            <Icon name="check" size={12} />
            Save changes
          </button>
        </div>
      </form>

      {(claim.status === "denied" || claim.status === "partially_approved") &&
        claim.denial_reason && (
          <div
            className="pw-card"
            style={{
              padding: 16,
              borderLeft: "3px solid #b54a4a",
              display: "flex",
              flexDirection: "column",
              gap: 8,
            }}
          >
            <div
              style={{
                font: "600 13px var(--font-inter)",
                color: "var(--pw-text)",
              }}
            >
              Considering an appeal?
            </div>
            <p
              style={{
                margin: 0,
                font: "400 12.5px var(--font-inter)",
                color: "var(--pw-text-secondary)",
                lineHeight: 1.55,
              }}
            >
              Pawdex can draft a neutral, factual appeal email to the insurer
              via the existing clarification flow. You review and approve every
              draft before it sends.
            </p>
            <Link
              href={`/insurance/${policy.id}/clarify`}
              style={{
                display: "inline-flex",
                alignSelf: "flex-start",
                alignItems: "center",
                gap: 6,
                height: 32,
                padding: "0 14px",
                borderRadius: 6,
                border: "1px solid var(--pw-border-strong)",
                background: "var(--pw-surface)",
                color: "var(--pw-text)",
                font: "500 12px var(--font-inter)",
                textDecoration: "none",
              }}
            >
              <Icon name="mail" size={12} />
              Draft appeal email
            </Link>
          </div>
        )}

      <form
        action={deleteClaim}
        style={{ display: "flex", justifyContent: "flex-end" }}
      >
        <input type="hidden" name="claim_id" value={claim.id} />
        <input type="hidden" name="policy_id" value={policy.id} />
        <button
          type="submit"
          style={{
            font: "500 11.5px var(--font-inter)",
            color: "var(--pw-text-muted)",
            background: "transparent",
            border: 0,
            cursor: "pointer",
          }}
        >
          Delete this claim
        </button>
      </form>
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
      <Label>{label}</Label>
      {children}
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <span
      style={{
        font: "500 11px var(--font-inter)",
        color: "var(--pw-text-muted)",
        letterSpacing: "0.04em",
        textTransform: "uppercase",
      }}
    >
      {children}
    </span>
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
