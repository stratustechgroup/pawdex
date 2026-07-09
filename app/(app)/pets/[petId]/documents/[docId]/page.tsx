import Link from "next/link";
import { notFound } from "next/navigation";
import { format } from "date-fns";

import { Icon } from "@/components/brand/icon";
import { requireSession } from "@/lib/auth/household";
import { createClient } from "@/lib/supabase/server";
import type { DocumentRow } from "@/lib/supabase/types";

import { DeleteDocumentButton } from "./delete-document-button";

export const dynamic = "force-dynamic";

function prettyDocType(t: string): string {
  return t.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function prettyStatus(s: DocumentRow["processing_status"]): string {
  switch (s) {
    case "pending":
      return "Queued";
    case "extracting":
      return "Reading…";
    case "extracted":
      return "Needs review";
    case "confirmed":
      return "Confirmed";
    case "failed":
      return "Failed";
    default:
      return s;
  }
}

function formatBytes(b: number | null): string {
  if (b === null || b === undefined) return "—";
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / (1024 * 1024)).toFixed(2)} MB`;
}

export default async function DocumentViewerPage({
  params,
}: {
  params: Promise<{ petId: string; docId: string }>;
}) {
  const { petId, docId } = await params;
  const session = await requireSession();
  const supabase = await createClient();

  const { data } = await supabase
    .from("documents")
    .select(
      "id, original_filename, doc_type, processing_status, uploaded_at, mime_type, byte_size, storage_path, storage_bucket, pet_id, household_id, error_message, extraction_attempts, confirmed_at, processed_at, updated_at, created_by",
    )
    .eq("household_id", session.householdId)
    .eq("id", docId)
    .maybeSingle();

  const doc = data as DocumentRow | null;
  if (!doc || doc.pet_id !== petId) {
    notFound();
  }

  const { data: signed } = await supabase.storage
    .from("documents")
    .createSignedUrl(doc.storage_path, 60 * 60);
  const signedUrl = signed?.signedUrl ?? null;

  const isImage = doc.mime_type?.startsWith("image/") ?? false;
  const isPdf = doc.mime_type === "application/pdf";
  const showReview =
    doc.processing_status === "extracted" ||
    doc.processing_status === "confirmed";
  const title =
    doc.original_filename?.trim() ||
    prettyDocType(doc.doc_type) ||
    "Untitled document";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Page header */}
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 16,
          flexWrap: "wrap",
        }}
      >
        <div style={{ minWidth: 0, flex: 1 }}>
          <h2
            className="serif"
            style={{
              margin: 0,
              fontSize: 22,
              fontWeight: 500,
              letterSpacing: "-0.015em",
              color: "var(--pw-text)",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
            title={title}
          >
            {title}
          </h2>
          <p
            style={{
              margin: "4px 0 0",
              font: "400 12.5px var(--font-inter)",
              color: "var(--pw-text-muted)",
            }}
          >
            {prettyDocType(doc.doc_type)} ·{" "}
            <span className="tnum">
              {format(new Date(doc.uploaded_at), "MMM d, yyyy")}
            </span>
          </p>
        </div>
        <div
          style={{
            display: "flex",
            gap: 8,
            flexWrap: "wrap",
            alignItems: "center",
          }}
        >
          {signedUrl && (
            <a
              href={signedUrl}
              download={doc.original_filename ?? undefined}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                height: 32,
                padding: "0 12px",
                borderRadius: 6,
                border: "1px solid var(--pw-border-strong)",
                background: "var(--pw-surface)",
                color: "var(--pw-text)",
                font: "500 12.5px var(--font-inter)",
                textDecoration: "none",
              }}
            >
              <Icon name="download" size={13} />
              Download
            </a>
          )}
          <DeleteDocumentButton
            documentId={doc.id}
            petId={petId}
            filename={doc.original_filename}
          />
          {showReview && (
            <Link
              href={`/pets/${petId}/documents/${doc.id}/review`}
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
              <Icon name="fileCheck" size={13} />
              Review extraction
            </Link>
          )}
        </div>
      </div>

      {/* Failure banner */}
      {doc.processing_status === "failed" && (
        <div
          className="pw-card"
          style={{
            padding: 14,
            background: "var(--pw-status-overdue-bg)",
            borderColor: "var(--pw-status-overdue-dot)",
            display: "flex",
            alignItems: "flex-start",
            gap: 12,
          }}
        >
          <div
            style={{
              color: "var(--pw-status-overdue-fg)",
              marginTop: 1,
              flexShrink: 0,
            }}
          >
            <Icon name="alert" size={18} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                font: "600 13px var(--font-inter)",
                color: "var(--pw-status-overdue-fg)",
              }}
            >
              Extraction failed
            </div>
            <div
              className="mono"
              style={{
                marginTop: 4,
                font: "400 12px var(--font-jetbrains)",
                color: "var(--pw-status-overdue-fg)",
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
              }}
            >
              {doc.error_message ?? "No error message recorded."}
            </div>
          </div>
          <button
            type="button"
            disabled
            title="Wired up in Phase 2.4"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              height: 30,
              padding: "0 10px",
              borderRadius: 6,
              border: "1px solid var(--pw-status-overdue-dot)",
              background: "transparent",
              color: "var(--pw-status-overdue-fg)",
              font: "500 12.5px var(--font-inter)",
              cursor: "not-allowed",
              opacity: 0.7,
              flexShrink: 0,
            }}
          >
            <Icon name="refresh" size={12} />
            Retry
          </button>
        </div>
      )}

      {/* Body */}
      <div className="doc-viewer-grid">
        {/* Viewer */}
        <div>
          {signedUrl ? (
            isImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={signedUrl}
                alt={title}
                style={{
                  width: "100%",
                  height: "auto",
                  borderRadius: 8,
                  border: "1px solid var(--pw-border)",
                  display: "block",
                }}
              />
            ) : isPdf ? (
              <iframe
                src={signedUrl}
                title={title}
                style={{
                  width: "100%",
                  height: "70vh",
                  border: "1px solid var(--pw-border)",
                  borderRadius: 8,
                  background: "white",
                }}
              />
            ) : (
              <div
                className="pw-card"
                style={{
                  padding: 40,
                  textAlign: "center",
                  font: "400 13px var(--font-inter)",
                  color: "var(--pw-text-muted)",
                }}
              >
                Preview not available for this file type ({doc.mime_type ?? "unknown"}).
                Use Download above to view it.
              </div>
            )
          ) : (
            <div
              className="pw-card"
              style={{
                padding: 40,
                textAlign: "center",
                font: "400 13px var(--font-inter)",
                color: "var(--pw-text-muted)",
              }}
            >
              Could not generate a preview URL for this document.
            </div>
          )}
        </div>

        {/* Sidebar */}
        <aside>
          <div className="pw-card" style={{ padding: 16 }}>
            <div
              style={{
                font: "600 13px var(--font-inter)",
                color: "var(--pw-text)",
                marginBottom: 12,
              }}
            >
              Document details
            </div>
            <dl
              style={{
                margin: 0,
                display: "grid",
                gridTemplateColumns: "1fr",
                gap: 10,
              }}
            >
              <Field label="Original filename">
                <span
                  className="mono"
                  style={{
                    font: "400 12px var(--font-jetbrains)",
                    color: "var(--pw-text)",
                    wordBreak: "break-all",
                  }}
                >
                  {doc.original_filename ?? "—"}
                </span>
              </Field>
              <Field label="Document type">
                <span style={{ color: "var(--pw-text)" }}>
                  {prettyDocType(doc.doc_type)}
                </span>
              </Field>
              <Field label="Mime type">
                <span
                  className="mono"
                  style={{
                    font: "400 12px var(--font-jetbrains)",
                    color: "var(--pw-text-secondary)",
                  }}
                >
                  {doc.mime_type ?? "—"}
                </span>
              </Field>
              <Field label="Size">
                <span
                  className="tnum"
                  style={{ color: "var(--pw-text-secondary)" }}
                >
                  {formatBytes(doc.byte_size)}
                </span>
              </Field>
              <Field label="Uploaded">
                <span
                  className="tnum"
                  style={{ color: "var(--pw-text-secondary)" }}
                >
                  {format(new Date(doc.uploaded_at), "MMM d, yyyy 'at' h:mm a")}
                </span>
              </Field>
              <Field label="Processing status">
                <span style={{ color: "var(--pw-text)" }}>
                  {prettyStatus(doc.processing_status)}
                </span>
              </Field>
              <Field label="Extraction attempts">
                <span
                  className="tnum"
                  style={{ color: "var(--pw-text-secondary)" }}
                >
                  {doc.extraction_attempts}
                </span>
              </Field>
              {doc.error_message && (
                <Field label="Error">
                  <span
                    className="mono"
                    style={{
                      font: "400 11.5px var(--font-jetbrains)",
                      color: "var(--pw-status-overdue-fg)",
                      wordBreak: "break-word",
                    }}
                  >
                    {doc.error_message}
                  </span>
                </Field>
              )}
            </dl>
          </div>
        </aside>
      </div>

      <style>{`
        .doc-viewer-grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: 24px;
        }
        @media (min-width: 900px) {
          .doc-viewer-grid {
            grid-template-columns: 1fr 320px;
          }
        }
      `}</style>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <dt
        className="pw-label"
        style={{
          font: "500 10.5px var(--font-inter)",
          color: "var(--pw-text-muted)",
          textTransform: "uppercase",
          letterSpacing: "0.06em",
          marginBottom: 3,
        }}
      >
        {label}
      </dt>
      <dd
        style={{
          margin: 0,
          font: "400 13px var(--font-inter)",
          color: "var(--pw-text)",
        }}
      >
        {children}
      </dd>
    </div>
  );
}
