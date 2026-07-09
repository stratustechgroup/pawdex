import Link from "next/link";
import { format, formatDistanceToNow } from "date-fns";

import { Icon } from "@/components/brand/icon";
import { SectionHead } from "@/components/pawdex/chips";
import { requireSession } from "@/lib/auth/household";
import { listUnassignedDocuments } from "@/lib/db/documents";
import { listPetsForHousehold } from "@/lib/db/pets";

import { DeleteDocumentButton } from "@/app/(app)/pets/[petId]/documents/[docId]/delete-document-button";

import { AssignPetForm } from "./assign-pet-form";

export const metadata = { title: "Inbox — Pawdex" };
export const dynamic = "force-dynamic";

export default async function InboxPage() {
  const session = await requireSession();
  const [documents, pets] = await Promise.all([
    listUnassignedDocuments(session.householdId),
    listPetsForHousehold(session.householdId),
  ]);

  return (
    <div
      style={{
        maxWidth: 900,
        margin: "0 auto",
        padding: "32px 24px 56px",
      }}
    >
      <SectionHead
        title="Inbox"
        sub={
          documents.length === 0
            ? "Documents forwarded to your inbound address land here, waiting to be routed to a pet."
            : `${documents.length} ${documents.length === 1 ? "document" : "documents"} waiting to be assigned to a pet.`
        }
        right={
          <Link
            href="/help/email-forwarding"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              height: 30,
              padding: "0 10px",
              borderRadius: 6,
              border: "1px solid var(--pw-border-strong)",
              background: "var(--pw-surface)",
              color: "var(--pw-text)",
              font: "500 12px var(--font-inter)",
              textDecoration: "none",
            }}
          >
            <Icon name="mail" size={12} />
            Set up auto-forwarding
          </Link>
        }
      />

      {documents.length === 0 ? (
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
            name="inbox"
            size={28}
            style={{ color: "var(--pw-text-subtle)", marginBottom: 10 }}
          />
          <div>Forward any vet email to your household&apos;s inbound address.</div>
          <div style={{ marginTop: 4 }}>
            Attachments will land here, pre-extracted and ready to assign.
          </div>
        </div>
      ) : pets.length === 0 ? (
        <div
          className="pw-card"
          style={{
            padding: 24,
            background: "var(--pw-info-bg)",
            color: "var(--pw-info-fg)",
            font: "400 13px var(--font-inter)",
          }}
        >
          You have inbound documents but no pets to assign them to. Add a pet
          first, then come back here.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {documents.map((doc) => (
            <article
              key={doc.id}
              className="pw-card"
              style={{
                padding: 16,
                display: "flex",
                gap: 14,
                alignItems: "flex-start",
              }}
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
                <Icon
                  name={
                    doc.mime_type?.startsWith("image/") ? "camera" : "fileText"
                  }
                  size={16}
                />
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    font: "600 14px var(--font-inter)",
                    color: "var(--pw-text)",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {doc.original_filename ?? "Untitled document"}
                </div>
                <div
                  style={{
                    marginTop: 3,
                    font: "400 12px var(--font-inter)",
                    color: "var(--pw-text-muted)",
                    display: "flex",
                    gap: 10,
                    flexWrap: "wrap",
                  }}
                >
                  <span>
                    Arrived{" "}
                    {formatDistanceToNow(new Date(doc.uploaded_at), {
                      addSuffix: true,
                    })}
                  </span>
                  <span>·</span>
                  <span title={format(new Date(doc.uploaded_at), "PPpp")}>
                    {format(new Date(doc.uploaded_at), "MMM d, yyyy")}
                  </span>
                  <span>·</span>
                  <span style={{ textTransform: "capitalize" }}>
                    {doc.processing_status.replace("_", " ")}
                  </span>
                </div>
                <div
                  style={{
                    marginTop: 12,
                    display: "flex",
                    gap: 10,
                    alignItems: "center",
                    flexWrap: "wrap",
                  }}
                >
                  <div style={{ flex: 1, minWidth: 240 }}>
                    <AssignPetForm
                      documentId={doc.id}
                      pets={pets.map((p) => ({ id: p.id, name: p.name }))}
                    />
                  </div>
                  <DeleteDocumentButton
                    documentId={doc.id}
                    petId=""
                    filename={doc.original_filename}
                    variant="ghost"
                    redirectAfter={false}
                  />
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
