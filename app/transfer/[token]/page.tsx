import Link from "next/link";
import { format } from "date-fns";

import { Icon } from "@/components/brand/icon";
import { PawdexMark } from "@/components/brand/mark";
import { PetPhoto } from "@/components/pawdex/pet-photo";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { hashTransferToken } from "@/lib/db/transfers";

import { AcceptTransferForm } from "./accept-form";

export const metadata = { title: "Accept an animal — Pawdex" };
export const dynamic = "force-dynamic";

export default async function TransferAcceptPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  // Resolve the transfer past RLS with the service client, but surface only the
  // transferred animal and who it's from — never the origin household's other
  // data.
  const service = createServiceClient();
  const { data: transfer } = await service
    .from("animal_transfers")
    .select(
      "id, animal_id, from_household_id, recipient_email, message, expires_at, accepted_at, revoked_at, declined_at",
    )
    .eq("token_hash", hashTransferToken(token))
    .maybeSingle();

  let animal:
    | { name: string; species: string; breed: string | null; date_of_birth: string | null; photo_storage_path: string | null }
    | null = null;
  let fromName: string | null = null;
  let photoUrl: string | null = null;
  if (transfer) {
    const [{ data: a }, { data: hh }] = await Promise.all([
      service
        .from("animals")
        .select("name, species, breed, date_of_birth, photo_storage_path")
        .eq("id", transfer.animal_id)
        .maybeSingle(),
      service
        .from("households")
        .select("name")
        .eq("id", transfer.from_household_id)
        .maybeSingle(),
    ]);
    animal = a ?? null;
    fromName = hh?.name ?? null;
    if (a?.photo_storage_path) {
      const { data: signed } = await service.storage
        .from("pet-photos")
        .createSignedUrl(a.photo_storage_path, 60 * 60);
      photoUrl = signed?.signedUrl ?? null;
    }
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const expired =
    transfer && new Date(transfer.expires_at).getTime() < Date.now();

  return (
    <main
      style={{
        flex: 1,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "48px 24px",
        background: "var(--pw-bg)",
        minHeight: "100vh",
      }}
    >
      <div style={{ width: "100%", maxWidth: 460 }}>
        <Link
          href="/"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            color: "var(--pw-text)",
            textDecoration: "none",
            marginBottom: 24,
          }}
        >
          <PawdexMark size={24} color="var(--pw-accent)" />
          <span style={{ font: "600 16px var(--font-inter)" }}>Pawdex</span>
        </Link>

        {!transfer || !animal ? (
          <StateCard
            kind="error"
            title="Invalid transfer link"
            body="This link doesn't match any active transfer. Ask the sender to send a new one."
          />
        ) : transfer.revoked_at ? (
          <StateCard
            kind="error"
            title="Transfer revoked"
            body="The sender revoked this transfer. Ask them to send a new link if you still expect this animal."
          />
        ) : transfer.accepted_at ? (
          <StateCard
            kind="info"
            title="Already accepted"
            body="This transfer has already been completed. Sign in to view the animal in your household."
            actions={
              <Link href="/login" style={btnPrimary}>
                Sign in
              </Link>
            }
          />
        ) : transfer.declined_at ? (
          <StateCard
            kind="error"
            title="Transfer declined"
            body="This transfer was declined. Ask the sender for a fresh link if that was a mistake."
          />
        ) : expired ? (
          <StateCard
            kind="error"
            title="Transfer expired"
            body={`This link expired on ${format(new Date(transfer.expires_at), "MMM d, yyyy")}. Ask the sender for a fresh one.`}
          />
        ) : !user ? (
          <StateCard
            kind="info"
            title={`${fromName ?? "Someone"} wants to transfer ${animal.name} to you`}
            body="Sign in with your email — we'll bring you straight back to accept."
            summary={
              <AnimalSummary animal={animal} fromName={fromName} photoUrl={photoUrl} message={transfer.message} />
            }
            actions={
              <Link
                href={`/login?redirect=${encodeURIComponent(`/transfer/${token}`)}`}
                style={btnPrimary}
              >
                Sign in to accept
              </Link>
            }
          />
        ) : (
          <AcceptTransferForm
            token={token}
            animalName={animal.name}
            fromName={fromName ?? "another household"}
            currentUserEmail={user.email ?? null}
            recipientEmail={transfer.recipient_email}
            summary={
              <AnimalSummary animal={animal} fromName={fromName} photoUrl={photoUrl} message={transfer.message} />
            }
          />
        )}
      </div>
    </main>
  );
}

