import Link from "next/link";
import { notFound } from "next/navigation";

import { Icon } from "@/components/brand/icon";
import { SectionHead } from "@/components/pawdex/chips";
import { requireSession } from "@/lib/auth/household";
import { getEffectiveAuthorization } from "@/lib/auth/authorizations";
import { getInsurancePolicy } from "@/lib/db/insurance";

import { ClarifyFlow } from "./clarify-flow";

export const metadata = { title: "Ask the insurer · Pawdex" };
export const dynamic = "force-dynamic";

export default async function ClarifyPage({
  params,
}: {
  params: Promise<{ policyId: string }>;
}) {
  const { policyId } = await params;
  const session = await requireSession();
  const policy = await getInsurancePolicy(session.householdId, policyId);
  if (!policy) notFound();

  const auth = await getEffectiveAuthorization(
    session.householdId,
    "insurer_clarification_emails",
  );

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
        <span style={{ color: "var(--pw-text)" }}>Ask the insurer</span>
      </div>

      <SectionHead
        title="Ask the insurer for a clarification"
        sub="Pawdex drafts a neutral, factual email on your behalf. You always review and approve before sending."
      />

      {!auth && (
        <div
          style={{
            padding: 14,
            background: "var(--pw-pending-bg)",
            color: "var(--pw-pending-fg)",
            borderRadius: 8,
            font: "400 12.5px var(--font-inter)",
            display: "flex",
            gap: 10,
            alignItems: "center",
          }}
        >
          <Icon name="shieldCheck" size={14} />
          <span>
            Drafting is available now, but Pawdex won&apos;t send on your behalf
            without the{" "}
            <Link
              href="/settings/authorizations"
              style={{
                color: "inherit",
                textDecoration: "underline",
                textUnderlineOffset: 2,
                fontWeight: 500,
              }}
            >
              Draft clarification emails to my insurer
            </Link>{" "}
            authorization. Grant it and come back to send.
          </span>
        </div>
      )}

      <ClarifyFlow policyId={policy.id} insurerName={policy.insurer_name} />
    </div>
  );
}
