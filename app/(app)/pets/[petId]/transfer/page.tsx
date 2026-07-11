import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { Icon } from "@/components/brand/icon";
import { requireSession } from "@/lib/auth/household";
import { createClient } from "@/lib/supabase/server";
import { getPet } from "@/lib/db/pets";

import { TransferPanel } from "./transfer-form";

export const metadata = { title: "Transfer animal · Pawdex" };

export default async function TransferPage({
  params,
}: {
  params: Promise<{ petId: string }>;
}) {
  const { petId } = await params;
  const session = await requireSession();

  const pet = await getPet(session.householdId, petId);
  if (!pet) notFound();

  // Owner-only surface. Non-owners are bounced back to the pet.
  if (session.role !== "owner") {
    redirect(`/pets/${petId}`);
  }

  // Pending transfers for this animal, readable by origin-household members
  // under RLS. Only rows that are still open (not accepted / revoked / declined).
  const supabase = await createClient();
  const pending = pet.animal_id
    ? (
        await supabase
          .from("animal_transfers")
          .select("id, recipient_email, created_at, expires_at")
          .eq("animal_id", pet.animal_id)
          .eq("from_household_id", session.householdId)
          .is("accepted_at", null)
          .is("revoked_at", null)
          .is("declined_at", null)
          .order("created_at", { ascending: false })
      ).data ?? []
    : [];

  return (
    <main style={{ maxWidth: 620, margin: "0 auto", padding: "8px 4px 48px" }}>
      <Link
        href={`/pets/${petId}`}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          font: "500 12.5px var(--font-inter)",
          color: "var(--pw-text-muted)",
          textDecoration: "none",
          marginBottom: 16,
        }}
      >
        <Icon name="arrowLeft" size={14} />
        Back to {pet.name}
      </Link>

      <div style={{ marginBottom: 22 }}>
        <h1
          className="serif"
          style={{
            margin: "0 0 6px",
            font: "500 24px var(--font-source-serif)",
            color: "var(--pw-text)",
          }}
        >
          Transfer {pet.name}
        </h1>
        <p
          style={{
            margin: 0,
            font: "400 13px var(--font-inter)",
            color: "var(--pw-text-muted)",
            lineHeight: 1.6,
          }}
        >
          Create a secure link the new owner opens to accept {pet.name}. When they
          accept, {pet.name}&apos;s medical record travels with them. Your
          household&apos;s business, consent, and communication history stays
          private.
        </p>
      </div>

      <TransferPanel
        petId={petId}
        petName={pet.name}
        canTransfer={Boolean(pet.animal_id)}
        pending={pending.map((p) => ({
          id: p.id,
          recipientEmail: p.recipient_email,
          createdAt: p.created_at,
          expiresAt: p.expires_at,
        }))}
      />
    </main>
  );
}
