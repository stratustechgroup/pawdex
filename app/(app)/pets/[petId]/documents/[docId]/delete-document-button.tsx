"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Icon } from "@/components/brand/icon";

import { deleteDocumentAction } from "../../upload/actions";

export function DeleteDocumentButton({
  documentId,
  petId,
  filename,
  variant = "secondary",
  redirectAfter = true,
}: {
  documentId: string;
  petId: string;
  filename: string | null;
  /** "secondary" matches other header pills, "ghost" is smaller for cards. */
  variant?: "secondary" | "ghost";
  redirectAfter?: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);

  function onConfirm() {
    setOpen(false);
    startTransition(async () => {
      const result = await deleteDocumentAction({
        documentId,
        petId,
        redirectAfter,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      const summary = [
        result.counts.extractions && `${result.counts.extractions} extraction${result.counts.extractions === 1 ? "" : "s"}`,
        result.counts.chunks && `${result.counts.chunks} Q&A chunk${result.counts.chunks === 1 ? "" : "s"}`,
        result.counts.vaccinations_unlinked &&
          `${result.counts.vaccinations_unlinked} vaccine${result.counts.vaccinations_unlinked === 1 ? "" : "s"} unlinked`,
        result.counts.events_unlinked &&
          `${result.counts.events_unlinked} event${result.counts.events_unlinked === 1 ? "" : "s"} unlinked`,
        result.counts.medications_unlinked &&
          `${result.counts.medications_unlinked} med${result.counts.medications_unlinked === 1 ? "" : "s"} unlinked`,
      ]
        .filter(Boolean)
        .join(" · ");
      toast.success(
        summary
          ? `Deleted "${filename ?? "document"}" — ${summary}`
          : `Deleted "${filename ?? "document"}"`,
      );
      if (!redirectAfter) router.refresh();
    });
  }

  const base: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: variant === "ghost" ? 4 : 6,
    height: variant === "ghost" ? 26 : 32,
    padding: variant === "ghost" ? "0 8px" : "0 12px",
    borderRadius: variant === "ghost" ? 5 : 6,
    border: "1px solid #b54a4a",
    background: "transparent",
    color: "#b54a4a",
    font: variant === "ghost"
      ? "500 11.5px var(--font-inter)"
      : "500 12.5px var(--font-inter)",
    cursor: pending ? "wait" : "pointer",
    opacity: pending ? 0.55 : 1,
  };

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} disabled={pending} style={base}>
        <Icon name="x" size={variant === "ghost" ? 11 : 13} />
        {pending ? "Deleting…" : "Delete"}
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => !pending && setOpen(false)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(10, 10, 10, 0.55)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 50,
            padding: 16,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              maxWidth: 460,
              width: "100%",
              padding: 22,
              borderRadius: 12,
              background: "var(--pw-surface)",
              border: "1px solid var(--pw-border)",
              boxShadow: "0 10px 40px rgba(0,0,0,0.25)",
              display: "flex",
              flexDirection: "column",
              gap: 14,
            }}
          >
            <header style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 8,
                  background: "#fce8e8",
                  color: "#7a2424",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <Icon name="alert" size={15} />
              </span>
              <h2
                style={{
                  margin: 0,
                  font: "600 15px var(--font-inter)",
                  color: "var(--pw-text)",
                }}
              >
                Delete this document?
              </h2>
            </header>
            <p
              style={{
                margin: 0,
                font: "400 13px var(--font-inter)",
                color: "var(--pw-text-secondary)",
                lineHeight: 1.55,
              }}
            >
              <strong style={{ color: "var(--pw-text)" }}>
                {filename ?? "Untitled document"}
              </strong>{" "}
              and its extracted draft will be removed from your vault. Records
              you already committed (vaccinations, visits, medications) stay
              — they just lose the link back to this source file.
            </p>
            <p
              style={{
                margin: 0,
                padding: 10,
                background: "var(--pw-pending-bg)",
                color: "var(--pw-pending-fg)",
                borderRadius: 6,
                font: "400 12px var(--font-inter)",
                lineHeight: 1.5,
              }}
            >
              The original PDF in storage is also deleted. This can&apos;t be
              undone.
            </p>
            <footer
              style={{
                display: "flex",
                justifyContent: "flex-end",
                gap: 10,
                marginTop: 4,
              }}
            >
              <button
                type="button"
                onClick={() => setOpen(false)}
                disabled={pending}
                style={{
                  height: 34,
                  padding: "0 14px",
                  borderRadius: 6,
                  border: "1px solid var(--pw-border-strong)",
                  background: "var(--pw-surface)",
                  color: "var(--pw-text)",
                  font: "500 12.5px var(--font-inter)",
                  cursor: pending ? "not-allowed" : "pointer",
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={onConfirm}
                disabled={pending}
                style={{
                  height: 34,
                  padding: "0 14px",
                  borderRadius: 6,
                  border: "1px solid #b54a4a",
                  background: "#b54a4a",
                  color: "#fff",
                  font: "500 12.5px var(--font-inter)",
                  cursor: pending ? "wait" : "pointer",
                  opacity: pending ? 0.7 : 1,
                }}
              >
                {pending ? "Deleting…" : "Delete permanently"}
              </button>
            </footer>
          </div>
        </div>
      )}
    </>
  );
}
