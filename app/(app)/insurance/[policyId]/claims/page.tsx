import Link from "next/link";
import { format } from "date-fns";
import { notFound } from "next/navigation";

import { Icon } from "@/components/brand/icon";
import { SectionHead } from "@/components/pawdex/chips";
import { requireSession } from "@/lib/auth/household";
import { getInsurancePolicy } from "@/lib/db/insurance";
import { createClient } from "@/lib/supabase/server";
import type { Claim, ClaimStatus } from "@/lib/supabase/types";

import { createClaim } from "./actions";

export const metadata = { title: "Claims · Pawdex" };
export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<ClaimStatus, string> = {
  drafted: "Drafted",
  submitted: "Submitted",
  approved: "Approved",
  partially_approved: "Partially approved",
  denied: "Denied",
  appealed: "Appealed",
  closed: "Closed",
};

function statusColor(status: ClaimStatus): { bg: string; fg: string } {
  switch (status) {
    case "drafted":
      return { bg: "var(--pw-surface-muted)", fg: "var(--pw-text-muted)" };
    case "submitted":
    case "appealed":
      return { bg: "#fff6e8", fg: "#6a4a10" };
    case "approved":
      return { bg: "var(--pw-accent-soft)", fg: "var(--pw-accent-fg-on-soft)" };
    case "partially_approved":
      return { bg: "var(--pw-accent-soft)", fg: "var(--pw-accent-fg-on-soft)" };
    case "denied":
      return { bg: "#fce8e8", fg: "#7a2424" };
    case "closed":
      return { bg: "var(--pw-surface-muted)", fg: "var(--pw-text-subtle)" };
  }
}

function formatMoney(cents: number | null): string {
  if (cents === null) return "—";
  return `$${(cents / 100).toLocaleString(undefined, {
    minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  })}`;
}

export default async function ClaimsPage({
  params,
}: {
  params: Promise<{ policyId: string }>;
}) {
  const { policyId } = await params;
  const session = await requireSession();
  const supabase = await createClient();
  const policy = await getInsurancePolicy(session.householdId, policyId);
  if (!policy) notFound();

  const { data } = await supabase
    .from("claims")
    .select("*")
    .eq("household_id", session.householdId)
    .eq("insurance_policy_id", policyId)
    .order("service_date", { ascending: false, nullsFirst: false });
  const claims = (data ?? []) as Claim[];

  const totalReimbursed = claims.reduce(
    (acc, c) => acc + (c.amount_reimbursed_cents ?? 0),
    0,
  );
  const submitted = claims.filter((c) => c.status === "submitted").length;
  const pendingDecisions =
    submitted + claims.filter((c) => c.status === "appealed").length;

  return (
    <div
      style={{
        maxWidth: 920,
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
        <span style={{ color: "var(--pw-text)" }}>Claims</span>
      </div>

      <SectionHead
        title="Claims"
        sub={
          claims.length === 0
            ? "Track every claim you file under this policy — drafted, submitted, approved, denied, appealed."
            : `${claims.length} claim${claims.length === 1 ? "" : "s"} · ${pendingDecisions} pending insurer response · ${formatMoney(totalReimbursed)} reimbursed YTD.`
        }
      />

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
          Start a new claim
        </h2>
        <form
          action={createClaim}
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr auto",
            gap: 10,
            alignItems: "end",
          }}
        >
          <input type="hidden" name="policy_id" value={policy.id} />
          <Field label="Service date">
            <input
              type="date"
              name="service_date"
              required
              style={inputStyle}
            />
          </Field>
          <Field label="Total billed ($)">
            <input
              type="number"
              name="total_billed"
              step="0.01"
              min="0"
              placeholder="e.g. 487.50"
              style={inputStyle}
            />
          </Field>
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
            <Icon name="plus" size={12} />
            New claim
          </button>
        </form>
      </section>

      {claims.length === 0 ? (
        <div
          className="pw-card"
          style={{
            padding: 32,
            textAlign: "center",
            borderStyle: "dashed",
            background: "transparent",
            font: "400 13px var(--font-inter)",
            color: "var(--pw-text-muted)",
          }}
        >
          No claims on file. Create one above when you submit a claim to the
          insurer.
        </div>
      ) : (
        <ul
          style={{
            listStyle: "none",
            margin: 0,
            padding: 0,
            display: "flex",
            flexDirection: "column",
            gap: 10,
          }}
        >
          {claims.map((c) => {
            const color = statusColor(c.status);
            return (
              <li
                key={c.id}
                className="pw-card"
                style={{ padding: 14 }}
              >
                <Link
                  href={`/insurance/${policy.id}/claims/${c.id}`}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    color: "inherit",
                    textDecoration: "none",
                  }}
                >
                  <span
                    style={{
                      padding: "2px 8px",
                      borderRadius: 999,
                      background: color.bg,
                      color: color.fg,
                      font: "500 10.5px var(--font-inter)",
                      letterSpacing: "0.04em",
                      textTransform: "uppercase",
                      minWidth: 120,
                      textAlign: "center",
                    }}
                  >
                    {STATUS_LABEL[c.status]}
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        font: "600 13.5px var(--font-inter)",
                        color: "var(--pw-text)",
                      }}
                    >
                      {c.service_date
                        ? format(new Date(c.service_date), "MMM d, yyyy")
                        : "No service date"}
                      {c.claim_number && (
                        <span
                          className="mono"
                          style={{
                            marginLeft: 8,
                            color: "var(--pw-text-muted)",
                            font: "500 11.5px var(--font-jetbrains-mono)",
                          }}
                        >
                          #{c.claim_number}
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
                      Billed {formatMoney(c.total_billed_cents)}
                      {c.amount_approved_cents !== null &&
                        ` · approved ${formatMoney(c.amount_approved_cents)}`}
                      {c.amount_reimbursed_cents !== null &&
                        ` · reimbursed ${formatMoney(c.amount_reimbursed_cents)}`}
                      {c.denial_reason && (
                        <span style={{ color: "#7a2424" }}>
                          {" · "}
                          {c.denial_reason}
                        </span>
                      )}
                    </div>
                  </div>
                  <Icon
                    name="chevronRight"
                    size={14}
                    style={{ color: "var(--pw-text-muted)" }}
                  />
                </Link>
              </li>
            );
          })}
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
        Pawdex tracks what you submitted + what the insurer decided. We never
        decide claim validity on your behalf — every status update is something
        you, the owner, recorded.
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
