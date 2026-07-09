import Link from "next/link";
import { format } from "date-fns";

import { Icon } from "@/components/brand/icon";
import { SectionHead } from "@/components/pawdex/chips";
import { requireSession } from "@/lib/auth/household";
import { listInsurancePolicies } from "@/lib/db/insurance";
import { analyzePECForHousehold } from "@/lib/db/pec-analysis";
import { listPetsForHousehold } from "@/lib/db/pets";

import {
  archiveInsurancePolicy,
  createInsurancePolicy,
  retryPolicyExtraction,
} from "./actions";
import { NewPolicyForm } from "./new-policy-form";

export const metadata = { title: "Insurance — Pawdex" };
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

export default async function InsurancePage() {
  const session = await requireSession();
  const [policies, pets, pecAnalysis] = await Promise.all([
    listInsurancePolicies(session.householdId),
    listPetsForHousehold(session.householdId),
    analyzePECForHousehold(session.householdId),
  ]);
  const pecByPolicy = new Map(pecAnalysis.map((p) => [p.policy_id, p]));

  return (
    <div
      style={{
        maxWidth: 1100,
        margin: "0 auto",
        padding: "32px 24px 56px",
        display: "flex",
        flexDirection: "column",
        gap: 28,
      }}
    >
      <SectionHead
        title="Insurance"
        sub={
          policies.length === 0
            ? "Track your pet insurance policies — premiums, deductibles, what's covered, what's excluded."
            : `${policies.length} ${policies.length === 1 ? "policy" : "policies"} on file.`
        }
        right={
          <Link
            href="/insurance/upload"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              height: 30,
              padding: "0 10px",
              borderRadius: 6,
              border: "1px solid var(--pw-accent)",
              background: "var(--pw-accent)",
              color: "var(--pw-accent-fg)",
              font: "500 12px var(--font-inter)",
              textDecoration: "none",
            }}
          >
            <Icon name="upload" size={12} />
            Upload policy PDF
          </Link>
        }
      />

      <details
        className="pw-card"
        style={{
          padding: 0,
          overflow: "hidden",
        }}
      >
        <summary
          style={{
            cursor: "pointer",
            padding: "14px 18px",
            display: "flex",
            alignItems: "center",
            gap: 10,
            background: "var(--pw-surface-muted)",
            font: "500 13.5px var(--font-inter)",
            color: "var(--pw-text)",
            listStyle: "none",
          }}
        >
          <Icon name="plus" size={14} />
          Add a policy
        </summary>
        <div style={{ padding: 18 }}>
          <NewPolicyForm
            pets={pets.map((p) => ({ id: p.id, name: p.name }))}
            action={createInsurancePolicy}
          />
        </div>
      </details>

      {policies.length === 0 ? (
        <div
          className="pw-card"
          style={{
            padding: 40,
            textAlign: "center",
            borderStyle: "dashed",
            background: "transparent",
            font: "400 13px var(--font-inter)",
            color: "var(--pw-text-muted)",
            lineHeight: 1.6,
          }}
        >
          <Icon
            name="shieldCheck"
            size={28}
            style={{ color: "var(--pw-text-subtle)", marginBottom: 10 }}
          />
          <div>No insurance policies tracked yet.</div>
          <div style={{ marginTop: 4 }}>
            Add one above to start tracking premiums, coverage, and exclusions.
          </div>
        </div>
      ) : (
        <div
          style={{
            display: "grid",
            gap: 16,
            gridTemplateColumns: "repeat(auto-fill, minmax(360px, 1fr))",
          }}
        >
          {policies.map((p) => (
            <article
              key={p.id}
              className="pw-card"
              style={{
                padding: 18,
                display: "flex",
                flexDirection: "column",
                gap: 12,
              }}
            >
              <header
                style={{ display: "flex", gap: 12, alignItems: "flex-start" }}
              >
                <span
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 8,
                    background: "var(--pw-accent-soft)",
                    color: "var(--pw-accent-fg-on-soft)",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  <Icon name="shieldCheck" size={16} />
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      font: "600 15px var(--font-inter)",
                      color: "var(--pw-text)",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {p.insurer_name}
                  </div>
                  <div
                    style={{
                      marginTop: 2,
                      font: "400 12px var(--font-inter)",
                      color: "var(--pw-text-muted)",
                    }}
                  >
                    {p.plan_name ?? "—"}
                    {p.pet_name && ` · ${p.pet_name}`}
                  </div>
                </div>
              </header>

              <dl
                style={{
                  margin: 0,
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  rowGap: 8,
                  columnGap: 16,
                  font: "400 12.5px var(--font-inter)",
                }}
              >
                <Cell label="Premium / mo" value={formatMoney(p.premium_monthly_cents)} />
                <Cell label="Reimbursement" value={formatPercent(p.reimbursement_rate)} />
                <Cell
                  label="Deductible / yr"
                  value={formatMoney(p.deductible_annual_cents)}
                />
                <Cell label="Annual max" value={formatMoney(p.annual_max_cents)} />
                <Cell
                  label="Effective"
                  value={
                    p.effective_on
                      ? format(new Date(p.effective_on), "MMM d, yyyy")
                      : "—"
                  }
                />
                <Cell
                  label="Renews"
                  value={
                    p.renews_on
                      ? format(new Date(p.renews_on), "MMM d, yyyy")
                      : "—"
                  }
                />
              </dl>

              {p.extracted_exclusions && p.extracted_exclusions.length > 0 && (
                <details>
                  <summary
                    style={{
                      cursor: "pointer",
                      font: "500 11px var(--font-inter)",
                      color: "var(--pw-text-muted)",
                      letterSpacing: "0.04em",
                      textTransform: "uppercase",
                    }}
                  >
                    Exclusions ({p.extracted_exclusions.length})
                  </summary>
                  <ul
                    style={{
                      margin: "8px 0 0",
                      paddingLeft: 18,
                      font: "400 12px var(--font-inter)",
                      color: "var(--pw-text-secondary)",
                    }}
                  >
                    {p.extracted_exclusions.map((e, i) => (
                      <li key={i}>{e}</li>
                    ))}
                  </ul>
                </details>
              )}

              {(() => {
                const pec = pecByPolicy.get(p.id);
                if (!pec || pec.flagged.length === 0) return null;
                return (
                  <div
                    style={{
                      padding: 12,
                      borderRadius: 8,
                      background: "#fff6e8",
                      border: "1px solid #f0c674",
                      color: "#6a4a10",
                      display: "flex",
                      flexDirection: "column",
                      gap: 8,
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                        font: "600 11px var(--font-inter)",
                        letterSpacing: "0.04em",
                        textTransform: "uppercase",
                      }}
                    >
                      <Icon name="alert" size={12} />
                      Possible pre-existing match
                      <span
                        style={{
                          marginLeft: "auto",
                          font: "500 11px var(--font-inter)",
                          letterSpacing: 0,
                          textTransform: "none",
                        }}
                      >
                        {pec.flagged.length} event
                        {pec.flagged.length === 1 ? "" : "s"}
                      </span>
                    </div>
                    <ul
                      style={{
                        listStyle: "none",
                        margin: 0,
                        padding: 0,
                        display: "flex",
                        flexDirection: "column",
                        gap: 8,
                        font: "400 12px var(--font-inter)",
                      }}
                    >
                      {pec.flagged.slice(0, 4).map((e) => (
                        <li key={e.event_id}>
                          <div style={{ fontWeight: 500 }}>
                            {format(new Date(e.occurred_on), "MMM d, yyyy")} ·{" "}
                            {e.title}
                          </div>
                          <div style={{ fontSize: 11, color: "#8a6418" }}>
                            looks like &ldquo;{e.matches[0].exclusion}&rdquo;
                          </div>
                        </li>
                      ))}
                      {pec.flagged.length > 4 && (
                        <li style={{ fontSize: 11, color: "#8a6418" }}>
                          + {pec.flagged.length - 4} more
                        </li>
                      )}
                    </ul>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        gap: 8,
                        font: "400 10.5px var(--font-inter)",
                        color: "#8a6418",
                      }}
                    >
                      <span>
                        Informational only — verify with insurer before filing.
                      </span>
                      <Link
                        href={`/insurance/${p.id}/pec-analysis`}
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 3,
                          font: "500 11px var(--font-inter)",
                          color: "#6a4a10",
                          textDecoration: "underline",
                          textUnderlineOffset: 2,
                        }}
                      >
                        Refine with AI
                        <Icon name="chevronRight" size={10} />
                      </Link>
                    </div>
                  </div>
                );
              })()}

              {p.insurer_name === "Pending extraction…" && (
                <div
                  style={{
                    padding: 10,
                    background: "var(--pw-pending-bg)",
                    color: "var(--pw-pending-fg)",
                    borderRadius: 8,
                    font: "400 12px var(--font-inter)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 10,
                  }}
                >
                  <span>
                    Extraction hasn&apos;t completed for this PDF yet. If it
                    failed, retry below.
                  </span>
                  <form action={retryPolicyExtraction}>
                    <input type="hidden" name="policy_id" value={p.id} />
                    <button
                      type="submit"
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 4,
                        height: 26,
                        padding: "0 10px",
                        borderRadius: 5,
                        border: "1px solid currentColor",
                        background: "transparent",
                        color: "inherit",
                        font: "500 11.5px var(--font-inter)",
                        cursor: "pointer",
                      }}
                    >
                      <Icon name="refresh" size={11} />
                      Retry
                    </button>
                  </form>
                </div>
              )}

              <footer
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  paddingTop: 8,
                  borderTop: "1px solid var(--pw-border)",
                  gap: 8,
                }}
              >
                <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
                  <Link
                    href={`/insurance/${p.id}/estimate`}
                    style={cardActionStyle}
                  >
                    <Icon name="sparkles" size={11} />
                    Estimate
                  </Link>
                  <Link
                    href={`/insurance/${p.id}/clarify`}
                    style={cardActionStyle}
                  >
                    <Icon name="mail" size={11} />
                    Ask insurer
                  </Link>
                  <Link
                    href={`/insurance/${p.id}/claims`}
                    style={cardActionStyle}
                  >
                    <Icon name="receipt" size={11} />
                    Claims
                  </Link>
                </div>
                <form action={archiveInsurancePolicy}>
                  <input type="hidden" name="policy_id" value={p.id} />
                  <button
                    type="submit"
                    style={{
                      font: "500 11.5px var(--font-inter)",
                      color: "var(--pw-text-muted)",
                      background: "transparent",
                      border: 0,
                      cursor: "pointer",
                      padding: 0,
                    }}
                    title="Archive this policy"
                  >
                    Archive
                  </button>
                </form>
              </footer>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

const cardActionStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 4,
  font: "500 11.5px var(--font-inter)",
  color: "var(--pw-accent)",
  textDecoration: "none",
};

function Cell({ label, value }: { label: string; value: React.ReactNode }) {
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
        style={{ font: "500 13.5px var(--font-inter)", color: "var(--pw-text)" }}
      >
        {value}
      </span>
    </div>
  );
}
