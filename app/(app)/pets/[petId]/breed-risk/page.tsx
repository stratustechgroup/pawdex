import Link from "next/link";
import { notFound } from "next/navigation";

import { Icon } from "@/components/brand/icon";
import { requireSession } from "@/lib/auth/household";
import { createClient } from "@/lib/supabase/server";

// Breed risk profile is intentionally paused (Phase 6.37, May 2026). The
// data + helpers in lib/clinical/breed-risk.ts remain in the repo for the
// day we pick this back up — but the UI is hidden because:
//   (1) the matrix only covers ~10 breeds, far short of useful coverage,
//   (2) we have no editorial / reviewer workflow for veterinary medical
//       claims, and
//   (3) the legal exposure on "this might happen to your pet" claims
//       without a clinician reviewer is asymmetric.
// Re-enable by restoring the tab entry in pet-tabs.tsx and replacing this
// body with a real report. See README "Phase 6.37 — Breed risk pulled".

export const metadata = { title: "Breed risk — Pawdex" };
export const dynamic = "force-dynamic";

export default async function BreedRiskPausedPage({
  params,
}: {
  params: Promise<{ petId: string }>;
}) {
  const { petId } = await params;
  const session = await requireSession();
  const supabase = await createClient();

  // Confirm the pet exists + belongs to the household so we 404 cleanly on
  // a stale link rather than render a generic message for a bogus URL.
  const { data: pet } = await supabase
    .from("pets")
    .select("id, name")
    .eq("household_id", session.householdId)
    .eq("id", petId)
    .maybeSingle();
  if (!pet) notFound();

  return (
    <div
      style={{
        maxWidth: 640,
        margin: "0 auto",
        padding: "48px 24px",
      }}
    >
      <div
        className="pw-card"
        style={{
          padding: 28,
          display: "flex",
          flexDirection: "column",
          gap: 14,
          textAlign: "center",
        }}
      >
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: 48,
            height: 48,
            borderRadius: "50%",
            background: "var(--pw-surface-2)",
            color: "var(--pw-text-muted)",
            margin: "0 auto",
          }}
        >
          <Icon name="info" size={20} />
        </div>
        <h1
          className="serif"
          style={{
            margin: 0,
            font: "500 22px var(--font-source-serif)",
            color: "var(--pw-text)",
            letterSpacing: "-0.015em",
          }}
        >
          Breed risk profile is paused
        </h1>
        <p
          style={{
            margin: "0 auto",
            maxWidth: 480,
            font: "400 13.5px var(--font-inter)",
            color: "var(--pw-text-secondary)",
            lineHeight: 1.6,
          }}
        >
          Pawdex is pausing the breed risk profile while we expand our
          editorial process. Breed-specific health information is medically
          significant and deserves a higher bar than we&rsquo;re ready to ship
          today — comprehensive coverage, reviewer-vetted claims, and clear
          source citations on every statement.
        </p>
        <p
          style={{
            margin: 0,
            font: "400 12.5px var(--font-inter)",
            color: "var(--pw-text-muted)",
            lineHeight: 1.5,
          }}
        >
          In the meantime, your vet remains the best source for
          breed-specific screening recommendations. The AAHA Canine and AAFP
          Feline Lifestage Guidelines are also worth asking about at your
          next visit.
        </p>
        <div
          style={{
            display: "flex",
            gap: 8,
            justifyContent: "center",
            marginTop: 8,
            flexWrap: "wrap",
          }}
        >
          <Link
            href={`/pets/${pet.id}`}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              height: 34,
              padding: "0 14px",
              borderRadius: 6,
              background: "var(--pw-accent)",
              color: "#FAF9F6",
              font: "500 12.5px var(--font-inter)",
              textDecoration: "none",
              border: "1px solid var(--pw-accent)",
            }}
          >
            <Icon name="arrowLeft" size={13} />
            Back to {pet.name}
          </Link>
          <Link
            href={`/pets/${pet.id}/briefing`}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              height: 34,
              padding: "0 14px",
              borderRadius: 6,
              border: "1px solid var(--pw-border-strong)",
              background: "var(--pw-surface)",
              color: "var(--pw-text)",
              font: "500 12.5px var(--font-inter)",
              textDecoration: "none",
            }}
          >
            <Icon name="fileText" size={13} />
            Pre-visit briefing
          </Link>
        </div>
      </div>
    </div>
  );
}
