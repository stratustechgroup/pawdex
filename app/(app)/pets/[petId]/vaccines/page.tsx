import Link from "next/link";
import { format, parseISO, differenceInCalendarDays } from "date-fns";

import { Icon } from "@/components/brand/icon";
import { StatusBadge, type StatusKind } from "@/components/pawdex/status-badge";
import { requireSession } from "@/lib/auth/household";
import { createClient } from "@/lib/supabase/server";
import { getCatalogEntry } from "@/lib/clinical/vaccine-catalog";

import { VaccinationDialog } from "./vaccination-dialog";
import { VaccineRowMenu } from "./vaccine-row-menu";
import { VaccinesToolbar, type VaccineToolbarStatus } from "./vaccines-toolbar";

export const dynamic = "force-dynamic";

/** Row shape after we've joined clinic + document names back in. */
type Row = {
  id: string;
  vaccine_type: string;
  vaccine_family: string | null;
  administered_on: string;
  expires_on: string | null;
  lot_number: string | null;
  manufacturer: string | null;
  is_rabies: boolean;
  vet_clinic_id: string | null;
  document_id: string | null;
  clinic_name: string | null;
  document_filename: string | null;
};

function rowStatus(expires_on: string | null): {
  kind: StatusKind;
  label: string;
  sub: string | null;
} {
  if (!expires_on)
    return { kind: "incomplete", label: "No expiry", sub: null };
  const days = differenceInCalendarDays(parseISO(expires_on), new Date());
  if (days < -1)
    return {
      kind: "overdue",
      label: "Overdue",
      sub: `${Math.abs(days)} days ago`,
    };
  if (days === -1) return { kind: "overdue", label: "Overdue", sub: "yesterday" };
  if (days === 0) return { kind: "due", label: "Due today", sub: "today" };
  if (days === 1) return { kind: "due", label: "Due soon", sub: "tomorrow" };
  if (days <= 30)
    return { kind: "due", label: "Due soon", sub: `in ${days} days` };
  return { kind: "up", label: "Up to date", sub: `in ${days} days` };
}

function rowAccent(kind: StatusKind): string {
  if (kind === "overdue") return "var(--pw-status-overdue-dot)";
  if (kind === "due") return "var(--pw-status-due-dot)";
  if (kind === "up") return "var(--pw-status-up-dot)";
  return "var(--pw-border-strong)";
}

/**
 * AAHA/AAFP classification → "Core" / "Non-core" / "Other". Drives the
 * Category column in the table. Falls back to "Other" when the family
 * isn't in the catalog (or the row predates family detection).
 */
function categoryFor(family: string | null): "Core" | "Non-core" | "Other" {
  if (!family) return "Other";
  if (family === "rabies" || family === "dhpp" || family === "fvrcp")
    return "Core";
  // Lepto is "core or non-core depending on region" — we treat it as
  // non-core in the catalog to match AAHA's traditional split. Boarding
  // adjacent (bordetella, civ) and regional (lyme, rattlesnake) are clearly
  // non-core. FeLV is "core for outdoor kittens, non-core indoor adult" —
  // surface as Non-core, the catalog notes spell out the nuance.
  return "Non-core";
}

/** "3-yr" / "1-yr" / "6-mo" — derived from the catalog default duration. */
function durationLabel(family: string | null): string | null {
  const entry = getCatalogEntry(family);
  if (!entry) return null;
  const mo = entry.default_duration_months;
  if (mo % 12 === 0) return `${mo / 12}-yr`;
  return `${mo}-mo`;
}

