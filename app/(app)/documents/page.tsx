import Link from "next/link";
import { format, isSameDay, subDays } from "date-fns";

import { Icon } from "@/components/brand/icon";
import { PetPhoto } from "@/components/pawdex/pet-photo";
import { SectionHead } from "@/components/pawdex/chips";
import { requireSession } from "@/lib/auth/household";
import { listPetsForHousehold } from "@/lib/db/pets";
import { createClient } from "@/lib/supabase/server";
import type { DocumentRow } from "@/lib/supabase/types";

export const metadata = { title: "Documents · Pawdex" };
export const dynamic = "force-dynamic";

type DocListRow = Pick<
  DocumentRow,
  | "id"
  | "original_filename"
  | "doc_type"
  | "processing_status"
  | "uploaded_at"
  | "pet_id"
  | "mime_type"
  | "storage_path"
>;

type DocType = DocumentRow["doc_type"];

const DOC_TYPES: readonly DocType[] = [
  "vaccine_certificate",
  "vet_visit_summary",
  "lab_result",
  "invoice",
  "prescription",
  "imaging",
  "adoption_record",
  "microchip_record",
  "other",
  "unknown",
] as const;

function parseDocType(s: string | undefined): DocType | null {
  if (!s) return null;
  return (DOC_TYPES as readonly string[]).includes(s) ? (s as DocType) : null;
}

export default async function DocumentsPage({
  searchParams,
}: {
  searchParams: Promise<{ pet?: string; type?: string }>;
}) {
  const { pet: petFilter, type: typeFilterRaw } = await searchParams;
  const typeFilter = parseDocType(typeFilterRaw);

  const session = await requireSession();
  const supabase = await createClient();
  const pets = await listPetsForHousehold(session.householdId);
  const petById = new Map(pets.map((p) => [p.id, p]));

  // Pull all docs for the household. Filters apply at the query layer.
  let query = supabase
    .from("documents")
    .select(
      "id, original_filename, doc_type, processing_status, uploaded_at, pet_id, mime_type, storage_path",
    )
    .eq("household_id", session.householdId)
    .order("uploaded_at", { ascending: false });

  if (petFilter) query = query.eq("pet_id", petFilter);
  if (typeFilter) query = query.eq("doc_type", typeFilter);

  const { data } = await query;
  const docs = (data ?? []) as DocListRow[];

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

  // Distinct doc types in the (possibly filtered) result set, for the type
  // chip row. We render counts off the unfiltered-by-type set so the user
  // can see how many of each are available even after picking a filter.
  const typeCounts = await (async () => {
    let q = supabase
      .from("documents")
      .select("doc_type", { count: "exact", head: false })
      .eq("household_id", session.householdId);
    if (petFilter) q = q.eq("pet_id", petFilter);
    const { data: rows } = await q;
    const counts = new Map<string, number>();
    for (const r of (rows ?? []) as { doc_type: string }[]) {
      counts.set(r.doc_type, (counts.get(r.doc_type) ?? 0) + 1);
    }
    return counts;
  })();

  // Group docs into time buckets for visual scannability
  const now = new Date();
  const weekAgo = subDays(now, 7);
  const monthAgo = subDays(now, 30);
  const buckets: { label: string; rows: DocListRow[] }[] = [
    { label: "Today", rows: [] },
    { label: "This week", rows: [] },
    { label: "This month", rows: [] },
    { label: "Earlier", rows: [] },
  ];
  for (const d of docs) {
    const at = new Date(d.uploaded_at);
    if (isSameDay(at, now)) buckets[0].rows.push(d);
    else if (at >= weekAgo) buckets[1].rows.push(d);
    else if (at >= monthAgo) buckets[2].rows.push(d);
    else buckets[3].rows.push(d);
  }

  const filterActive = Boolean(petFilter || typeFilter);
  const activePet = petFilter ? petById.get(petFilter) : null;

  return (
    <div
      style={{
        maxWidth: 1320,
        margin: "0 auto",
        padding: "32px 24px 56px",
      }}
    >
      <SectionHead
        title="Documents"
        sub={
          filterActive
            ? `${docs.length} ${docs.length === 1 ? "match" : "matches"} for current filter`
            : `${docs.length} ${docs.length === 1 ? "document" : "documents"} across ${pets.length} ${pets.length === 1 ? "pet" : "pets"}`
        }
        right={
          pets.length > 0 ? (
            <Link
              href={`/pets/${pets[0].id}/upload`}
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
                font: "500 12.5px var(--font-inter)",
                textDecoration: "none",
              }}
            >
              <Icon name="upload" size={13} />
              Upload
            </Link>
          ) : null
        }
      />

      {/* Filter chip rows */}
      {pets.length > 0 && (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 10,
            marginBottom: 18,
          }}
        >
          <ChipRow
            label="Pet"
            chips={[
              {
                key: "all",
                label: "All pets",
                active: !petFilter,
                href: hrefWith({ type: typeFilter ?? undefined }),
              },
              ...pets.map((p) => ({
                key: p.id,
                label: p.name,
                active: petFilter === p.id,
                href: hrefWith({ pet: p.id, type: typeFilter ?? undefined }),
              })),
            ]}
          />
          {typeCounts.size > 0 && (
            <ChipRow
              label="Type"
              chips={[
                {
                  key: "all",
                  label: "All types",
                  active: !typeFilter,
                  href: hrefWith({ pet: petFilter }),
                },
                ...Array.from(typeCounts.entries())
                  .sort((a, b) => b[1] - a[1])
                  .map(([t, count]) => ({
                    key: t,
                    label: `${prettyDocType(t)} · ${count}`,
                    active: typeFilter === t,
                    href: hrefWith({ pet: petFilter, type: t }),
                  })),
              ]}
            />
          )}
        </div>
      )}

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
            {filterActive
              ? "No documents match the current filter."
              : "Documents you upload or forward will appear here, organized by pet."}
          </p>
          {filterActive ? (
            <Link
              href="/documents"
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
              Clear filters
            </Link>
          ) : pets.length > 0 ? (
            <Link
              href={`/pets/${pets[0].id}/upload`}
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
          ) : null}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
          {buckets
            .filter((b) => b.rows.length > 0)
            .map((bucket) => (
              <section key={bucket.label}>
                <div
                  style={{
                    font: "500 11.5px var(--font-inter)",
                    color: "var(--pw-text-muted)",
                    textTransform: "uppercase",
                    letterSpacing: "0.04em",
                    marginBottom: 8,
                  }}
                >
                  {bucket.label}
                </div>
                <div className="pw-card" style={{ padding: "4px 0" }}>
                  {bucket.rows.map((d, i) => (
                    <DocRow
                      key={d.id}
                      doc={d}
                      pet={d.pet_id ? petById.get(d.pet_id) ?? null : null}
                      signedThumbUrl={thumbMap.get(d.id) ?? null}
                      isFirst={i === 0}
                    />
                  ))}
                </div>
              </section>
            ))}
        </div>
      )}

      {activePet && (
        <div
          style={{
            marginTop: 24,
            font: "400 12px var(--font-inter)",
            color: "var(--pw-text-muted)",
          }}
        >
          Viewing {activePet.name}&apos;s documents.{" "}
          <Link
            href={`/pets/${activePet.id}/documents`}
            style={{ color: "var(--pw-text-secondary)" }}
          >
            Open pet record →
          </Link>
        </div>
      )}
    </div>
  );
}

