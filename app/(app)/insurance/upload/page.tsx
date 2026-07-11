import Link from "next/link";

import { Icon } from "@/components/brand/icon";
import { SectionHead } from "@/components/pawdex/chips";
import { requireSession } from "@/lib/auth/household";
import { listPetsForHousehold } from "@/lib/db/pets";

import { UploadPolicyForm } from "./upload-form";

export const metadata = { title: "Upload policy · Pawdex" };
export const dynamic = "force-dynamic";

export default async function UploadPolicyPage() {
  const session = await requireSession();
  const pets = await listPetsForHousehold(session.householdId);

  return (
    <div
      style={{
        maxWidth: 720,
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
        <span style={{ color: "var(--pw-text)" }}>Upload</span>
      </div>

      <SectionHead
        title="Upload an insurance policy"
        sub="PDF or image. Pawdex sends it to Sonnet to extract insurer, deductible, reimbursement, exclusions, and PEC definitions. The extraction takes ~30 seconds."
      />

      <UploadPolicyForm pets={pets.map((p) => ({ id: p.id, name: p.name }))} />
    </div>
  );
}