function AnimalSummary({
  animal,
  fromName,
  photoUrl,
  message,
}: {
  animal: { name: string; species: string; breed: string | null; date_of_birth: string | null };
  fromName: string | null;
  photoUrl: string | null;
  message: string | null;
}) {
  const meta = [
    animal.breed || animal.species,
    animal.date_of_birth
      ? `Born ${format(new Date(animal.date_of_birth), "MMM d, yyyy")}`
      : null,
  ].filter(Boolean);
  return (
    <div style={{ marginTop: 18, textAlign: "left" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: "12px 14px",
          borderRadius: 10,
          background: "var(--pw-surface)",
          border: "1px solid var(--pw-border)",
        }}
      >
        <PetPhoto name={animal.name} src={photoUrl} size={44} />
        <div style={{ minWidth: 0 }}>
          <div style={{ font: "600 14px var(--font-inter)", color: "var(--pw-text)" }}>
            {animal.name}
          </div>
          <div style={{ font: "400 12px var(--font-inter)", color: "var(--pw-text-muted)", marginTop: 2 }}>
            {meta.join(" · ")}
          </div>
        </div>
      </div>
      {message && (
        <div
          style={{
            marginTop: 10,
            padding: "10px 12px",
            borderRadius: 8,
            background: "var(--pw-accent-soft)",
            color: "var(--pw-text)",
            font: "400 12.5px var(--font-inter)",
            lineHeight: 1.5,
          }}
        >
          <span style={{ color: "var(--pw-text-muted)", fontWeight: 500 }}>
            {fromName ? `${fromName}: ` : "Message: "}
          </span>
          {message}
        </div>
      )}
    </div>
  );
}

function StateCard({
  kind,
  title,
  body,
  actions,
  summary,
}: {
  kind: "error" | "info";
  title: string;
  body: string;
  actions?: React.ReactNode;
  summary?: React.ReactNode;
}) {
  const isError = kind === "error";
  return (
    <div className="pw-card" style={{ padding: 28, textAlign: "center" }}>
      <div
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          width: 44,
          height: 44,
          borderRadius: "50%",
          background: isError ? "var(--pw-status-overdue-bg)" : "var(--pw-accent-soft)",
          color: isError ? "var(--pw-status-overdue-fg)" : "var(--pw-accent-fg-on-soft)",
          marginBottom: 14,
        }}
      >
        <Icon name={isError ? "alert" : "paw"} size={20} />
      </div>
      <h1
        className="serif"
        style={{
          margin: "0 0 8px",
          font: "500 22px var(--font-source-serif)",
          color: "var(--pw-text)",
        }}
      >
        {title}
      </h1>
      <p
        style={{
          margin: 0,
          font: "400 13.5px var(--font-inter)",
          color: "var(--pw-text-muted)",
          lineHeight: 1.55,
        }}
      >
        {body}
      </p>
      {summary}
      {actions && (
        <div style={{ marginTop: 18, display: "flex", justifyContent: "center" }}>
          {actions}
        </div>
      )}
    </div>
  );
}

const btnPrimary: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  height: 38,
  padding: "0 18px",
  borderRadius: 6,
  background: "var(--pw-accent)",
  color: "#fff",
  border: "1px solid var(--pw-accent)",
  font: "500 13px var(--font-inter)",
  textDecoration: "none",
  cursor: "pointer",
};