export default async function VaccinesPage({
  params,
  searchParams,
}: {
  params: Promise<{ petId: string }>;
  searchParams: Promise<{ q?: string; scope?: string }>;
}) {
  const { petId } = await params;
  const { q: qRaw, scope: scopeRaw } = await searchParams;
  const q = (qRaw ?? "").trim();
  const scope = ((scopeRaw as VaccineToolbarStatus | undefined) ??
    "current") as VaccineToolbarStatus;

  const session = await requireSession();
  const supabase = await createClient();

  const [{ data }, { data: pet }] = await Promise.all([
    supabase
      .from("vaccinations")
      .select(
        "id, vaccine_type, vaccine_family, administered_on, expires_on, lot_number, manufacturer, is_rabies, vet_clinic_id, document_id",
      )
      .eq("household_id", session.householdId)
      .eq("pet_id", petId)
      .order("administered_on", { ascending: false }),
    supabase
      .from("pets")
      .select("date_of_birth")
      .eq("household_id", session.householdId)
      .eq("id", petId)
      .maybeSingle(),
  ]);

  const raw = (data ?? []) as Array<{
    id: string;
    vaccine_type: string;
    vaccine_family: string | null;
    administered_on: string;
    expires_on: string | null;
    lot_number: string | null;
    manufacturer: string | null;
    is_rabies: boolean;
    vet_clinic_id: string | null;
    document_id: string | null;
  }>;

  // Resolve clinic + document names in one round-trip each (Relationships:[]
  // in the hand-authored types.gen.ts means embedded joins don't work).
  const clinicIds = [
    ...new Set(raw.map((r) => r.vet_clinic_id).filter((x): x is string => !!x)),
  ];
  const docIds = [
    ...new Set(raw.map((r) => r.document_id).filter((x): x is string => !!x)),
  ];
  const [clinicRes, docRes] = await Promise.all([
    clinicIds.length > 0
      ? supabase
          .from("vet_clinics")
          .select("id, name")
          .in("id", clinicIds)
      : Promise.resolve({ data: [] }),
    docIds.length > 0
      ? supabase
          .from("documents")
          .select("id, original_filename")
          .in("id", docIds)
      : Promise.resolve({ data: [] }),
  ]);
  const clinicNames = new Map<string, string>();
  for (const c of (clinicRes.data ?? []) as Array<{
    id: string;
    name: string;
  }>) {
    clinicNames.set(c.id, c.name);
  }
  const docNames = new Map<string, string>();
  for (const d of (docRes.data ?? []) as Array<{
    id: string;
    original_filename: string | null;
  }>) {
    docNames.set(d.id, d.original_filename ?? "Source document");
  }

  const enriched: Row[] = raw.map((r) => ({
    ...r,
    clinic_name: r.vet_clinic_id
      ? (clinicNames.get(r.vet_clinic_id) ?? null)
      : null,
    document_filename: r.document_id
      ? (docNames.get(r.document_id) ?? null)
      : null,
  }));

  // Split into "current" (latest per vaccine family) and "archived" (older
  // entries for the same family — superseded by the newest dose). Status is
  // computed only from current rows.
  const currentRows: Row[] = [];
  const archivedRows: Row[] = [];
  {
    const seen = new Set<string>();
    for (const r of enriched) {
      const key =
        r.vaccine_family ?? `__type:${r.vaccine_type.toLowerCase().trim()}`;
      if (seen.has(key)) {
        archivedRows.push(r);
      } else {
        seen.add(key);
        currentRows.push(r);
      }
    }
  }

  // Sort current rows by expiry (soonest first), null-expiry last.
  currentRows.sort((a, b) => {
    if (!a.expires_on && !b.expires_on) return 0;
    if (!a.expires_on) return 1;
    if (!b.expires_on) return -1;
    return a.expires_on.localeCompare(b.expires_on);
  });

  // Apply toolbar filters server-side. Scope picks the list, q narrows it.
  const sourceList = scope === "archived" ? archivedRows : currentRows;
  const qLower = q.toLowerCase();
  const filtered = q
    ? sourceList.filter((r) => {
        const family = r.vaccine_family?.toLowerCase() ?? "";
        const clinic = r.clinic_name?.toLowerCase() ?? "";
        return (
          r.vaccine_type.toLowerCase().includes(qLower) ||
          family.includes(qLower) ||
          clinic.includes(qLower)
        );
      })
    : sourceList;

  // Per-status counts over the visible scope — feeds the top summary line.
  const summary = (() => {
    let up = 0;
    let due = 0;
    let overdue = 0;
    let unknown = 0;
    for (const r of currentRows) {
      if (!r.expires_on) {
        unknown++;
        continue;
      }
      const d = differenceInCalendarDays(parseISO(r.expires_on), new Date());
      if (d < 0) overdue++;
      else if (d <= 30) due++;
      else up++;
    }
    return { up, due, overdue, unknown, current: currentRows.length };
  })();

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Heading + summary line + add action */}
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
            Vaccines
          </h2>
          <p
            style={{
              margin: "4px 0 0",
              font: "400 12.5px var(--font-inter)",
              color: "var(--pw-text-muted)",
            }}
          >
            {enriched.length === 0
              ? "No vaccinations on record yet."
              : [
                  `${summary.up} of ${summary.current} current`,
                  summary.due > 0
                    ? `${summary.due} due soon`
                    : null,
                  summary.overdue > 0 ? `${summary.overdue} overdue` : null,
                  archivedRows.length > 0
                    ? `${archivedRows.length} archived`
                    : null,
                ]
                  .filter(Boolean)
                  .join(" · ")}
          </p>
        </div>
        <VaccinationDialog petId={petId} petDob={pet?.date_of_birth ?? null} />
      </div>

      {/* Toolbar — search + scope chips */}
      <VaccinesToolbar initialQ={q} initialScope={scope} />

      {/* Empty states or table */}
      {enriched.length === 0 ? (
        <div
          className="pw-card"
          style={{
            padding: 40,
            textAlign: "center",
            borderStyle: "dashed",
            background: "transparent",
            font: "400 13px var(--font-inter)",
            color: "var(--pw-text-muted)",
          }}
        >
          Add your first vaccine to start tracking expiration dates. Uploading
          a vaccine certificate will auto-fill these.
        </div>
      ) : filtered.length === 0 ? (
        <div
          className="pw-card"
          style={{
            padding: 28,
            textAlign: "center",
            borderStyle: "dashed",
            background: "transparent",
            font: "400 13px var(--font-inter)",
            color: "var(--pw-text-muted)",
          }}
        >
          {scope === "archived"
            ? "No archived doses match that search."
            : q
              ? `No vaccines matching “${q}”.`
              : "No vaccines in this scope."}
        </div>
      ) : (
        <div className="pw-card" style={{ overflowX: "auto", padding: 0 }}>
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              font: "400 13px var(--font-inter)",
            }}
          >
            <thead>
              <tr style={{ background: "var(--pw-surface-2)" }}>
                <Th>Vaccine</Th>
                <Th>Category</Th>
                <Th>Administered</Th>
                <Th sortIndicator>Expires</Th>
                <Th>Status</Th>
                <Th className="hidden md:table-cell">Vet</Th>
                <Th className="hidden lg:table-cell">Source</Th>
                <Th aria-label="Row actions" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => {
                const status = rowStatus(r.expires_on);
                const category = categoryFor(r.vaccine_family);
                const duration = durationLabel(r.vaccine_family);
                return (
                  <tr
                    key={r.id}
                    style={{
                      borderTop: "1px solid var(--pw-border)",
                      position: "relative",
                    }}
                  >
                    <Td>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                          paddingLeft: 8,
                          borderLeft: `3px solid ${rowAccent(status.kind)}`,
                          marginLeft: -16,
                          marginRight: -16,
                          paddingRight: 16,
                          height: "100%",
                          minHeight: 44,
                        }}
                      >
                        <span
                          style={{ color: "var(--pw-text)", fontWeight: 500 }}
                        >
                          {r.vaccine_type}
                        </span>
                        {r.is_rabies && (
                          <span
                            title="Legal document — retain original"
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 3,
                              padding: "1px 5px",
                              borderRadius: 3,
                              background: "var(--pw-surface-2)",
                              color: "var(--pw-text-muted)",
                              font: "600 9.5px var(--font-jetbrains)",
                              letterSpacing: "0.06em",
                            }}
                          >
                            <Icon name="shield" size={9} />
                            LEGAL
                          </span>
                        )}
                      </div>
                    </Td>
                    <Td>
                      <span
                        style={{
                          color: "var(--pw-text-secondary)",
                          font: "400 12.5px var(--font-inter)",
                        }}
                      >
                        {category}
                        {duration && (
                          <>
                            <span
                              style={{
                                margin: "0 5px",
                                color: "var(--pw-text-muted)",
                              }}
                            >
                              ·
                            </span>
                            {duration}
                          </>
                        )}
                      </span>
                    </Td>
                    <Td>
                      <span
                        className="tnum"
                        style={{ color: "var(--pw-text-secondary)" }}
                      >
                        {format(parseISO(r.administered_on), "MMM d, yyyy")}
                      </span>
                    </Td>
                    <Td>
                      {r.expires_on ? (
                        <>
                          <div
                            className="tnum"
                            style={{ color: "var(--pw-text)" }}
                          >
                            {format(parseISO(r.expires_on), "MMM d, yyyy")}
                          </div>
                          {status.sub && (
                            <div
                              style={{
                                font: "400 11px var(--font-inter)",
                                color: "var(--pw-text-muted)",
                              }}
                            >
                              {status.sub}
                            </div>
                          )}
                        </>
                      ) : (
                        <span style={{ color: "var(--pw-text-subtle)" }}>
                          —
                        </span>
                      )}
                    </Td>
                    <Td>
                      <StatusBadge kind={status.kind} label={status.label} />
                    </Td>
                    <Td className="hidden md:table-cell">
                      <span style={{ color: "var(--pw-text-muted)" }}>
                        {r.clinic_name ?? "—"}
                      </span>
                    </Td>
                    <Td className="hidden lg:table-cell">
                      {r.document_id && r.document_filename ? (
                        <Link
                          href={`/pets/${petId}/documents/${r.document_id}`}
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 5,
                            color: "var(--pw-accent)",
                            font: "500 12.5px var(--font-inter)",
                            textDecoration: "none",
                            maxWidth: 240,
                          }}
                        >
                          <Icon name="file" size={12} />
                          <span
                            style={{
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {r.document_filename}
                          </span>
                        </Link>
                      ) : (
                        <span style={{ color: "var(--pw-text-subtle)" }}>
                          —
                        </span>
                      )}
                    </Td>
                    <Td style={{ width: 36, textAlign: "right" }}>
                      <VaccineRowMenu
                        vaccinationId={r.id}
                        petId={petId}
                        documentId={r.document_id}
                        vaccineLabel={r.vaccine_type}
                      />
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Footer — counts + reminders note */}
      {enriched.length > 0 && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            flexWrap: "wrap",
            marginTop: 4,
            font: "400 12.5px var(--font-inter)",
            color: "var(--pw-text-muted)",
          }}
        >
          <div>
            Showing {filtered.length} of{" "}
            {scope === "archived" ? archivedRows.length : currentRows.length}{" "}
            {scope === "archived" ? "archived" : "active"}{" "}
            {filtered.length === 1 ? "vaccine" : "vaccines"}
            {scope !== "archived" && archivedRows.length > 0 && (
              <>
                {" · "}
                <Link
                  href="?scope=archived"
                  style={{
                    color: "var(--pw-accent)",
                    textDecoration: "none",
                    fontWeight: 500,
                  }}
                >
                  View {archivedRows.length} archived
                </Link>
              </>
            )}
            {scope === "archived" && (
              <>
                {" · "}
                <Link
                  href="?scope=current"
                  style={{
                    color: "var(--pw-accent)",
                    textDecoration: "none",
                    fontWeight: 500,
                  }}
                >
                  Back to active
                </Link>
              </>
            )}
          </div>
          <div>
            <span
              title="The date Pawdex used for every relative day count on this page"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 5,
                marginRight: 12,
                padding: "2px 8px",
                borderRadius: 999,
                background: "var(--pw-surface-2)",
                color: "var(--pw-text-secondary)",
                font: "500 11.5px var(--font-inter)",
              }}
            >
              <Icon name="calendar" size={11} />
              Today: {format(new Date(), "MMM d, yyyy")}
            </span>
            Reminders auto-send at{" "}
            <span style={{ color: "var(--pw-text-secondary)", fontWeight: 500 }}>
              30, 14, and 1 day
            </span>{" "}
            before expiry.{" "}
            <a
              href="/help/vaccines"
              style={{
                color: "var(--pw-accent)",
                textDecoration: "none",
                fontWeight: 500,
              }}
            >
              How expiries are computed →
            </a>
          </div>
        </div>
      )}
    </div>
  );
}

function Th({
  children,
  className,
  sortIndicator,
  ...rest
}: {
  children?: React.ReactNode;
  className?: string;
  sortIndicator?: boolean;
} & React.ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      className={className}
      {...rest}
      style={{
        textAlign: "left",
        padding: "10px 16px",
        font: "500 11.5px var(--font-inter)",
        color: "var(--pw-text-muted)",
        textTransform: "uppercase",
        letterSpacing: "0.04em",
        borderBottom: "1px solid var(--pw-border)",
      }}
    >
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 4,
        }}
      >
        {children}
        {sortIndicator && (
          <Icon
            name="chevronUp"
            size={11}
            style={{ color: "var(--pw-text-muted)" }}
          />
        )}
      </span>
    </th>
  );
}

function Td({
  children,
  className,
  style,
}: {
  children?: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <td
      className={className}
      style={{
        padding: "12px 16px",
        verticalAlign: "middle",
        font: "400 13px var(--font-inter)",
        color: "var(--pw-text)",
        ...style,
      }}
    >
      {children}
    </td>
  );
}
