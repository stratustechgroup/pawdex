import { notFound } from "next/navigation";

import { Icon } from "@/components/brand/icon";
import { DocumentUploader } from "@/components/pawdex/document-uploader";
import { PetPhoto } from "@/components/pawdex/pet-photo";
import { requireSession } from "@/lib/auth/household";
import { createClient } from "@/lib/supabase/server";
import { getPet } from "@/lib/db/pets";

import { CopyInboxButton } from "./copy-inbox-button";

export const dynamic = "force-dynamic";

function slug(input: string): string {
  return (
    input
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "")
      .slice(0, 32) || "household"
  );
}

export default async function UploadPage({
  params,
}: {
  params: Promise<{ petId: string }>;
}) {
  const { petId } = await params;
  const session = await requireSession();
  const pet = await getPet(session.householdId, petId);
  if (!pet) notFound();

  const inboxAddress = `inbox+${slug(session.householdName)}@pawdex.app`;

  // Resolve photo URL for the compact pet avatar in the page header.
  const supabase = await createClient();
  let photoUrl: string | null = null;
  if (pet.photo_storage_path) {
    const { data } = await supabase.storage
      .from("pet-photos")
      .createSignedUrl(pet.photo_storage_path, 60 * 60);
    photoUrl = data?.signedUrl ?? null;
  }

  return (
    <div
      style={{
        maxWidth: 720,
        margin: "0 auto",
        display: "flex",
        flexDirection: "column",
        gap: 22,
      }}
    >
      {/* Compact page header — small pet avatar + title + subtitle. The
          larger pet detail header (from layout.tsx) still sits above this. */}
      <header
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
        }}
      >
        <PetPhoto name={pet.name} src={photoUrl} size={44} />
        <div>
          <h1
            className="serif"
            style={{
              margin: 0,
              fontSize: 22,
              fontWeight: 500,
              letterSpacing: "-0.015em",
              color: "var(--pw-text)",
            }}
          >
            Add to {pet.name}&rsquo;s record
          </h1>
          <p
            style={{
              margin: "2px 0 0",
              font: "400 12.5px var(--font-inter)",
              color: "var(--pw-text-muted)",
            }}
          >
            Drop multiple files — they&rsquo;re processed in parallel.
          </p>
        </div>
      </header>

      <DocumentUploader householdId={session.householdId} petId={petId} />

      {/* Forwarding card — separate "have your vet email it" affordance.
          Renders the inbox slug as a faux input with a Copy button on the
          end, matching the polished reference. */}
      <section
        className="pw-card"
        style={{
          padding: 16,
          display: "flex",
          alignItems: "flex-start",
          gap: 14,
        }}
      >
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: 8,
            background: "var(--pw-accent-soft)",
            color: "var(--pw-accent)",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <Icon name="mail" size={16} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              flexWrap: "wrap",
            }}
          >
            <span
              style={{
                font: "600 13.5px var(--font-inter)",
                color: "var(--pw-text)",
              }}
            >
              Forward documents from your vet
            </span>
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
                padding: "2px 7px",
                borderRadius: 999,
                background: "var(--pw-accent-soft)",
                color: "var(--pw-accent-fg-on-soft)",
                font: "600 10px var(--font-inter)",
                letterSpacing: "0.03em",
                textTransform: "uppercase",
              }}
            >
              Recommended
            </span>
          </div>
          <p
            style={{
              margin: "4px 0 10px",
              font: "400 12.5px var(--font-inter)",
              color: "var(--pw-text-muted)",
              lineHeight: 1.5,
            }}
          >
            Have any clinic email records to this address. We file by pet
            automatically and tag the source.
          </p>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 0,
              border: "1px solid var(--pw-border)",
              borderRadius: 6,
              background: "var(--pw-surface)",
              overflow: "hidden",
            }}
          >
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                color: "var(--pw-text-muted)",
                padding: "0 8px 0 10px",
                flexShrink: 0,
              }}
            >
              <Icon name="mail" size={13} />
            </span>
            <span
              className="mono"
              style={{
                flex: 1,
                minWidth: 0,
                font: "500 12.5px var(--font-jetbrains)",
                color: "var(--pw-text-secondary)",
                padding: "8px 6px",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {inboxAddress}
            </span>
            <div style={{ padding: 4, flexShrink: 0 }}>
              <CopyInboxButton value={inboxAddress} />
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
