import Link from "next/link";
import { format } from "date-fns";

import { Icon } from "@/components/brand/icon";
import { PendingChip } from "@/components/pawdex/chips";
import type { DocumentRow } from "@/lib/supabase/types";

import { DeleteDocumentButton } from "../documents/[docId]/delete-document-button";

function prettyDocType(t: string): string {
  return t.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function statusPill(status: DocumentRow["processing_status"]) {
  switch (status) {
    case "pending":
      return <PendingChip label="Queued" />;
    case "extracting":
      return <PendingChip label="Reading…" />;
    case "extracted":
      return <span className="pw-badge due">Needs review</span>;
    case "confirmed":
      return <span className="pw-badge up">Confirmed</span>;
    case "failed":
      return <span className="pw-badge overdue">Failed</span>;
    default:
      return null;
  }
}

export function DocumentCard({
  doc,
  signedThumbUrl,
  petId,
}: {
  doc: DocumentRow;
  signedThumbUrl: string | null;
  petId: string;
}) {
  const isImage = doc.mime_type?.startsWith("image/") ?? false;
  const title =
    doc.original_filename?.trim() ||
    prettyDocType(doc.doc_type) ||
    "Untitled document";
  const captionDate = format(new Date(doc.uploaded_at), "MMM d");
  const caption = `${prettyDocType(doc.doc_type)} · ${captionDate}`;

  return (
    <div
      className="pw-card"
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 10,
        padding: 14,
      }}
    >
      {/* Clickable region — thumbnail + title + caption. Stops at the
       *  footer row so the Delete button doesn't accidentally trigger nav. */}
      <Link
        href={`/pets/${petId}/documents/${doc.id}`}
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 10,
          textDecoration: "none",
          color: "inherit",
        }}
      >
        {/* Thumbnail strip */}
        <div
          style={{
            height: 80,
            borderRadius: 6,
            background: "var(--pw-surface-2)",
            border: "1px solid var(--pw-border)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            overflow: "hidden",
            position: "relative",
          }}
        >
          {isImage && signedThumbUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={signedThumbUrl}
              alt={title}
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
                display: "block",
              }}
            />
          ) : (
            <div style={{ color: "var(--pw-text-muted)" }}>
              <Icon
                name={isImage ? "camera" : "fileText"}
                size={28}
                strokeWidth={1.5}
              />
            </div>
          )}
        </div>

        {/* Title */}
        <div
          style={{
            font: "500 13px var(--font-inter)",
            color: "var(--pw-text)",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
          title={title}
        >
          {title}
        </div>

        {/* Caption */}
        <div
          style={{
            font: "400 11.5px var(--font-inter)",
            color: "var(--pw-text-muted)",
            marginTop: -4,
          }}
        >
          {caption}
        </div>
      </Link>

      {/* Footer row — status pill on the left, delete on the right.
       *  Sibling to the Link so clicks here don't navigate. */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 8,
          marginTop: 2,
        }}
      >
        <div>{statusPill(doc.processing_status)}</div>
        <DeleteDocumentButton
          documentId={doc.id}
          petId={petId}
          filename={doc.original_filename}
          variant="ghost"
          redirectAfter={false}
        />
      </div>
    </div>
  );
}
