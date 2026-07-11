import Link from "next/link";
import { format } from "date-fns";
import { notFound } from "next/navigation";

import { Icon } from "@/components/brand/icon";
import { SectionHead } from "@/components/pawdex/chips";
import { requireSession } from "@/lib/auth/household";
import { getInsurancePolicy } from "@/lib/db/insurance";
import { analyzePECForHousehold } from "@/lib/db/pec-analysis";

import { RefineButton } from "./refine-button";

export const metadata = { title: "Pre-existing risk · Pawdex" };
export const dynamic = "force-dynamic";

export default async function PecAnalysisPage({
  params,
}: {
  params: Promise<{ policyId: string }>;
}) {
  const { policyId } = await params;
  const session = await requireSession();

  const [policy, allAnalyses] = await Promise.all([
    getInsurancePolicy(session.householdId, policyId),
    analyzePECForHousehold(session.householdId),
  ]);
  if (!policy) notFound();
  const analysis = allAnalyses.find((a) => a.policy_id === policy.id) ?? null;

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
        <span style={{ color: "var(--pw-text)" }}>Pre-existing risk</span>
      </div>

      <SectionHead
        title="Pre-existing condition risk"
        sub={
          analysis && analysis.flagged.length > 0
            ? `Heuristic matched ${analysis.flagged.length} medical event${analysis.flagged.length === 1 ? "" : "s"} against ${analysis.exclusions_count} exclusion${analysis.exclusions_count === 1 ? "" : "s"}. Heuristic over-flags — use the AI confirm button below to filter false positives.`
            : "No heuristic matches found between this policy's exclusions and your pet's medical history."
        }
      />

      {!analysis || analysis.flagged.length === 0 ? (
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
          Nothing flagged. Add more medical history to this pet or check that the
          policy&apos;s exclusions are filled in.
        </div>
      ) : (
        <RefineButton policyId={policy.id} initialAnalysis={analysis} />
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
        Informational only — verify with the insurer before filing a claim.
        Pawdex never decides claim eligibility on your behalf.{" "}
        {format(new Date(), "MMM d, yyyy")}
      </div>
    </div>
  );
}
