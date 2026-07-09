"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
  type ChangeEvent,
  type DragEvent,
} from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import imageCompression from "browser-image-compression";

import { Icon } from "@/components/brand/icon";
import { createClient } from "@/lib/supabase/browser";
import { createDocument } from "@/app/(app)/pets/[petId]/upload/actions";

type QueueStatus =
  | "pending"
  | "compressing"
  | "uploading"
  | "extracting"
  | "ready"
  | "duplicate"
  | "error";

type QueueItem = {
  id: string;
  file: File;
  status: QueueStatus;
  progress: number;
  error?: string;
  documentId?: string;
  // Pet that owns the EXISTING document when this upload was a duplicate. May
  // be null (the match is an insurance/inbox doc with no pet) — in that case we
  // route to /inbox rather than a pet-scoped viewer.
  existingPetId?: string | null;
  startedAt: number;
};

const ACCEPTED_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
];

const MAX_BYTES = 20 * 1024 * 1024; // 20 MB

function extFromFile(file: File): string {
  const fromName = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (fromName && /^[a-z0-9]{2,5}$/.test(fromName)) return fromName;
  const mime = file.type.toLowerCase();
  if (mime === "application/pdf") return "pdf";
  if (mime === "image/jpeg") return "jpg";
  if (mime === "image/png") return "png";
  if (mime === "image/webp") return "webp";
  if (mime === "image/heic" || mime === "image/heif") return "heic";
  return "bin";
}

function shouldCompress(file: File): boolean {
  const mime = file.type.toLowerCase();
  if (!mime.startsWith("image/")) return false;
  if (mime === "image/heic" || mime === "image/heif") return false;
  return true;
}

