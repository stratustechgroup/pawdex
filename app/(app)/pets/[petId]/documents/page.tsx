import Link from "next/link";

import { Icon } from "@/components/brand/icon";
import { requireSession } from "@/lib/auth/household";
import { createClient } from "@/lib/supabase/server";
import type { DocumentRow } from "@/lib/supabase/types";

import { DocumentCard } from "./document-card";

export const dynamic = "force-dynamic";

export default async function DocumentsPage({
  params,
}: {
  params: Promise<{ petId: string }>;
}) {
  const { petId } = await params;
  const session = await requireSession();
  const supabase = await createClient();

  const { data } = await supabase
    .from("documents")
    .select(
      "id, original_filename, doc_type, processing_status, uploaded_at, mime_type, byte_size, storage_path, storage_bucket, pet_id, household_id, error_message, extraction_attempts, confirmed_at, processed_at, updated_at, created_by",
    )
    .eq("household_id", session.householdId)
    .eq("pet_id", petId)
    .order("uploaded_at", { ascending: false });

  const docs = (data ?? []) as DocumentRow[];

  // Sign URLs for image thumbnails in one batch
  const thumbMap = new Map<string, string>();
  const imageDocs = docs.filter((d) => d.mime_type?.startsWith("image/"));
  if (imageDocs.length > 0) {
    const { data: signed } = await supabase.storage
      .from("documents")
      .createSignedUrls(
        imageDocs.map((d) => d.storage_path),
        60 * 60,
      );
    if (signed) {
      for (let i = 0; i < signed.length; i++) {
        const s = signed[i];
        if (s.signedUrl) thumbMap.set(imageDocs[i].id, s.signedUrl);
      }
    }
  }

  const counts = (() => {
    let awaiting = 0;
    let confirmed = 0;
    for (const d of docs) {
      if (d.processing_status === "extracted") awaiting++;
      else if (d.processing_status === "confirmed") confirmed++;
    }
    return { total: docs.length, awaiting, confirmed };
  })();

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <div>
          <h2
            style={{
              margin: 0,
              font: "600 16px var(--font-inter)",
              color: "var(--pw-text)",
            }}
          >
            Documents
          </h2>
          <p
            style={{
              margin: "4px 0 0",
              font: "400 12.5px var(--font-inter)",
              color: "var(--pw-text-muted)",
            }}
          >
            {docs.length === 0
              ? "No documents uploaded yet."
              : `${counts.total} total · ${counts.awaiting} awaiting review · ${counts.confirmed} confirmed`}
          </p>
        </div>
        <Link
          href={`/pets/${petId}/upload`}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            height: 32,
            padding: "0 12px",
            borderRadius: 6,
            background: "var(--pw-accent)",
            color: "#fff",
            font: "500 12.5px var(--font-inter)",
            textDecoration: "none",
          }}
        >
          <Icon name="upload" size={13} />
          Upload document
        </Link>
      </div>

      {docs.length === 0 ? (
        <div
          className="pw-card"
          style={{
            padding: 40,
            textAlign: "center",
            borderStyle: "dashed",
            background: "transparent",
          }}
        >
          <p
            style={{
              margin: "0 0 14px",
              font: "400 13px var(--font-inter)",
              color: "var(--pw-text-muted)",
            }}
          >
            Upload a vaccine certificate, vet visit summary, or lab result and
            Pawdex will auto-extract the details for review.
          </p>
          <Link
            href={`/pets/${petId}/upload`}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              height: 36,
              padding: "0 14px",
              borderRadius: 6,
              background: "var(--pw-accent)",
              color: "#fff",
              font: "500 13px var(--font-inter)",
              textDecoration: "none",
            }}
          >
            <Icon name="upload" size={13} />
            Upload your first document
          </Link>
        </div>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
            gap: 14,
          }}
        >
          {docs.map((doc) => (
            <DocumentCard
              key={doc.id}
              doc={doc}
              petId={petId}
              signedThumbUrl={thumbMap.get(doc.id) ?? null}
            />
          ))}
        </div>
      )}
    </div>
  );
}