// ─── Components ────────────────────────────────────────────────────────────

function ChipRow({
  label,
  chips,
}: {
  label: string;
  chips: { key: string; label: string; active: boolean; href: string }[];
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
      <span
        style={{
          font: "500 11px var(--font-inter)",
          color: "var(--pw-text-muted)",
          textTransform: "uppercase",
          letterSpacing: "0.04em",
          minWidth: 36,
        }}
      >
        {label}
      </span>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {chips.map((c) => (
          <Link
            key={c.key}
            href={c.href}
            style={{
              display: "inline-flex",
              alignItems: "center",
              height: 26,
              padding: "0 10px",
              borderRadius: 13,
              border: c.active
                ? "1px solid var(--pw-accent)"
                : "1px solid var(--pw-border)",
              background: c.active ? "var(--pw-accent)" : "var(--pw-surface)",
              color: c.active ? "#fff" : "var(--pw-text-secondary)",
              font: "500 12px var(--font-inter)",
              textDecoration: "none",
              whiteSpace: "nowrap",
            }}
          >
            {c.label}
          </Link>
        ))}
      </div>
    </div>
  );
}

function DocRow({
  doc,
  pet,
  signedThumbUrl,
  isFirst,
}: {
  doc: DocListRow;
  pet: { id: string; name: string; photo_storage_path: string | null } | null;
  signedThumbUrl: string | null;
  isFirst: boolean;
}) {
  const title = doc.original_filename ?? "Untitled document";
  const reviewHref =
    doc.processing_status === "extracted" && doc.pet_id
      ? `/pets/${doc.pet_id}/documents/${doc.id}/review`
      : null;
  const openHref = doc.pet_id ? `/pets/${doc.pet_id}/documents/${doc.id}` : null;

  return (
    <div
      style={{
        padding: "14px 16px",
        display: "flex",
        alignItems: "center",
        gap: 12,
        borderTop: isFirst ? "none" : "1px solid var(--pw-border)",
      }}
    >
      {doc.mime_type?.startsWith("image/") && signedThumbUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={signedThumbUrl}
          alt=""
          style={{
            width: 32,
            height: 40,
            borderRadius: 4,
            objectFit: "cover",
            border: "1px solid var(--pw-border-strong)",
            flexShrink: 0,
          }}
        />
      ) : (
        <DocThumb />
      )}

      <div style={{ flex: 1, minWidth: 0 }}>
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
        <div
          style={{
            font: "400 12px var(--font-inter)",
            color: "var(--pw-text-muted)",
            marginTop: 3,
            display: "flex",
            alignItems: "center",
            gap: 6,
            flexWrap: "wrap",
          }}
        >
          {pet && (
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 5,
              }}
            >
              <PetPhoto name={pet.name} size={16} ring={false} />
              {pet.name}
            </span>
          )}
          {pet && <span aria-hidden>·</span>}
          <span>{prettyDocType(doc.doc_type)}</span>
          <span aria-hidden>·</span>
          <span>{prettyStatus(doc.processing_status)}</span>
        </div>
      </div>

      <div
        style={{
          font: "400 12px var(--font-inter)",
          color: "var(--pw-text-muted)",
          whiteSpace: "nowrap",
        }}
      >
        {format(new Date(doc.uploaded_at), "MMM d")}
      </div>

      {reviewHref && (
        <Link
          href={reviewHref}
          style={{
            display: "inline-flex",
            alignItems: "center",
            height: 26,
            padding: "0 10px",
            borderRadius: 6,
            background: "var(--pw-status-due-bg)",
            color: "var(--pw-status-due-fg)",
            border: "1px solid var(--pw-status-due-dot)",
            font: "500 11.5px var(--font-inter)",
            textDecoration: "none",
            whiteSpace: "nowrap",
          }}
        >
          Review
        </Link>
      )}
      {!reviewHref && openHref && (
        <Link
          href={openHref}
          style={{
            display: "inline-flex",
            alignItems: "center",
            height: 26,
            padding: "0 10px",
            borderRadius: 6,
            background: "var(--pw-surface-2)",
            color: "var(--pw-text-secondary)",
            border: "1px solid var(--pw-border-strong)",
            font: "500 11.5px var(--font-inter)",
            textDecoration: "none",
            whiteSpace: "nowrap",
          }}
        >
          Open
        </Link>
      )}
    </div>
  );
}