function validate(file: File): string | null {
  if (!ACCEPTED_TYPES.includes(file.type.toLowerCase())) {
    return `Unsupported file type (${file.type || "unknown"})`;
  }
  if (file.size > MAX_BYTES) {
    return `File is over 20 MB`;
  }
  return null;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function relativeAgo(ms: number, now: number): string {
  const diff = Math.max(0, Math.round((now - ms) / 1000));
  if (diff < 5) return "just now";
  if (diff < 60) return `${diff} seconds ago`;
  const mins = Math.round(diff / 60);
  if (mins < 60) return `${mins} ${mins === 1 ? "minute" : "minutes"} ago`;
  const hrs = Math.round(mins / 60);
  return `${hrs} ${hrs === 1 ? "hour" : "hours"} ago`;
}

export function DocumentUploader({
  householdId,
  petId,
}: {
  householdId: string;
  petId: string;
}) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [, startTransition] = useTransition();
  // Tick once per second while there's an in-flight upload — drives the
  // "started N seconds ago" subtitle on the processing section header.
  const [tick, setTick] = useState(Date.now());

  const supabase = useMemo(() => createClient(), []);

  const hasInflight = queue.some(
    (q) =>
      q.status !== "ready" &&
      q.status !== "error" &&
      q.status !== "duplicate",
  );
  useEffect(() => {
    if (!hasInflight) return;
    const id = window.setInterval(() => setTick(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [hasInflight]);

  const updateItem = useCallback(
    (id: string, patch: Partial<QueueItem>) => {
      setQueue((prev) =>
        prev.map((it) => (it.id === id ? { ...it, ...patch } : it)),
      );
    },
    [],
  );

  const removeItem = useCallback((id: string) => {
    setQueue((prev) => prev.filter((it) => it.id !== id));
  }, []);

  const handleFiles = useCallback(
    async (files: FileList | File[]) => {
      const incoming = Array.from(files);
      if (incoming.length === 0) return;
      const now = Date.now();

      const newItems: QueueItem[] = incoming.map((file) => ({
        id:
          typeof crypto !== "undefined" && "randomUUID" in crypto
            ? crypto.randomUUID()
            : `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        file,
        status: "pending",
        progress: 0,
        startedAt: now,
      }));

      setQueue((prev) => [...prev, ...newItems]);

      const successfullyUploaded: string[] = [];
      const duplicateMatches: { documentId: string; petId: string | null }[] =
        [];

      for (const item of newItems) {
        const validationError = validate(item.file);
        if (validationError) {
          updateItem(item.id, { status: "error", error: validationError });
          continue;
        }

        let uploadable: Blob = item.file;
        try {
          if (shouldCompress(item.file)) {
            updateItem(item.id, { status: "compressing", progress: 15 });
            uploadable = await imageCompression(item.file, {
              maxSizeMB: 2,
              maxWidthOrHeight: 2048,
              useWebWorker: true,
              initialQuality: 0.85,
            });
          }
        } catch (err) {
          updateItem(item.id, {
            status: "error",
            error: err instanceof Error ? err.message : "Compression failed",
          });
          continue;
        }

        updateItem(item.id, { status: "uploading", progress: 40 });

        const ext = extFromFile(item.file);
        const uuid =
          typeof crypto !== "undefined" && "randomUUID" in crypto
            ? crypto.randomUUID()
            : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
        const storagePath = `${householdId}/${petId}/${uuid}.${ext}`;

        const { error: uploadErr } = await supabase.storage
          .from("documents")
          .upload(storagePath, uploadable, {
            contentType: item.file.type || undefined,
            cacheControl: "3600",
            upsert: false,
          });

        if (uploadErr) {
          updateItem(item.id, {
            status: "error",
            error: uploadErr.message,
          });
          continue;
        }

        updateItem(item.id, { status: "extracting", progress: 80 });

        const result = await createDocument({
          pet_id: petId,
          storage_path: storagePath,
          mime_type: item.file.type || "application/octet-stream",
          original_filename: item.file.name,
          byte_size: uploadable.size,
        });

        if (!result.ok) {
          updateItem(item.id, { status: "error", error: result.error });
          continue;
        }

        if (result.duplicate) {
          // Happy path: this file is already in the household's records. Don't
          // re-review — point the row at the EXISTING document's viewer. Kept
          // out of successfullyUploaded so it never triggers the /review
          // auto-redirect below.
          updateItem(item.id, {
            status: "duplicate",
            progress: 100,
            documentId: result.documentId,
            existingPetId: result.petId,
          });
          duplicateMatches.push({
            documentId: result.documentId,
            petId: result.petId,
          });
          continue;
        }

        updateItem(item.id, {
          status: "ready",
          progress: 100,
          documentId: result.documentId,
        });
        successfullyUploaded.push(result.documentId);
      }

      // Single-file path: send the user straight to /review. Multi-file path:
      // leave the queue visible so they can pick which to review first.
      if (successfullyUploaded.length === 1 && incoming.length === 1) {
        const lastId = successfullyUploaded[0];
        startTransition(() => {
          router.push(`/pets/${petId}/documents/${lastId}/review`);
        });
      } else if (
        // A lone duplicate with no real uploads: route straight to the existing
        // copy's viewer (or /inbox when the match has no pet) — saves the user
        // a click and matches the single-file /review convenience above.
        successfullyUploaded.length === 0 &&
        duplicateMatches.length === 1 &&
        incoming.length === 1
      ) {
        const { documentId, petId: existingPetId } = duplicateMatches[0];
        startTransition(() => {
          router.push(
            existingPetId
              ? `/pets/${existingPetId}/documents/${documentId}`
              : "/inbox",
          );
        });
      }
    },
    [householdId, petId, router, supabase, updateItem],
  );

  function onChange(e: ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (files && files.length > 0) {
      void handleFiles(files);
    }
    e.target.value = "";
  }

  function onDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsDragging(false);
    const files = e.dataTransfer?.files;
    if (files && files.length > 0) {
      void handleFiles(files);
    }
  }

  function onDragOver(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    if (!isDragging) setIsDragging(true);
  }

  function onDragLeave(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsDragging(false);
  }

  const oldestStart = queue.length > 0 ? Math.min(...queue.map((q) => q.startedAt)) : null;
  const readyCount = queue.filter((q) => q.status === "ready").length;
  const errorCount = queue.filter((q) => q.status === "error").length;
  const duplicateCount = queue.filter((q) => q.status === "duplicate").length;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      {/* Dropzone — large, centered, two CTAs side-by-side */}
      <div
        role="button"
        tabIndex={0}
        onClick={() => fileInputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            fileInputRef.current?.click();
          }
        }}
        onDrop={onDrop}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        style={{
          border: `1.5px dashed ${isDragging ? "var(--pw-accent)" : "var(--pw-border-strong)"}`,
          borderRadius: 16,
          padding: "56px 24px",
          background: isDragging
            ? "var(--pw-accent-soft)"
            : "var(--pw-surface-2)",
          textAlign: "center",
          cursor: "pointer",
          transition: "background 120ms ease, border-color 120ms ease",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 16,
        }}
      >
        <div
          style={{
            width: 56,
            height: 56,
            borderRadius: "50%",
            background: "var(--pw-accent-soft)",
            color: "var(--pw-accent)",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Icon name="upload" size={24} />
        </div>
        <div
          className="serif"
          style={{
            font: "500 22px var(--font-source-serif)",
            color: "var(--pw-text)",
            letterSpacing: "-0.015em",
          }}
        >
          Drop documents anywhere, or
        </div>
        <div
          style={{
            display: "flex",
            gap: 8,
            flexWrap: "wrap",
            justifyContent: "center",
          }}
        >
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              fileInputRef.current?.click();
            }}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              height: 36,
              padding: "0 16px",
              borderRadius: 8,
              border: "1px solid var(--pw-accent)",
              background: "var(--pw-accent)",
              color: "#FAF9F6",
              font: "500 13px var(--font-inter)",
              cursor: "pointer",
            }}
          >
            <Icon name="paperclip" size={13} />
            Choose files
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              cameraInputRef.current?.click();
            }}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              height: 36,
              padding: "0 16px",
              borderRadius: 8,
              border: "1px solid var(--pw-border-strong)",
              background: "var(--pw-surface)",
              color: "var(--pw-text)",
              font: "500 13px var(--font-inter)",
              cursor: "pointer",
            }}
          >
            <Icon name="camera" size={13} />
            Take a photo
          </button>
        </div>
        <div
          style={{
            font: "400 12px var(--font-inter)",
            color: "var(--pw-text-muted)",
            marginTop: 2,
          }}
        >
          PDF, JPG, PNG, HEIC · up to 20 MB each · multi-page OK
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPTED_TYPES.join(",")}
          multiple
          onChange={onChange}
          style={{ display: "none" }}
        />
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={onChange}
          style={{ display: "none" }}
        />
      </div>

      {/* Processing list — appears once anything has been queued */}
      {queue.length > 0 && (
        <section style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <header style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <h3
              style={{
                margin: 0,
                font: "600 14px var(--font-inter)",
                color: "var(--pw-text)",
              }}
            >
              Processing
            </h3>
            <p
              style={{
                margin: 0,
                font: "400 12.5px var(--font-inter)",
                color: "var(--pw-text-muted)",
              }}
            >
              {queue.length} {queue.length === 1 ? "file" : "files"}
              {oldestStart !== null && hasInflight
                ? ` · started ${relativeAgo(oldestStart, tick)}`
                : readyCount > 0 || errorCount > 0 || duplicateCount > 0
                  ? ` · ${readyCount} ready${duplicateCount > 0 ? `, ${duplicateCount} already saved` : ""}${errorCount > 0 ? `, ${errorCount} failed` : ""}`
                  : ""}
            </p>
          </header>

          <ul
            style={{
              listStyle: "none",
              padding: 0,
              margin: 0,
              display: "flex",
              flexDirection: "column",
              gap: 8,
            }}
          >
            {queue.map((item) => (
              <QueueRow
                key={item.id}
                item={item}
                petId={petId}
                onRemove={() => removeItem(item.id)}
              />
            ))}
          </ul>

          {hasInflight && (
            <p
              style={{
                margin: "4px 0 0",
                font: "400 12px var(--font-inter)",
                color: "var(--pw-text-muted)",
                textAlign: "center",
              }}
            >
              You can leave this page — we&rsquo;ll keep extracting in the
              background.
            </p>
          )}
        </section>
      )}
    </div>
  );
}

/* ──────────────────── per-row queue render ──────────────────── */

function QueueRow({
  item,
  petId,
  onRemove,
}: {
  item: QueueItem;
  petId: string;
  onRemove: () => void;
}) {
  const isPdf = item.file.type === "application/pdf";
  const isImage = item.file.type.startsWith("image/");
  // Reference uses different-coloured PDF/IMG/JPG badges. We render a 32x40
  // file-shaped tile with the format label so the row scans quickly.
  const badgeColor = isPdf
    ? { bg: "#F4D9D5", fg: "#862C28" }
    : isImage
      ? { bg: "var(--pw-accent-soft)", fg: "var(--pw-accent-fg-on-soft)" }
      : { bg: "var(--pw-surface-2)", fg: "var(--pw-text-muted)" };
  const badgeLabel = isPdf
    ? "PDF"
    : isImage
      ? extFromFile(item.file).toUpperCase()
      : "FILE";

  return (
    <li
      className="pw-card"
      style={{
        padding: 12,
        display: "flex",
        alignItems: "center",
        gap: 12,
      }}
    >
      {/* File badge */}
      <div
        style={{
          width: 32,
          height: 40,
          borderRadius: 4,
          background: badgeColor.bg,
          color: badgeColor.fg,
          font: "700 9px var(--font-jetbrains)",
          letterSpacing: "0.06em",
          display: "inline-flex",
          alignItems: "flex-end",
          justifyContent: "center",
          paddingBottom: 4,
          flexShrink: 0,
        }}
      >
        {badgeLabel}
      </div>

      {/* Filename + meta + progress bar */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            font: "500 13px var(--font-inter)",
            color: "var(--pw-text)",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {item.file.name}
        </div>
        <div
          style={{
            marginTop: 3,
            font: "400 11.5px var(--font-inter)",
            color:
              item.status === "error"
                ? "var(--pw-status-overdue-fg)"
                : "var(--pw-text-muted)",
          }}
        >
          {item.status === "error"
            ? (item.error ?? "Failed")
            : item.status === "duplicate"
              ? "Already in your records — opening the existing copy"
              : `${formatBytes(item.file.size)} · ${statusSubLabel(item.status)}`}
        </div>
        {(item.status === "compressing" ||
          item.status === "uploading" ||
          item.status === "extracting") && (
          <div
            style={{
              marginTop: 6,
              height: 3,
              borderRadius: 999,
              background: "var(--pw-surface-2)",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                width: `${item.progress}%`,
                height: "100%",
                background: "var(--pw-accent)",
                transition: "width 240ms ease",
              }}
            />
          </div>
        )}
      </div>

      {/* Trailing status + action */}
      <div
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          flexShrink: 0,
        }}
      >
        <StatusPill status={item.status} />
        {item.status === "ready" && item.documentId ? (
          <Link
            href={`/pets/${petId}/documents/${item.documentId}/review`}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              height: 28,
              padding: "0 10px",
              borderRadius: 6,
              background: "var(--pw-accent)",
              color: "#FAF9F6",
              font: "500 12px var(--font-inter)",
              textDecoration: "none",
            }}
          >
            Review
            <Icon name="arrowRight" size={11} />
          </Link>
        ) : item.status === "duplicate" && item.documentId ? (
          <Link
            href={
              item.existingPetId
                ? `/pets/${item.existingPetId}/documents/${item.documentId}`
                : "/inbox"
            }
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              height: 28,
              padding: "0 10px",
              borderRadius: 6,
              border: "1px solid var(--pw-border-strong)",
              background: "var(--pw-surface)",
              color: "var(--pw-text)",
              font: "500 12px var(--font-inter)",
              textDecoration: "none",
            }}
          >
            View existing
            <Icon name="arrowRight" size={11} />
          </Link>
        ) : item.status === "error" ? (
          <button
            type="button"
            onClick={onRemove}
            aria-label="Dismiss"
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              width: 26,
              height: 26,
              borderRadius: 4,
              border: "none",
              background: "transparent",
              color: "var(--pw-text-muted)",
              cursor: "pointer",
            }}
          >
            ✕
          </button>
        ) : null}
      </div>
    </li>
  );
}

function statusSubLabel(s: QueueStatus): string {
  switch (s) {
    case "pending":
      return "In queue";
    case "compressing":
      return "Compressing image";
    case "uploading":
      return "Uploading";
    case "extracting":
      return "Reading with AI";
    case "ready":
      return "Ready for review";
    case "duplicate":
      return "Already in your records";
    case "error":
      return "Failed";
  }
}

function StatusPill({ status }: { status: QueueStatus }) {
  if (status === "ready") {
    return <Pill bg="var(--pw-status-up-bg)" fg="var(--pw-status-up-fg)" dot icon="checkCircle">
      Ready for review
    </Pill>;
  }
  if (status === "extracting") {
    return <Pill bg="var(--pw-accent-soft)" fg="var(--pw-accent-fg-on-soft)" icon="sparkles">
      Extracting…
    </Pill>;
  }
  if (status === "uploading") {
    return <Pill bg="var(--pw-accent-soft)" fg="var(--pw-accent-fg-on-soft)" icon="upload">
      Uploading…
    </Pill>;
  }
  if (status === "compressing") {
    return <Pill bg="var(--pw-surface-2)" fg="var(--pw-text-secondary)" icon="refresh">
      Compressing…
    </Pill>;
  }
  if (status === "duplicate") {
    return <Pill bg="var(--pw-surface-2)" fg="var(--pw-text-secondary)" icon="checkCircle">
      Already saved
    </Pill>;
  }
  if (status === "error") {
    return <Pill bg="var(--pw-status-overdue-bg)" fg="var(--pw-status-overdue-fg)" icon="alert">
      Failed
    </Pill>;
  }
  return <Pill bg="var(--pw-surface-2)" fg="var(--pw-text-muted)" icon="clock">
    Queued
  </Pill>;
}

function Pill({
  bg,
  fg,
  icon,
  dot,
  children,
}: {
  bg: string;
  fg: string;
  icon?: Parameters<typeof Icon>[0]["name"];
  dot?: boolean;
  children: React.ReactNode;
}) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        padding: "3px 9px",
        borderRadius: 999,
        background: bg,
        color: fg,
        font: "500 11.5px var(--font-inter)",
        whiteSpace: "nowrap",
      }}
    >
      {dot && (
        <span
          style={{
            width: 6,
            height: 6,
            borderRadius: 999,
            background: fg,
            display: "inline-block",
          }}
        />
      )}
      {icon && !dot && <Icon name={icon} size={11} />}
      {children}
    </span>
  );
}