function DocThumb() {
  return (
    <div
      style={{
        width: 32,
        height: 40,
        borderRadius: 4,
        background: "var(--pw-surface)",
        border: "1px solid var(--pw-border-strong)",
        flexShrink: 0,
        position: "relative",
        overflow: "hidden",
      }}
      aria-hidden
    >
      {[14, 28, 42].map((top) => (
        <div
          key={top}
          style={{
            position: "absolute",
            inset: `${top}% 16% auto 16%`,
            height: 1.5,
            background: top === 14 ? "var(--pw-border-strong)" : "var(--pw-border)",
          }}
        />
      ))}
      <div
        style={{
          position: "absolute",
          bottom: 3,
          left: 3,
          padding: "1px 4px",
          borderRadius: 2,
          background: "#B23A3A",
          color: "#fff",
          font: "700 7px var(--font-jetbrains)",
          letterSpacing: 0.5,
        }}
      >
        PDF
      </div>
    </div>
  );
}

// ─── Helpers ───────────────────────────────────────────────────────────────

function prettyDocType(t: string) {
  return t.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function prettyStatus(s: string) {
  switch (s) {
    case "pending":
      return "Awaiting processing";
    case "extracting":
      return "Extracting";
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

function hrefWith(params: { pet?: string; type?: string }): string {
  const q = new URLSearchParams();
  if (params.pet) q.set("pet", params.pet);
  if (params.type) q.set("type", params.type);
  const qs = q.toString();
  return qs ? `/documents?${qs}` : "/documents";
}
